#!/usr/bin/env node
// vault-system installer. Run from your repo root:  node vault-system/install.mjs
// Pure Node ESM, no dependencies, cross-platform. Idempotent: safe to re-run.
//
// What it does:
//   1. Copies the machinery (scripts/vault, .claude/skills) into your repo (overwrites).
//   2. Copies the empty vault skeleton (docs/vault/Knowledge) WITHOUT clobbering existing content.
//   3. Merges hooks into .claude/settings.json, scripts into package.json, a stanza into
//      .gitignore, and a protocol section into CLAUDE.md / AGENTS.md (all marker/dedup guarded).
//   4. Generates the indexes and graph colors, then runs the validator to verify a clean install.

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const packageDir = dirname(fileURLToPath(import.meta.url));
const targetRoot = process.cwd();
const payloadDir = join(packageDir, "payload");
const fragmentsDir = join(packageDir, "fragments");
const today = new Date().toISOString().slice(0, 10);

const log = (m) => console.log(m);
const ok = (m) => console.log(`  ok   ${m}`);
const skip = (m) => console.log(`  skip ${m}`);

function loadJSON(p, fallback) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; }
}

// --- guards -----------------------------------------------------------------
if (!existsSync(payloadDir)) {
  console.error(`Cannot find payload/ next to install.mjs (looked in ${payloadDir}). Unzip the package first.`);
  process.exit(1);
}
if (basename(targetRoot) === "vault-system" && existsSync(join(targetRoot, "install.mjs"))) {
  console.error("You are running from inside the package folder. cd to your repo root and run: node vault-system/install.mjs");
  process.exit(1);
}

log(`vault-system installer`);
log(`  package: ${packageDir}`);
log(`  target : ${targetRoot}`);
log("");

const vaultDest = join(targetRoot, "docs", "vault", "Knowledge");
const freshVault = !existsSync(vaultDest);

// --- 1. machinery (overwrite) ----------------------------------------------
log("Machinery:");
cpSync(join(payloadDir, "scripts", "vault"), join(targetRoot, "scripts", "vault"), { recursive: true, force: true });
ok("scripts/vault/ (13 modules)");
cpSync(join(payloadDir, ".claude", "skills"), join(targetRoot, ".claude", "skills"), { recursive: true, force: true });
ok(".claude/skills/ (vault-author + 7 commands)");

// --- 2. vault skeleton (never clobber existing content) ---------------------
log("Vault skeleton:");
cpSync(join(payloadDir, "docs", "vault", "Knowledge"), vaultDest, { recursive: true, force: false, errorOnExist: false });
if (freshVault) {
  // stamp seed _meta nodes with today's date so they do not read as stale on day one
  const metaDir = join(vaultDest, "_meta");
  for (const f of readdirSync(metaDir).filter((x) => x.endsWith(".md"))) {
    const p = join(metaDir, f);
    writeFileSync(p, readFileSync(p, "utf8").replace(/^updated:.*$/m, `updated: ${today}`));
  }
  ok(`docs/vault/Knowledge/ (fresh skeleton, dated ${today})`);
} else {
  skip("docs/vault/Knowledge/ already exists (content preserved)");
}

// --- 3a. merge hooks into .claude/settings.json -----------------------------
log("Config merges:");
const hooksFrag = loadJSON(join(fragmentsDir, "settings.hooks.json"), { hooks: {} }).hooks;
const settingsPath = join(targetRoot, ".claude", "settings.json");
const settings = loadJSON(settingsPath, {});
settings.hooks = settings.hooks || {};
const sigOf = (entry) => {
  const h = (entry.hooks || [])[0] || {};
  return `${h.command || ""} ${(h.args || []).join(" ")}`;
};
let hookAdds = 0;
for (const ev of Object.keys(hooksFrag)) {
  settings.hooks[ev] = settings.hooks[ev] || [];
  for (const entry of hooksFrag[ev]) {
    if (!settings.hooks[ev].some((e) => sigOf(e) === sigOf(entry))) { settings.hooks[ev].push(entry); hookAdds++; }
  }
}
mkdirSync(dirname(settingsPath), { recursive: true });
writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
hookAdds ? ok(`.claude/settings.json (+${hookAdds} hook${hookAdds === 1 ? "" : "s"})`) : skip(".claude/settings.json hooks already present");

