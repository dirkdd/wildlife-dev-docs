# wildlife-vault Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the installer-based `vault-system/` package into a first-class Claude Code plugin `wildlife-vault`, distributed through a private `wildlife-ai` marketplace in this repo, with all machinery in the plugin and only per-project vault content scaffolded into consuming repos.

**Architecture:** Plugin-only distribution. Scripts live in the plugin and run via `${CLAUDE_PLUGIN_ROOT}`; hooks and slash-invocable skills call them, passing the consuming repo via `${CLAUDE_PROJECT_DIR}`. A committed `docs/vault/.vault.json` per repo carries `vaultRoot`, `vaultName`, and `domains`; a new `resolveVault(projectDir)` loader replaces the hardcoded `VAULT_ROOT`/`DOMAIN_WHITELIST` constants. The hooks fire globally, so every script no-ops fail-safe when no `.vault.json` exists. A new `/vault-init` skill scaffolds the vault skeleton + config + CLAUDE.md/AGENTS.md/.gitignore stanzas into a repo.

**Tech Stack:** Pure Node ESM (no deps), `node:test` for unit tests, Claude Code plugin format (`.claude-plugin/plugin.json`, `hooks/hooks.json`, `skills/`).

**Source of truth for existing code:** the current files under `vault-system/payload/`. Tasks copy them into `plugins/wildlife-vault/` and edit there. The old `vault-system/` dir is deleted only in the final task.

---

## File Structure

Created under `plugins/wildlife-vault/`:

- `.claude-plugin/plugin.json` — plugin manifest
- `hooks/hooks.json` — Pre/PostToolUse + SessionStart hooks (plugin-root paths)
- `scripts/vault/*.mjs` — the 13 modules, copied from payload and adapted
- `scripts/vault/config.mjs` — NEW: `resolveProjectDir` + `resolveVault` loader
- `skills/vault-*/SKILL.md` — 8 existing skills (prose updated) + `vault-init` (new)
- `skills/vault-author/templates/*.md` — copied verbatim
- `skeleton/Knowledge/**` — empty vault skeleton (copied from payload `docs/vault/Knowledge`)
- `skeleton/fragments/*` — CLAUDE.md / AGENTS.md / gitignore fragment text used by vault-init
- `README.md` — plugin readme

Created at repo root:

- `.claude-plugin/marketplace.json` — marketplace manifest

Test files:

- `plugins/wildlife-vault/test/config.test.mjs`
- `plugins/wildlife-vault/test/validate-guard.test.mjs`
- `plugins/wildlife-vault/test/e2e-scripts.test.mjs`

---

## Task 1: Scaffold plugin + marketplace manifests

**Files:**
- Create: `.claude-plugin/marketplace.json`
- Create: `plugins/wildlife-vault/.claude-plugin/plugin.json`

- [ ] **Step 1: Create the marketplace manifest**

Create `.claude-plugin/marketplace.json`:

```json
{
  "name": "wildlife-ai",
  "owner": {
    "name": "Wildlife AI",
    "email": "dirk@wildlifeai.co"
  },
  "plugins": [
    {
      "name": "wildlife-vault",
      "source": "./plugins/wildlife-vault",
      "description": "Agent-maintained, Obsidian-compatible knowledge vault for a code project: typed Markdown nodes, validation hooks, generated indexes."
    }
  ]
}
```

- [ ] **Step 2: Create the plugin manifest**

Create `plugins/wildlife-vault/.claude-plugin/plugin.json`:

```json
{
  "name": "wildlife-vault",
  "version": "0.1.0",
  "description": "Agent-maintained, Obsidian-compatible knowledge vault for a code project. Typed, validated Markdown nodes; enforcement hooks; generated three-tier indexes; zero runtime dependencies.",
  "author": {
    "name": "Wildlife AI",
    "email": "dirk@wildlifeai.co"
  },
  "keywords": ["documentation", "knowledge-base", "obsidian", "vault"]
}
```

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/marketplace.json plugins/wildlife-vault/.claude-plugin/plugin.json
git commit -m "feat(plugin): scaffold wildlife-vault plugin and wildlife-ai marketplace manifests"
```

---

## Task 2: Copy scripts + templates + skeleton into the plugin

This task moves the unchanged machinery into the plugin tree so later tasks edit it in place. No code changes yet.

**Files:**
- Create: `plugins/wildlife-vault/scripts/vault/` (copy of `vault-system/payload/scripts/vault/`)
- Create: `plugins/wildlife-vault/skills/` (copy of `vault-system/payload/.claude/skills/`)
- Create: `plugins/wildlife-vault/skeleton/Knowledge/` (copy of `vault-system/payload/docs/vault/Knowledge/`)
- Create: `plugins/wildlife-vault/skeleton/fragments/` (copy of `vault-system/fragments/` text files)

- [ ] **Step 1: Copy the script modules**

```bash
node -e "require('fs').cpSync('vault-system/payload/scripts/vault','plugins/wildlife-vault/scripts/vault',{recursive:true})"
```

- [ ] **Step 2: Copy the skills (8 folders)**

```bash
node -e "require('fs').cpSync('vault-system/payload/.claude/skills','plugins/wildlife-vault/skills',{recursive:true})"
```

- [ ] **Step 3: Copy the vault skeleton**

```bash
node -e "require('fs').cpSync('vault-system/payload/docs/vault/Knowledge','plugins/wildlife-vault/skeleton/Knowledge',{recursive:true})"
```

- [ ] **Step 4: Copy the fragment text files**

```bash
node -e "const fs=require('fs');fs.mkdirSync('plugins/wildlife-vault/skeleton/fragments',{recursive:true});for(const f of ['CLAUDE.md-vault-protocol.md','AGENTS.md-pointer.md','gitignore-stanza.txt'])fs.copyFileSync('vault-system/fragments/'+f,'plugins/wildlife-vault/skeleton/fragments/'+f)"
```

- [ ] **Step 5: Verify the tree**

Run: `node -e "console.log(require('fs').readdirSync('plugins/wildlife-vault/scripts/vault').length, require('fs').readdirSync('plugins/wildlife-vault/skills').length)"`
Expected: prints `13 8`

- [ ] **Step 6: Commit**

```bash
git add plugins/wildlife-vault
git commit -m "chore(plugin): copy scripts, skills, skeleton, and fragments into plugin tree"
```

---

## Task 3: Add the config resolver (keystone)

Introduces `resolveProjectDir` and `resolveVault`, the single mechanism that replaces `VAULT_ROOT`/`VAULT_NAME`/`DOMAIN_WHITELIST` constants with per-project config. TDD.

**Files:**
- Create: `plugins/wildlife-vault/scripts/vault/config.mjs`
- Test: `plugins/wildlife-vault/test/config.test.mjs`
- Modify: `plugins/wildlife-vault/scripts/vault/schema.mjs` (remove `VAULT_ROOT`/`VAULT_NAME` constants, keep `DOMAIN_WHITELIST` as the default only)

- [ ] **Step 1: Write the failing test**

Create `plugins/wildlife-vault/test/config.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveVault, resolveProjectDir } from "../scripts/vault/config.mjs";

