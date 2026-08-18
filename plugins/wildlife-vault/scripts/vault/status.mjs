// scripts/vault/status.mjs
import * as nodeFs from "node:fs";
import * as crypto from "node:crypto";
import * as path from "node:path";
import { resolveVault } from "./config.mjs";
import { buildVaultIndex } from "./vault-index.mjs";

const RE_META = /[.*+?^${}()|[\]\\]/g;

// Resolve a `#symbol` half of a code_ref against a file body.
//
// A single-segment symbol is matched exactly as before (literal substring).
// A DOTTED symbol (`Class.method`, `Module.CONST`) is resolved part-wise on its
// final segment, because no mainstream language writes `Class.method` at the
// definition site — Python writes `def method`, TypeScript writes `method(`.
// The old literal test could therefore only ever fail for the dotted form, which
// made every dotted ref a permanent false positive and trained readers to ignore
// the whole warning list.
//
// Known trade: the final-segment match is deliberately loose (a bare mention of
// `method` anywhere in the file passes). This probe's job is to catch a symbol
// that has VANISHED; a false negative there costs far less than a warning list
// that is 100% noise.
export function symbolPresent(body, sym) {
  const s = String(sym);
  const parts = s.split(".");
  if (parts.length === 1) return body.includes(s); // unchanged path
  const raw = parts[parts.length - 1];
  if (!raw) return body.includes(s);
  // Word boundaries spelled out as lookaround, and applied only on the sides
  // where the segment's own edge is a word character. \b would invert its
  // meaning on a segment like `on(` or `get*` and silently mis-resolve it.
  const pre = /^[A-Za-z0-9_]/.test(raw) ? "(?<![A-Za-z0-9_])" : "";
  const post = /[A-Za-z0-9_]$/.test(raw) ? "(?![A-Za-z0-9_])" : "";
  return new RegExp(`${pre}${raw.replace(RE_META, "\\$&")}${post}`).test(body);
}

// opts.baseDir: resolve relative code_ref paths against this directory rather
// than the caller's cwd. Callers know the project root; cwd is whatever terminal
// the operator happened to be in, and a cwd mismatch would report every
// repo-relative code_ref as missing.
export function codeRefIssues(nodes, fsImpl = nodeFs, opts = {}) {
  const hard = [];
  const soft = [];
  const baseDir = opts.baseDir || null;
  const resolve = (p) => (baseDir && !path.isAbsolute(p) ? path.join(baseDir, p) : p);
  for (const n of nodes) {
    for (const ref of n.code_refs || []) {
      const [p, sym] = String(ref).split("#");
      const target = resolve(p);
      if (!fsImpl.existsSync(target)) { hard.push(`code_ref path missing: ${ref} (in ${n.id})`); continue; }
      if (sym) {
        const body = fsImpl.readFileSync(target, "utf-8");
        if (!symbolPresent(body, sym)) soft.push(`code_ref symbol drifted: ${ref} (in ${n.id})`);
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
  const vault = resolveVault();
  if (!vault) return; // no vault configured -> no-op
  // buildVaultIndex returns { byId, nodes: [{ filePath, data }] }; map to bare data objects.
  const { nodes: rawNodes } = buildVaultIndex(vault.vaultRoot);
  const nodes = rawNodes.map((n) => n.data);
  const manifestPath = path.join(vault.vaultRoot, "_meta", ".manifest.json");
  let manifest = { sources: [] };
  try {
    manifest = JSON.parse(nodeFs.readFileSync(manifestPath, "utf-8"));
  } catch {
    // No manifest yet (no sources registered). Skip the stale-source check;
    // code_refs liveness below still runs.
    process.stderr.write(`vault:status — no manifest at ${manifestPath}; skipping stale-source check\n`);
  }
  const currentHashes = {};
  for (const s of manifest.sources || []) {
    // A source whose file no longer exists is excluded from currentHashes and therefore not reported as stale here (manifest-cleanup concern, not a staleness concern).
    if (nodeFs.existsSync(s.path)) currentHashes[s.path] = hashFile(s.path);
  }
  const stale = staleSources(manifest, currentHashes);
  const code = codeRefIssues(nodes, nodeFs, { baseDir: vault.projectDir });
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