// --- 3b. merge scripts into package.json ------------------------------------
const scriptsFrag = loadJSON(join(fragmentsDir, "package.scripts.json"), {});
const pkgPath = join(targetRoot, "package.json");
const pkg = loadJSON(pkgPath, null);
if (pkg) {
  pkg.scripts = pkg.scripts || {};
  let added = 0;
  for (const [k, v] of Object.entries(scriptsFrag)) if (!(k in pkg.scripts)) { pkg.scripts[k] = v; added++; }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  added ? ok(`package.json (+${added} vault script${added === 1 ? "" : "s"})`) : skip("package.json vault scripts already present");
} else {
  writeFileSync(pkgPath, JSON.stringify({ scripts: scriptsFrag }, null, 2) + "\n");
  ok("package.json created with vault scripts");
}

// --- 3c. .gitignore stanza --------------------------------------------------
const giPath = join(targetRoot, ".gitignore");
const stanza = readFileSync(join(fragmentsDir, "gitignore-stanza.txt"), "utf8");
let gi = existsSync(giPath) ? readFileSync(giPath, "utf8") : "";
if (!gi.includes("docs/vault/Knowledge/.obsidian")) {
  gi = (gi.replace(/\s*$/, "") + "\n\n" + stanza).replace(/^\n+/, "");
  writeFileSync(giPath, gi);
  ok(".gitignore (+ Obsidian stanza)");
} else {
  skip(".gitignore stanza already present");
}

// --- 3d. CLAUDE.md / AGENTS.md sections -------------------------------------
function appendSection(file, fragFile) {
  const frag = readFileSync(join(fragmentsDir, fragFile), "utf8");
  const p = join(targetRoot, file);
  let cur = existsSync(p) ? readFileSync(p, "utf8") : "";
  if (cur.includes("<!-- vault-system:begin -->")) { skip(`${file} section already present`); return; }
  cur = cur.replace(/\s*$/, "");
  cur = (cur ? cur + "\n\n" : "") + frag;
  writeFileSync(p, cur);
  ok(`${file} (+ Vault Protocol)`);
}
appendSection("CLAUDE.md", "CLAUDE.md-vault-protocol.md");
appendSection("AGENTS.md", "AGENTS.md-pointer.md");

// --- 4. generate + verify ---------------------------------------------------
log("");
log("Generate + verify:");
// No shell: invoke the running Node binary directly with a fixed argument array.
function run(args) {
  try {
    const out = execFileSync(process.execPath, args, { cwd: targetRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: `${e.stdout || ""}${e.stderr || ""}`, code: e.status };
  }
}
const map = run(["scripts/vault/index.mjs"]);
map.ok ? ok(`/vault-map  ${(map.out || "").trim().split("\n").pop() || ""}`) : console.error(`  FAIL /vault-map\n${map.out}`);
const col = run(["scripts/vault/colorize.mjs"]);
col.ok ? ok("/vault-colorize") : console.error(`  FAIL /vault-colorize\n${col.out}`);
const lint = run(["scripts/vault/validate.mjs", "--all"]);
if (lint.ok) {
  ok("/vault-lint  clean (0 hard)");
} else if (lint.code === 1) {
  console.error(`  WARN /vault-lint reported issues:\n${(lint.out || "").split("\n").slice(-8).join("\n")}`);
} else {
  console.error(`  FAIL /vault-lint (exit ${lint.code})\n${lint.out}`);
}

// --- done -------------------------------------------------------------------
log("");
log("Done. The vault is wired in and empty.");
log("");
log("Next:");
log("  - To rename the vault from 'Knowledge' to your project: edit VAULT_ROOT in");
log("    scripts/vault/schema.mjs, then follow the find/replace table in INSTALL.md.");
log("  - To seed the vault from your PRD: open vault-system/docs/seed-from-prd.md and");
log("    follow it (or tell Claude: \"seed the vault from <path-to-PRD>\").");
log("  - Restart Claude Code so the SessionStart hook and the vault-* skills load.");
