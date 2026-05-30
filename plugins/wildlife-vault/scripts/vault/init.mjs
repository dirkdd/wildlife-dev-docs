// scripts/vault/init.mjs
// Scaffolds the vault into a consuming repo. Run by the /vault-init skill.
// Reads the bundled skeleton + fragments relative to this script (the plugin
// root); writes into the target project dir. Idempotent; never clobbers content.
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { resolveProjectDir } from "./config.mjs";

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
  const name = arg("name", "Knowledge");
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
  appendMarked(path.join(projectDir, "CLAUDE.md"), sub(fs.readFileSync(path.join(fragments, "CLAUDE.md-vault-protocol.md"), "utf-8")));
  appendMarked(path.join(projectDir, "AGENTS.md"), sub(fs.readFileSync(path.join(fragments, "AGENTS.md-pointer.md"), "utf-8")));
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