function tmpProject(config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-cfg-"));
  if (config !== undefined) {
    fs.mkdirSync(path.join(dir, "docs", "vault"), { recursive: true });
    fs.writeFileSync(path.join(dir, "docs", "vault", ".vault.json"), JSON.stringify(config));
  }
  return dir;
}

test("returns null when no .vault.json exists (fail-safe no-op)", () => {
  const dir = tmpProject(undefined);
  assert.equal(resolveVault(dir), null);
});

test("resolves vaultRoot to an absolute path under the project", () => {
  const dir = tmpProject({ vaultRoot: "docs/vault/Knowledge", vaultName: "Knowledge" });
  const v = resolveVault(dir);
  assert.equal(v.vaultRootRel, "docs/vault/Knowledge");
  assert.equal(v.vaultRoot, path.join(dir, "docs", "vault", "Knowledge"));
  assert.equal(v.vaultName, "Knowledge");
  assert.deepEqual(v.domains, []);
});

test("derives vaultName from the path when omitted, and reads domains", () => {
  const dir = tmpProject({ vaultRoot: "docs/vault/Acme", domains: ["billing", "auth"] });
  const v = resolveVault(dir);
  assert.equal(v.vaultName, "Acme");
  assert.deepEqual(v.domains, ["billing", "auth"]);
});

