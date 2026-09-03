// scripts/vault/init.mjs
// Scaffolds the vault into a consuming repo. Run by the /vault-init skill.
// Reads the bundled skeleton + fragments relative to this script (the plugin
// root); writes into the target project dir. Idempotent; never clobbers content.
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { resolveProjectDir, resolveVault } from "./config.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));     // .../scripts/vault
const pluginRoot = path.resolve(scriptDir, "..", "..");            // plugin root
const skeleton = path.join(pluginRoot, "skeleton", "Knowledge");
const fragments = path.join(pluginRoot, "skeleton", "fragments");
const today = new Date().toISOString().slice(0, 10);

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(hit.indexOf("=") + 1) : fallback;
}

function appendMarked(file, fragText) {
  let cur = fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "";
  if (cur.includes("<!-- vault-system:begin -->")) return false;
  cur = cur.replace(/\s*$/, "");
  fs.writeFileSync(file, (cur ? cur + "\n\n" : "") + fragText);
  return true;
}

function main() {
  const projectDir = resolveProjectDir();
  const client = arg("client", "claude");
  if (!["claude", "codex"].includes(client)) throw new Error("client must be claude or codex");
  const existing = resolveVault(projectDir);
  const name = arg("name", existing?.vaultName || "Knowledge");
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name)) throw new Error("vault name must be a single safe folder name");
  if (existing && existing.vaultRootRel !== `docs/vault/${name}`) {
    throw new Error("Existing vault uses a different root; reuse it instead of initializing another vault.");
  }
  // Refuse malformed config and symlinked destinations before any writes.
  const cfg = path.join(projectDir, "docs/vault/.vault.json");
  if (fs.existsSync(cfg) && !existing) throw new Error("Existing vault config could not be read");
  for (const rel of ["docs", "docs/vault", `docs/vault/${name}`, "docs/vault/.vault.json", "AGENTS.md", "CLAUDE.md", ".gitignore"]) {
    try { if (fs.lstatSync(path.join(projectDir, rel)).isSymbolicLink()) throw new Error("Initializer refuses symlinks: " + rel); }
    catch (e) { if (e.code !== "ENOENT") throw e; }
  }
  const vaultRootRel = `docs/vault/${name}`;
  const vaultDest = path.join(projectDir, "docs", "vault", name);
  const fresh = !fs.existsSync(vaultDest);

  // 1. skeleton (never clobber)
  fs.cpSync(skeleton, vaultDest, { recursive: true, force: false, errorOnExist: false });
  if (fresh) {
    const metaDir = path.join(vaultDest, "_meta");
    for (const f of fs.readdirSync(metaDir).filter((x) => x.endsWith(".md"))) {
      const p = path.join(metaDir, f);
      fs.writeFileSync(p, fs.readFileSync(p, "utf-8").replace(/^updated:.*$/m, `updated: ${today}`));
    }
  }

  // 2. .vault.json
  const cfgPath = path.join(projectDir, "docs", "vault", ".vault.json");
  if (!fs.existsSync(cfgPath)) {
    fs.writeFileSync(cfgPath, JSON.stringify({ vaultRoot: vaultRootRel, vaultName: name, domains: [] }, null, 2) + "\n");
  }

  // 3. CLAUDE.md / AGENTS.md / .gitignore stanzas (path-substituted, marker-guarded)
  const sub = (s) => s.replaceAll("docs/vault/Knowledge", vaultRootRel);
  if (client === "claude") appendMarked(path.join(projectDir, "CLAUDE.md"), sub(fs.readFileSync(path.join(fragments, "CLAUDE.md-vault-protocol.md"), "utf-8")));
  appendMarked(path.join(projectDir, "AGENTS.md"), sub(fs.readFileSync(path.join(fragments, client === "codex" ? "AGENTS.md-codex.md" : "AGENTS.md-pointer.md"), "utf-8")));
  const giPath = path.join(projectDir, ".gitignore");
  const giStanza = sub(fs.readFileSync(path.join(fragments, "gitignore-stanza.txt"), "utf-8"));
  let gi = fs.existsSync(giPath) ? fs.readFileSync(giPath, "utf-8") : "";
  if (!gi.includes(`${vaultRootRel}/.obsidian`)) {
    fs.writeFileSync(giPath, (gi.replace(/\s*$/, "") + "\n\n" + giStanza).replace(/^\n+/, ""));
  }

  // 4. generate indexes + colors (best-effort; pass our project dir through)
  for (const s of ["index.mjs", "colorize.mjs"]) {
    try { execFileSync(process.execPath, [path.join(scriptDir, s), `--project-dir=${projectDir}`], { stdio: "ignore" }); } catch { /* non-fatal */ }
  }

  process.stderr.write(`vault-init — vault at ${vaultRootRel} (${fresh ? "fresh" : "existing preserved"})\n`);
}

main();
