// scripts/vault/status.mjs
import * as nodeFs from "node:fs";
import * as crypto from "node:crypto";
import * as path from "node:path";
import { VAULT_ROOT } from "./schema.mjs";
import { buildVaultIndex } from "./vault-index.mjs";

export function codeRefIssues(nodes, fsImpl = nodeFs) {
  const hard = [];
  const soft = [];
  for (const n of nodes) {
    for (const ref of n.code_refs || []) {
      const [p, sym] = String(ref).split("#");
      if (!fsImpl.existsSync(p)) { hard.push(`code_ref path missing: ${ref} (in ${n.id})`); continue; }
      if (sym) {
        const body = fsImpl.readFileSync(p, "utf-8");
        if (!body.includes(sym)) soft.push(`code_ref symbol drifted: ${ref} (in ${n.id})`);
      }
    }
  }
  return { hard, soft };
}

export function hashFile(p, fsImpl = nodeFs) {
  return "sha256:" + crypto.createHash("sha256").update(fsImpl.readFileSync(p)).digest("hex");
}

export function staleSources(manifest, currentHashes) {
  const out = [];
  for (const s of manifest.sources || []) {
    if (currentHashes[s.path] && currentHashes[s.path] !== s.hash) {
      out.push({ path: s.path, nodes: s.produced || [] });
    }
  }
  return out;
}

export function main() {
  // buildVaultIndex returns { byId, nodes: [{ filePath, data }] }; map to bare data objects.
  const { nodes: rawNodes } = buildVaultIndex();
  const nodes = rawNodes.map((n) => n.data);
  const manifestPath = path.join(VAULT_ROOT, "_meta", ".manifest.json");
  const manifest = JSON.parse(nodeFs.readFileSync(manifestPath, "utf-8"));
  const currentHashes = {};
  for (const s of manifest.sources || []) {
    // A source whose file no longer exists is excluded from currentHashes and therefore not reported as stale here (manifest-cleanup concern, not a staleness concern).
    if (nodeFs.existsSync(s.path)) currentHashes[s.path] = hashFile(s.path);
  }
  const stale = staleSources(manifest, currentHashes);
  const code = codeRefIssues(nodes);
  for (const s of stale) process.stderr.write(`[stale source] ${s.path} -> nodes: ${s.nodes.join(", ")}\n`);
  for (const h of code.hard) process.stderr.write(`[HARD] ${h}\n`);
  for (const w of code.soft) process.stderr.write(`[soft] ${w}\n`);
  process.stderr.write(`vault:status — ${stale.length} stale sources, ${code.hard.length} hard / ${code.soft.length} soft code_ref issues\n`);
  process.exit(code.hard.length ? 1 : 0);
}

// Windows-safe CLI guard.
const isMain = (() => {
  try {
    return path.resolve(process.argv[1] || "") === path.resolve(new URL(import.meta.url).pathname);
  } catch {
    return false;
  }
})() || (process.argv[1] != null &&
  (process.argv[1].endsWith("/status.mjs") || process.argv[1].endsWith(`${path.sep}status.mjs`)));

if (isMain) {
  main();
}