test("resolveProjectDir honors --project-dir then CLAUDE_PROJECT_DIR", () => {
  assert.equal(resolveProjectDir(["node", "x", "--project-dir=/tmp/foo"]), path.resolve("/tmp/foo"));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/wildlife-vault/test/config.test.mjs`
Expected: FAIL — `Cannot find module .../config.mjs`

- [ ] **Step 3: Create the resolver**

Create `plugins/wildlife-vault/scripts/vault/config.mjs`:

```js
// scripts/vault/config.mjs
// Per-project vault configuration loader. Replaces the hardcoded VAULT_ROOT
// constant now that scripts are shared across projects via the plugin.
import * as fs from "node:fs";
import * as path from "node:path";

const DEFAULT_VAULT_ROOT = "docs/vault/Knowledge";

// Resolve which repo we are operating on: explicit --project-dir=, then the
// CLAUDE_PROJECT_DIR env the hooks/commands run under, then cwd.
export function resolveProjectDir(argv = process.argv) {
  const hit = argv.find((a) => a.startsWith("--project-dir="));
  if (hit) return path.resolve(hit.slice(hit.indexOf("=") + 1));
  if (process.env.CLAUDE_PROJECT_DIR) return path.resolve(process.env.CLAUDE_PROJECT_DIR);
  return process.cwd();
}

// Load docs/vault/.vault.json for a project. Returns null when the project has
// no vault configured — every CLI/hook treats null as "not my project, no-op".
export function resolveVault(projectDir = resolveProjectDir()) {
  const configPath = path.join(projectDir, "docs", "vault", ".vault.json");
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
  const vaultRootRel = cfg.vaultRoot || DEFAULT_VAULT_ROOT;
  return {
    projectDir,
    vaultRootRel,
    vaultRoot: path.join(projectDir, vaultRootRel),
    vaultName: cfg.vaultName || vaultRootRel.split("/").pop(),
    domains: Array.isArray(cfg.domains) ? cfg.domains : [],
  };
}
```

- [ ] **Step 4: Edit schema.mjs to drop the location constants**

In `plugins/wildlife-vault/scripts/vault/schema.mjs`, replace lines 4-12 (the `VAULT_ROOT`/`VAULT_NAME` block) with this note:

```js
// The vault location and display name are NO LONGER constants here. They are
// per-project and resolved at runtime from docs/vault/.vault.json by
// scripts/vault/config.mjs (resolveVault). This file holds only the
// project-independent frontmatter contract.
```

Leave `DOMAIN_WHITELIST` (lines 45-51) in place as the empty default; it is overridden per project by `.vault.json`'s `domains`. Update its comment to:

```js
// Default domain whitelist (empty). Per-project domains come from
// docs/vault/.vault.json ("domains": [...]); this constant is the fallback.
export const DOMAIN_WHITELIST = [];
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test plugins/wildlife-vault/test/config.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add plugins/wildlife-vault/scripts/vault/config.mjs plugins/wildlife-vault/scripts/vault/schema.mjs plugins/wildlife-vault/test/config.test.mjs
git commit -m "feat(plugin): add resolveVault config loader, drop VAULT_ROOT constant"
```

---

## Task 4: Thread the resolver through vault-index.mjs

`buildVaultIndex`/`listVaultMarkdown` must take an explicit root (no more `VAULT_ROOT` default), since callers now resolve it per project.

**Files:**
- Modify: `plugins/wildlife-vault/scripts/vault/vault-index.mjs`

- [ ] **Step 1: Remove the VAULT_ROOT import and default**

Replace the top of `vault-index.mjs` (lines 1-7) with:

```js
// scripts/vault/vault-index.mjs
import * as fs from "node:fs";
import * as path from "node:path";
import { parseFrontmatter } from "./parse-frontmatter.mjs";

export function listVaultMarkdown(root) {
  if (!root || !fs.existsSync(root)) return [];
```

Leave the rest of `listVaultMarkdown` unchanged.

- [ ] **Step 2: Make buildVaultIndex require root**

Change the signature on line 18 from `export function buildVaultIndex(root = VAULT_ROOT, exceptFile = null) {` to:

```js
export function buildVaultIndex(root, exceptFile = null) {
```

- [ ] **Step 3: Verify nothing else in the file references VAULT_ROOT**

Run: `node -e "const s=require('fs').readFileSync('plugins/wildlife-vault/scripts/vault/vault-index.mjs','utf8');process.exit(/VAULT_ROOT/.test(s)?1:0)"`
Expected: exit 0 (no matches)

- [ ] **Step 4: Commit**

```bash
git add plugins/wildlife-vault/scripts/vault/vault-index.mjs
git commit -m "refactor(plugin): vault-index takes explicit root, no VAULT_ROOT default"
```

---

## Task 5: Refactor validate.mjs (the hook entry, with the global no-op guard)

This is the most safety-critical change: the validator now fires in every project, so it must no-op when there is no vault and when the file is outside the vault.

**Files:**
- Modify: `plugins/wildlife-vault/scripts/vault/validate.mjs`
- Test: `plugins/wildlife-vault/test/validate-guard.test.mjs`

- [ ] **Step 1: Write the failing guard test**

Create `plugins/wildlife-vault/test/validate-guard.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { isVaultFile } from "../scripts/vault/validate.mjs";

const ROOT = "/repo/docs/vault/Knowledge";

test("file under the vault root is a vault file", () => {
  assert.equal(isVaultFile(ROOT, "/repo/docs/vault/Knowledge/concepts/foo.md"), true);
});

test("file outside the vault root is not", () => {
  assert.equal(isVaultFile(ROOT, "/repo/src/index.md"), false);
});

test("_raw staging files are excluded", () => {
  assert.equal(isVaultFile(ROOT, "/repo/docs/vault/Knowledge/_raw/draft.md"), false);
});

test("non-markdown is excluded", () => {
  assert.equal(isVaultFile(ROOT, "/repo/docs/vault/Knowledge/concepts/foo.txt"), false);
});

test("null vault root (no config) excludes everything", () => {
  assert.equal(isVaultFile(null, "/repo/docs/vault/Knowledge/concepts/foo.md"), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/wildlife-vault/test/validate-guard.test.mjs`
Expected: FAIL — `isVaultFile` is not exported / signature mismatch.

- [ ] **Step 3: Update imports and the path guard**

In `validate.mjs`, replace line 5 `import { VAULT_ROOT } from "./schema.mjs";` with:

```js
import { resolveVault, resolveProjectDir } from "./config.mjs";
```

Replace the `isVaultFile` function (lines 29-33) with an exported, root-aware version:

```js
export function isVaultFile(absVaultRoot, p) {
  if (!absVaultRoot || !p || !p.endsWith(".md")) return false;
  const norm = path.resolve(p).replace(/\\/g, "/");
  const root = absVaultRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  if (norm !== root && !norm.startsWith(root + "/")) return false;
  return !norm.slice(root.length).split("/").includes("_raw");
}
```

- [ ] **Step 4: Resolve the vault inside main() and guard both modes**

In `main()`, immediately after `const now = Date.now();` (line 75), add:

```js
  const projectDir = resolveProjectDir();
  const vault = resolveVault(projectDir);
  if (!vault) process.exit(0); // no vault configured in this project -> no-op
```

In the `--all` branch, replace every bare `VAULT_ROOT` with `vault.vaultRoot`:
- line 78: `const { byId, nodes: rawNodes } = buildVaultIndex(vault.vaultRoot);`
- line 81: `for (const filePath of listVaultMarkdown(vault.vaultRoot)) {`
- line 93: `const byTypeFile = path.join(vault.vaultRoot, "_meta", "index-by-type.md");`
- line 98: `const metaDir = path.join(vault.vaultRoot, "_meta");`

In the hook-mode branch, replace line 126 with the root-aware guard:

```js
  if (!isVaultFile(vault.vaultRoot, filePath)) process.exit(0); // PATH GUARD
```

And replace line 138 with:

```js
  const { byId } = buildVaultIndex(vault.vaultRoot, filePath);
```

- [ ] **Step 5: Run the guard test to verify it passes**

Run: `node --test plugins/wildlife-vault/test/validate-guard.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 6: Confirm no stray VAULT_ROOT remains**

Run: `node -e "const s=require('fs').readFileSync('plugins/wildlife-vault/scripts/vault/validate.mjs','utf8');process.exit(/VAULT_ROOT/.test(s)?1:0)"`
Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add plugins/wildlife-vault/scripts/vault/validate.mjs plugins/wildlife-vault/test/validate-guard.test.mjs
git commit -m "refactor(plugin): validate.mjs resolves vault per project, no-ops when unconfigured"
```

---

## Task 6: Refactor index.mjs, colorize.mjs, status.mjs, session-context.mjs, link-scan.mjs

Each CLI entry resolves the vault at the top of `main()` and threads `vault.vaultRoot` / `vault.vaultName` into the helpers. Each no-ops when `resolveVault` returns null. `link-scan.mjs` calls `buildVaultIndex()` with no root today (line 28); after Task 4 made root required it would silently scan zero nodes, so it must be refactored here too.

**Files:**
- Modify: `plugins/wildlife-vault/scripts/vault/index.mjs`
- Modify: `plugins/wildlife-vault/scripts/vault/colorize.mjs`
- Modify: `plugins/wildlife-vault/scripts/vault/status.mjs`
- Modify: `plugins/wildlife-vault/scripts/vault/session-context.mjs`
- Modify: `plugins/wildlife-vault/scripts/vault/link-scan.mjs`

- [ ] **Step 1: index.mjs — imports**

Replace the import block (lines 4-7) so it no longer pulls `VAULT_ROOT, VAULT_NAME` from schema and adds the config loader:

```js
import {
  TYPES, DOC_CLASSES, STATUSES, PROVENANCES, CATEGORY_ORDER,
  CATEGORY_DIRS, REL_KEYS,
} from "./schema.mjs";
import { resolveVault } from "./config.mjs";
import { buildVaultIndex } from "./vault-index.mjs";
import { replaceMarkedRegion } from "./marker-region.mjs";
import { nodeRow, domainsOf, TABLE_HEADER } from "./node-row.mjs";
```

(`DOMAIN_WHITELIST` was imported but unused; drop it. `VAULT_NAME` moves to a parameter.)

- [ ] **Step 2: index.mjs — make DOMAIN_TEMPLATE take vaultName**

Change `const DOMAIN_TEMPLATE = (slug) => \`...` (line 92) to `const DOMAIN_TEMPLATE = (slug, vaultName) => \`...` and change the title line inside it (line 94) from `title: "${VAULT_NAME} Vault — ${slug} domain"` to `title: "${vaultName} Vault — ${slug} domain"`.

- [ ] **Step 3: index.mjs — resolve vault in main()**

Replace `main()` (lines 115-140) with:

```js
export function main() {
  const vault = resolveVault();
  if (!vault) return; // no vault configured -> no-op
  const meta = path.join(vault.vaultRoot, "_meta");
  const nodes = buildVaultIndex(vault.vaultRoot).nodes.map((n) => n.data);

  // index-by-type
  writeMarked(path.join(meta, "index-by-type.md"), renderByType(nodes));

  // per-domain sub-indexes for populated domains
  const populated = new Set();
  for (const n of nodes) for (const d of domainsOf(n)) populated.add(d);
  const subIndexIds = ["index-by-type"];
  for (const slug of [...populated].sort()) {
    const file = path.join(meta, `index-domain-${slug}.md`);
    if (!fs.existsSync(file)) fs.writeFileSync(file, DOMAIN_TEMPLATE(slug, vault.vaultName), "utf-8");
    writeMarked(file, renderDomainCoverage(slug, nodes));
    subIndexIds.push(`index-domain-${slug}`);
  }

  // router + schema mirror
  writeMarked(path.join(meta, "index.md"), renderRouterCatalog(nodes, subIndexIds));
  writeMarked(path.join(meta, "schema.md"), renderSchemaMirror());

  process.stderr.write(`vault:map — ${nodes.length} nodes, ${populated.size} domains, ${subIndexIds.length} sub-indexes\n`);
}
```

- [ ] **Step 4: colorize.mjs — resolve vault**

Replace line 4 `import { VAULT_ROOT, DOC_CLASSES } from "./schema.mjs";` with:

```js
import { DOC_CLASSES } from "./schema.mjs";
import { resolveVault } from "./config.mjs";
```

Replace `main()` (lines 23-32) start so it resolves the vault and uses its root:

```js
export function main() {
  const vault = resolveVault();
  if (!vault) return; // no vault configured -> no-op
  const file = path.join(vault.vaultRoot, ".obsidian", "graph.json");
  const cfg = JSON.parse(fs.readFileSync(file, "utf-8"));
  cfg.colorGroups = buildColorGroups();
  cfg.showTags = false;
  cfg.showArrow = true;
  cfg.hideUnresolved = false;
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
  process.stderr.write(`vault:colorize — ${cfg.colorGroups.length} doc_class color groups written\n`);
}
```

- [ ] **Step 5: status.mjs — resolve vault**

Replace line 5 `import { VAULT_ROOT } from "./schema.mjs";` with:

```js
import { resolveVault } from "./config.mjs";
```

In `main()`, replace lines 39-42 with:

```js
  const vault = resolveVault();
  if (!vault) return; // no vault configured -> no-op
  // buildVaultIndex returns { byId, nodes: [{ filePath, data }] }; map to bare data objects.
  const { nodes: rawNodes } = buildVaultIndex(vault.vaultRoot);
  const nodes = rawNodes.map((n) => n.data);
  const manifestPath = path.join(vault.vaultRoot, "_meta", ".manifest.json");
```

- [ ] **Step 6: session-context.mjs — resolve vault and parameterize renderL0**

Replace line 4 `import { VAULT_ROOT, VAULT_NAME } from "./schema.mjs";` with:

```js
import { resolveVault } from "./config.mjs";
```

Change `renderL0(nodes)` (line 8) to `renderL0(nodes, vaultRootRel, vaultName)` and inside it replace `VAULT_NAME` with `vaultName` and `VAULT_ROOT` with `vaultRootRel` (the relative path reads better in the blurb). The three references are on lines 13-14.

Replace `main()` (lines 20-25) with:

```js
export function main() {
  const vault = resolveVault();
  if (!vault) return; // no vault in this project -> stay silent
  const { nodes } = buildVaultIndex(vault.vaultRoot);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: renderL0(nodes.map((n) => n.data), vault.vaultRootRel, vault.vaultName),
    },
  }));
}
```

- [ ] **Step 7: link-scan.mjs — resolve vault and pass root to buildVaultIndex**

In `link-scan.mjs`, add the config import after line 4 (`import { buildVaultIndex } from "./vault-index.mjs";`):

```js
import { resolveVault } from "./config.mjs";
```

Replace the top of `main()` (lines 26-28) with:

```js
export function main() {
  const vault = resolveVault();
  if (!vault) return; // no vault configured -> no-op
  // buildVaultIndex returns { byId, nodes: [{ filePath, data }] }; map to bare data objects.
  const { nodes: rawNodes } = buildVaultIndex(vault.vaultRoot);
```

Leave the rest of `main()` unchanged.

- [ ] **Step 8: Confirm no stray VAULT_ROOT / VAULT_NAME remain in these five files**

Run: `node -e "const fs=require('fs');const bad=['index','colorize','status','session-context','link-scan'].filter(f=>/VAULT_ROOT|VAULT_NAME/.test(fs.readFileSync('plugins/wildlife-vault/scripts/vault/'+f+'.mjs','utf8')));console.log(bad);process.exit(bad.length?1:0)"`
Expected: prints `[]`, exit 0

- [ ] **Step 9: Commit**

```bash
git add plugins/wildlife-vault/scripts/vault/index.mjs plugins/wildlife-vault/scripts/vault/colorize.mjs plugins/wildlife-vault/scripts/vault/status.mjs plugins/wildlife-vault/scripts/vault/session-context.mjs plugins/wildlife-vault/scripts/vault/link-scan.mjs
git commit -m "refactor(plugin): index/colorize/status/session-context/link-scan resolve vault per project"
```

---

## Task 7: End-to-end script test against a temp project

Proves the refactored scripts produce a clean, indexed vault when pointed at a real project via `--project-dir`, and that they no-op on a project with no vault.

**Files:**
- Test: `plugins/wildlife-vault/test/e2e-scripts.test.mjs`

- [ ] **Step 1: Write the e2e test**

Create `plugins/wildlife-vault/test/e2e-scripts.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

const SCRIPTS = path.resolve("plugins/wildlife-vault/scripts/vault");
const SKELETON = path.resolve("plugins/wildlife-vault/skeleton/Knowledge");

function run(script, projectDir, extra = []) {
  try {
    const out = execFileSync(process.execPath,
      [path.join(SCRIPTS, script), `--project-dir=${projectDir}`, ...extra],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: `${e.stdout || ""}${e.stderr || ""}` };
  }
}

function freshProjectWithVault() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-e2e-"));
  fs.cpSync(SKELETON, path.join(dir, "docs", "vault", "Knowledge"), { recursive: true });
  fs.mkdirSync(path.join(dir, "docs", "vault"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs", "vault", ".vault.json"),
    JSON.stringify({ vaultRoot: "docs/vault/Knowledge", vaultName: "Knowledge", domains: [] }));
  return dir;
}

test("map + colorize + lint run clean on a fresh scaffolded vault", () => {
  const dir = freshProjectWithVault();
  assert.equal(run("index.mjs", dir).code, 0, "vault:map should exit 0");
  assert.equal(run("colorize.mjs", dir).code, 0, "vault:colorize should exit 0");
  const lint = run("validate.mjs", dir, ["--all"]);
  assert.equal(lint.code, 0, `vault:lint should be clean:\n${lint.out}`);
  assert.match(lint.out, /0 hard/);
});

test("scripts no-op (exit 0, no throw) on a project with no .vault.json", () => {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "vault-bare-"));
  assert.equal(run("index.mjs", bare).code, 0);
  assert.equal(run("colorize.mjs", bare).code, 0);
  assert.equal(run("validate.mjs", bare, ["--all"]).code, 0);
  assert.equal(run("session-context.mjs", bare).code, 0);
});

test("session-context emits a pointer when a vault exists", () => {
  const dir = freshProjectWithVault();
  const r = run("session-context.mjs", dir);
  assert.equal(r.code, 0);
  assert.match(r.out, /Knowledge vault/);
});
```

- [ ] **Step 2: Run the e2e test**

Run: `node --test plugins/wildlife-vault/test/e2e-scripts.test.mjs`
Expected: PASS (3 tests). If `vault:lint` reports drift, that means the skeleton's committed `_meta` indexes differ from a fresh `vault:map`; re-run is covered because the test runs map before lint.

- [ ] **Step 3: Run the whole test suite**

Run: `node --test "plugins/wildlife-vault/test/*.test.mjs"`
Expected: PASS (all tests across the three files)

- [ ] **Step 4: Commit**

```bash
git add plugins/wildlife-vault/test/e2e-scripts.test.mjs
git commit -m "test(plugin): end-to-end script run against temp project + no-vault no-op"
```

---

## Task 8: Author the hooks manifest

**Files:**
- Create: `plugins/wildlife-vault/hooks/hooks.json`

- [ ] **Step 1: Write hooks.json**

Create `plugins/wildlife-vault/hooks/hooks.json`. Paths use `${CLAUDE_PLUGIN_ROOT}` (the plugin cache) for the script and pass the consuming repo as `--project-dir=${CLAUDE_PROJECT_DIR}`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": [
              "${CLAUDE_PLUGIN_ROOT}/scripts/vault/validate.mjs",
              "--mode=pre",
              "--project-dir=${CLAUDE_PROJECT_DIR}"
            ],
            "timeout": 30,
            "statusMessage": "Validating vault node..."
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": [
              "${CLAUDE_PLUGIN_ROOT}/scripts/vault/validate.mjs",
              "--mode=post",
              "--project-dir=${CLAUDE_PROJECT_DIR}"
            ],
            "timeout": 60,
            "statusMessage": "Validating vault node (re-read)..."
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": [
              "${CLAUDE_PLUGIN_ROOT}/scripts/vault/session-context.mjs",
              "--project-dir=${CLAUDE_PROJECT_DIR}"
            ],
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('plugins/wildlife-vault/hooks/hooks.json','utf8'));console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add plugins/wildlife-vault/hooks/hooks.json
git commit -m "feat(plugin): hooks.json wiring Pre/PostToolUse + SessionStart via plugin root"
```

---

## Task 9: Create the vault-init skill

The skill that scaffolds the vault into a consuming repo (replaces install.mjs). It reads the bundled skeleton + fragments from `${CLAUDE_PLUGIN_ROOT}` and writes into `${CLAUDE_PROJECT_DIR}`.

**Files:**
- Create: `plugins/wildlife-vault/skills/vault-init/SKILL.md`
- Create: `plugins/wildlife-vault/scripts/vault/init.mjs`
- Test: extend `plugins/wildlife-vault/test/e2e-scripts.test.mjs`

- [ ] **Step 1: Write the failing init test**

Append to `plugins/wildlife-vault/test/e2e-scripts.test.mjs`:

```js
test("init.mjs scaffolds a vault, writes .vault.json, and lints clean", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-init-"));
  // init.mjs lives in SCRIPTS and reads skeleton/fragments relative to itself
  const r = run("init.mjs", dir, ["--name=Knowledge"]);
  assert.equal(r.code, 0, r.out);
  assert.ok(fs.existsSync(path.join(dir, "docs", "vault", ".vault.json")), ".vault.json written");
  assert.ok(fs.existsSync(path.join(dir, "docs", "vault", "Knowledge", "_meta", "index.md")), "router exists");
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, "docs", "vault", ".vault.json"), "utf8"));
  assert.equal(cfg.vaultName, "Knowledge");
  const lint = run("validate.mjs", dir, ["--all"]);
  assert.equal(lint.code, 0, lint.out);
});

test("init.mjs is idempotent and never clobbers existing vault content", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-init2-"));
  run("init.mjs", dir, ["--name=Knowledge"]);
  const marker = path.join(dir, "docs", "vault", "Knowledge", "concepts", "keep.md");
  fs.writeFileSync(marker, "preserve me");
  const r2 = run("init.mjs", dir, ["--name=Knowledge"]);
  assert.equal(r2.code, 0);
  assert.equal(fs.readFileSync(marker, "utf8"), "preserve me", "existing content preserved");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test plugins/wildlife-vault/test/e2e-scripts.test.mjs`
Expected: FAIL — `init.mjs` does not exist.

- [ ] **Step 3: Write init.mjs**

Create `plugins/wildlife-vault/scripts/vault/init.mjs`:

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test plugins/wildlife-vault/test/e2e-scripts.test.mjs`
Expected: PASS (all tests including the two new init tests).

- [ ] **Step 5: Write the vault-init SKILL.md**

Create `plugins/wildlife-vault/skills/vault-init/SKILL.md`:

```markdown
---
name: vault-init
description: Initialize the wildlife-vault knowledge base in this repo — scaffold the empty vault, write its config, and wire CLAUDE.md/AGENTS.md/.gitignore. Use when setting up the vault in a new project, or when asked to install or initialize the vault.
allowed-tools: Bash, Read, Edit
---
Initialize the vault in the current repo. This is the one-time setup that replaces the old installer.

1. Decide the vault name with the user (default `Knowledge`). The vault will live at `docs/vault/<name>/`.

2. Run the initializer (it reads the bundled skeleton from the plugin and writes into this repo):

   `node "${CLAUDE_PLUGIN_ROOT}/scripts/vault/init.mjs" --project-dir="${CLAUDE_PROJECT_DIR}" --name=<name>`

   It is idempotent: it never overwrites existing vault content, and the CLAUDE.md / AGENTS.md / .gitignore additions are marker-guarded.

3. Report what it created: the vault folder, `docs/vault/.vault.json` (the per-project config: `vaultRoot`, `vaultName`, `domains`), the CLAUDE.md Vault Protocol section, and the .gitignore Obsidian stanza.

4. Tell the user to **restart Claude Code** so the SessionStart hook picks up the new vault, then to seed it from their PRD (`seed the vault from <path>`), and that `/vault-new`, `/vault-lint`, `/vault-map`, `/vault-status`, `/vault-link`, `/vault-colorize`, `/vault-tags` are now available.

5. To rename or relocate the vault later, edit `docs/vault/.vault.json` (and move the folder), then run `/vault-map`.
```

- [ ] **Step 6: Commit**

```bash
git add plugins/wildlife-vault/scripts/vault/init.mjs plugins/wildlife-vault/skills/vault-init/SKILL.md plugins/wildlife-vault/test/e2e-scripts.test.mjs
git commit -m "feat(plugin): add vault-init skill + init.mjs scaffolder (replaces installer)"
```

---

## Task 10: Update the operator skills' prose for plugin paths

The 8 existing skills tell Claude to run `npm run vault:*` or `node scripts/vault/...` from the repo root. Those paths no longer exist in the consuming repo. Update each to invoke the plugin-root script with the project-dir arg.

**Files:**
- Modify: `plugins/wildlife-vault/skills/vault-lint/SKILL.md`
- Modify: `plugins/wildlife-vault/skills/vault-map/SKILL.md`
- Modify: `plugins/wildlife-vault/skills/vault-colorize/SKILL.md`
- Modify: `plugins/wildlife-vault/skills/vault-status/SKILL.md`
- Modify: `plugins/wildlife-vault/skills/vault-link/SKILL.md`
- Modify: `plugins/wildlife-vault/skills/vault-tags/SKILL.md`
- Modify: `plugins/wildlife-vault/skills/vault-new/SKILL.md`
- Modify: `plugins/wildlife-vault/skills/vault-author/SKILL.md`

The invocation template for every script call is:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/vault/<script>.mjs" --project-dir="${CLAUDE_PROJECT_DIR}" [extra args]
```

- [ ] **Step 1: vault-lint**

In `vault-lint/SKILL.md`, replace the body line `Run \`npm run vault:lint\` from the repo root.` with:

```
Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/vault/validate.mjs" --all --project-dir="${CLAUDE_PROJECT_DIR}"`. It validates every node and the generated indexes.
```

- [ ] **Step 2: vault-map**

In `vault-map/SKILL.md`, replace `Run \`npm run vault:map\` from the repo root.` with:

```
Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/vault/index.mjs" --project-dir="${CLAUDE_PROJECT_DIR}"`.
```

- [ ] **Step 3: vault-colorize**

In `vault-colorize/SKILL.md`, replace `Run \`npm run vault:colorize\` from the repo root.` with:

```
Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/vault/colorize.mjs" --project-dir="${CLAUDE_PROJECT_DIR}"`.
```

Also change the phrase `from the \`DOC_CLASSES\` enum in \`scripts/vault/schema.mjs\`` to `from the \`DOC_CLASSES\` enum in the plugin's \`scripts/vault/schema.mjs\``.

- [ ] **Step 4: vault-status**

In `vault-status/SKILL.md`, replace `Run \`npm run vault:status\` from the repo root.` with:

```
Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/vault/status.mjs" --project-dir="${CLAUDE_PROJECT_DIR}"`.
```

- [ ] **Step 5: vault-link**

In `vault-link/SKILL.md`, replace `Run \`node scripts/vault/link-scan.mjs\` from the repo root.` with:

```
Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/vault/link-scan.mjs" --project-dir="${CLAUDE_PROJECT_DIR}"`.
```

(`link-scan.mjs` itself was already refactored to resolve the vault in Task 6 Step 7.)

- [ ] **Step 6: vault-tags — repoint config references to .vault.json**

In `vault-tags/SKILL.md`:
- Replace `Run \`npm run vault:lint\` from the repo root and filter` with `Run the vault-lint skill (or \`node "${CLAUDE_PLUGIN_ROOT}/scripts/vault/validate.mjs" --all --project-dir="${CLAUDE_PROJECT_DIR}"\`) and filter`.
- Replace `should be added to \`DOMAIN_WHITELIST\` in \`scripts/vault/schema.mjs\`` with `should be added to the \`domains\` array in \`docs/vault/.vault.json\``.
- Replace the final-paragraph sentence `Updates to the whitelist go in \`scripts/vault/schema.mjs\` (\`DOMAIN_WHITELIST\`, \`TAG_NAMESPACES\`); taxonomy.md is the human-readable mirror.` with `The per-project domain whitelist lives in \`docs/vault/.vault.json\` (\`domains\`); \`TAG_NAMESPACES\` is fixed in the plugin's \`scripts/vault/schema.mjs\`. \`taxonomy.md\` is the human-readable mirror.`

- [ ] **Step 7: vault-new — repoint schema.mjs reference**

In `vault-new/SKILL.md`, change `Derive the target folder from \`CATEGORY_DIRS\` in \`scripts/vault/schema.mjs\`:` to `Derive the target folder from \`CATEGORY_DIRS\` (in the plugin's \`scripts/vault/schema.mjs\`):`. The folder list and all `docs/vault/Knowledge/...` example paths stay as written (they illustrate the default name; the real root is whatever `.vault.json` says). Add one line after the folder list:

```
   (If this repo's `docs/vault/.vault.json` sets a different `vaultRoot`, use that root in place of `docs/vault/Knowledge`.)
```

Also change step 4's `Read \`.claude/skills/vault-author/templates/<type>.md\`` to `Read \`${CLAUDE_PLUGIN_ROOT}/skills/vault-author/templates/<type>.md\``.

- [ ] **Step 8: vault-author — repoint schema + templates references**

In `vault-author/SKILL.md`:
- Step 1: change `Read \`templates/<type>.md\`.` to `Read \`${CLAUDE_PLUGIN_ROOT}/skills/vault-author/templates/<type>.md\`.`
- Step 2: change `see [[schema-spec]] / \`scripts/vault/schema.mjs\`` to `see [[schema-spec]] / the plugin's \`scripts/vault/schema.mjs\``.
- Step 6: change `run \`/vault-map\`` (leave as the slash command — that still works).

- [ ] **Step 9: Verify no skill still references npm or repo-root scripts**

Run: `node -e "const fs=require('fs'),cp=require('child_process');const hits=cp.execSync('grep -rln \"npm run vault\\|node scripts/vault\" plugins/wildlife-vault/skills || true').toString().trim();console.log(hits||'clean');process.exit(hits?1:0)"`
Expected: prints `clean`, exit 0

- [ ] **Step 10: Commit**

```bash
git add plugins/wildlife-vault/skills
git commit -m "docs(plugin): repoint operator skills to plugin-root scripts and .vault.json config"
```

---

## Task 11: Plugin README and repo README

**Files:**
- Create: `plugins/wildlife-vault/README.md`
- Modify/Create: repo-root `README.md`

- [ ] **Step 1: Write the plugin README**

Create `plugins/wildlife-vault/README.md`:

```markdown
# wildlife-vault

A drop-in, agent-maintained knowledge base for a code project, packaged as a Claude Code plugin. It gives Claude a navigable second brain: a small, typed, validated set of Markdown nodes it reads before touching code and writes back to after learning something durable. Obsidian-compatible, enforced by hooks, generated indexes, zero runtime dependencies (pure Node).

## Install

```
/plugin marketplace add wildlife-ai/wildlife-dev-docs
/plugin install wildlife-vault@wildlife-ai
```

Then, inside any repo where you want a vault:

```
/vault-init
```

Restart Claude Code so the SessionStart hook and `vault-*` skills load.

## What you get

- A frontmatter contract every node obeys, enforced by a validator hook.
- Pre/PostToolUse hooks that block malformed vault writes; a SessionStart hook that injects a vault pointer.
- The `vault-author` skill plus operator skills: `/vault-init`, `/vault-new`, `/vault-lint`, `/vault-map`, `/vault-status`, `/vault-link`, `/vault-colorize`, `/vault-tags`.
- A three-tier generated index and an Obsidian graph colored by document class.

## Per-project config

`/vault-init` writes `docs/vault/.vault.json` holding `vaultRoot`, `vaultName`, and `domains`. Edit it (and move the folder) to rename or relocate the vault, then run `/vault-map`.

## Requirements

- Node 18+ (uses `fs.cpSync`).
- Claude Code (for skills and hooks).
- Optional: Obsidian 1.4+ to browse the graph.
```

- [ ] **Step 2: Write the repo README**

Create repo-root `README.md`:

```markdown
# wildlife-dev-docs

Private Claude Code marketplace (`wildlife-ai`) hosting the **wildlife-vault** plugin — an agent-maintained, Obsidian-compatible knowledge vault for code projects.

## Use it

```
/plugin marketplace add wildlife-ai/wildlife-dev-docs
/plugin install wildlife-vault@wildlife-ai
```

The plugin lives in [`plugins/wildlife-vault/`](plugins/wildlife-vault/). See its README for usage. Design and implementation history are under `docs/superpowers/`.
```

- [ ] **Step 3: Commit**

```bash
git add plugins/wildlife-vault/README.md README.md
git commit -m "docs: add plugin README and marketplace repo README"
```

---

## Task 12: Local install + manual end-to-end verification

Automated tests cover the scripts; this task verifies the plugin actually loads in Claude Code (hooks + skills) — which cannot be unit-tested.

**Files:** none (manual verification)

- [ ] **Step 1: Add the local marketplace**

In Claude Code: `/plugin marketplace add C:\Users\dirkd\OneDrive\Desktop\GitHub\wildlife-dev-docs`
Expected: marketplace `wildlife-ai` appears with one plugin `wildlife-vault`.

- [ ] **Step 2: Install and restart**

`/plugin install wildlife-vault@wildlife-ai`, then restart Claude Code.
Expected: `/vault-init`, `/vault-new`, `/vault-lint`, etc. appear in the skill list.

- [ ] **Step 3: Init in a throwaway repo**

Create an empty test repo, open it in Claude Code, run `/vault-init`.
Expected: `docs/vault/Knowledge/` scaffolded, `docs/vault/.vault.json` written, CLAUDE.md + .gitignore updated. Restart.

- [ ] **Step 4: SessionStart pointer fires**

After restart in the test repo, confirm the session context includes the "Knowledge vault (agent knowledge base) is at docs/vault/Knowledge/" pointer.

- [ ] **Step 5: Validation hook gates vault writes**

Run `/vault-new concept "Test Concept"`. Author it. Then hand-edit the node to remove a required field (e.g. delete the `summary:` line) and save.
Expected: PreToolUse blocks the write with `VAULT HARD BLOCK: ...`. Restore the field; the write succeeds.

- [ ] **Step 6: Hook no-ops outside the vault**

Edit a non-vault file (e.g. `src/foo.js`) in the same repo.
Expected: no vault validation message; write succeeds normally.

- [ ] **Step 7: Operators work**

Run `/vault-map`, `/vault-lint` (expect `0 hard`), `/vault-colorize`.
Expected: all succeed and report counts.

- [ ] **Step 8: A repo with no vault stays silent**

Open a different repo with no `docs/vault/.vault.json`. Restart.
Expected: no SessionStart vault pointer; editing files triggers no vault hook output.

- [ ] **Step 9: Record results**

If any step fails, fix the underlying script/hook/skill and re-run the affected automated test before re-verifying. Do not proceed to Task 13 until all nine steps pass.

---

## Task 13: Remove the old installer package

Only after Task 12 fully passes.

**Files:**
- Delete: `vault-system/`

- [ ] **Step 1: Delete the old package**

```bash
git rm -r vault-system
```

- [ ] **Step 2: Confirm nothing references it**

Run: `node -e "const cp=require('child_process');const h=cp.execSync('grep -rln vault-system --include=*.md --include=*.json --include=*.mjs . || true').toString().trim();console.log(h||'clean')"`
Expected: `clean` (the spec/plan under docs/superpowers may mention it historically; that is fine — review and ignore doc-history matches).

- [ ] **Step 3: Final full test run**

Run: `node --test "plugins/wildlife-vault/test/*.test.mjs"`
Expected: PASS (all tests).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove legacy vault-system installer (superseded by wildlife-vault plugin)"
```

---

## Notes for the implementer

- **`new Date()` in scripts:** `index.mjs` (`DOMAIN_TEMPLATE`) and `init.mjs` call `new Date()`. That is fine in plugin scripts (they are normal Node processes, unlike workflow scripts). No change needed.
- **CRLF:** this repo is on Windows; Git may warn about LF→CRLF. Harmless. Scripts already normalize `\r\n` where it matters (`index.mjs` `writeMarked`).
- **Do not weaken the validator** to make a check pass; fix the node or the index.
- **Pure helpers** not listed in Tasks 4-6 (`marker-region.mjs`, `node-row.mjs`, `parse-frontmatter.mjs`, `passes.mjs`, `index-drift.mjs`) do not import `VAULT_ROOT` or call `buildVaultIndex`/`listVaultMarkdown` with no root, per the audit, so they need no change. If a future audit finds one that does, apply the resolve-at-main pattern.
```
