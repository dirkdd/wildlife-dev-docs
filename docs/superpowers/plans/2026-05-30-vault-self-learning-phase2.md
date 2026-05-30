# Vault Self-Learning — Phase 2 (Harvest & Evolve) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the harvest-and-evolve half of the self-learning loop: `/vault-learnings` (a project-side export that prints a sanitized, copy-paste digest of captured learning nodes and stamps them harvested) and `/vault-evolve` (a plugin-repo skill that turns a pasted digest into concrete, human-approved plugin-change proposals).

**Architecture:** `learnings-export.mjs` selects `type: learning` nodes with `learning_status: proposed` (via `resolveVault` + `parseFrontmatter`), composes a Markdown digest from the harvestable payload (everything except the *In-project evidence* section), annotates likely-proprietary signals as warnings, prints to stdout, and flips each exported node `proposed → harvested` (unless `--dry-run`). The pure helpers (`stripEvidence`, `proprietarySignals`, `composeDigest`, `stampHarvested`) are unit-tested. `/vault-evolve` is an authored skill (no script) that proposes edits per `learning_kind`. Fail-safe no-op when no vault.

**Tech Stack:** Pure Node ESM, `node:test`, Claude Code plugin format. Reuses `config.mjs` (`resolveVault`/`resolveProjectDir`), `vault-index.mjs` (`buildVaultIndex`), `parse-frontmatter.mjs` (`parseFrontmatter`).

**Validator/parse facts confirmed:** `parseFrontmatter(raw)` returns `{ ok, data, raw, body }`; `data` is flat (so `data.type`, `data.learning_status` are directly readable); `body` is the markdown after the closing fence. Frontmatter inline scalar fields like `learning_status: proposed` are single-line, so a regex inline-replace (same approach as `add-class-tags.mjs`) safely flips the value.

**Source of truth:** `docs/superpowers/specs/2026-05-30-vault-self-learning-phase2-design.md`.

**Branch:** continue on `feat/wildlife-vault-plugin`.

---

## File Structure

- Create: `plugins/wildlife-vault/scripts/vault/learnings-export.mjs` — selection, sanitization, digest composition, lifecycle stamping, CLI.
- Create: `plugins/wildlife-vault/skills/vault-learnings/SKILL.md` — surfaces the export command.
- Create: `plugins/wildlife-vault/skills/vault-evolve/SKILL.md` — the plugin-repo reasoning procedure (no script).
- Test: `plugins/wildlife-vault/test/learnings-export.test.mjs` — unit tests for the pure helpers.
- Test: additions to `plugins/wildlife-vault/test/e2e-scripts.test.mjs` — end-to-end export against a temp project.

---

## Task 1: The export pure helpers (sanitization + digest + stamping)

All four helpers are pure/string-level and independently testable. TDD.

**Files:**
- Create: `plugins/wildlife-vault/scripts/vault/learnings-export.mjs`
- Test: `plugins/wildlife-vault/test/learnings-export.test.mjs`

- [ ] **Step 1: Write the failing unit tests**

Create `plugins/wildlife-vault/test/learnings-export.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { stripEvidence, proprietarySignals, composeDigest, stampHarvested } from "../scripts/vault/learnings-export.mjs";

const BODY = [
  "## Generalized insight",
  "",
  "Stub relation targets before linking.",
  "",
  "## In-project evidence",
  "",
  "Acme Corp seeding hit an error on rel_related at /Users/dirk/proj.",
  "",
  "## Proposed plugin change",
  "",
  "A two-pass bulk-seed mode.",
  "",
].join("\n");

test("stripEvidence removes exactly the In-project evidence section", () => {
  const out = stripEvidence(BODY);
  assert.match(out, /Generalized insight/);
  assert.match(out, /Proposed plugin change/);
  assert.doesNotMatch(out, /In-project evidence/);
  assert.doesNotMatch(out, /Acme Corp/);
  assert.doesNotMatch(out, /\/Users\/dirk/);
});

test("stripEvidence handles evidence as the last section", () => {
  const b = "## Generalized insight\n\nX.\n\n## In-project evidence\n\nsecret.\n";
  const out = stripEvidence(b);
  assert.match(out, /Generalized insight/);
  assert.doesNotMatch(out, /secret/);
});

test("proprietarySignals flags emails, urls, paths, proper nouns", () => {
  assert.ok(proprietarySignals("contact a@b.com").length > 0);
  assert.ok(proprietarySignals("see https://x.io/y").length > 0);
  assert.ok(proprietarySignals("at /Users/dirk/proj").length > 0);
  assert.ok(proprietarySignals("Acme Breeding Corp did it").length > 0);
});

test("proprietarySignals ignores clean generalized text", () => {
  assert.deepEqual(proprietarySignals("stub relation targets before linking them"), []);
});

test("composeDigest includes generalized payload and excludes evidence", () => {
  const nodes = [{
    data: { id: "learning-x", title: "X", learning_kind: "strategy", summary: "Generalized claim." },
    body: BODY,
  }];
  const out = composeDigest(nodes);
  assert.match(out, /learning-x/);
  assert.match(out, /strategy/);
  assert.match(out, /Generalized claim\./);
  assert.match(out, /A two-pass bulk-seed mode\./);
  assert.doesNotMatch(out, /Acme Corp/);   // evidence (the only proprietary text) is excluded
});

test("composeDigest warns when the harvestable text itself carries a signal", () => {
  const nodes = [{
    data: { id: "learning-y", title: "Y", learning_kind: "strategy", summary: "Claim referencing Acme Corp." },
    body: "## Generalized insight\n\nClean insight.\n\n## In-project evidence\n\nsecret.\n",
  }];
  const out = composeDigest(nodes);
  assert.match(out, /Possible proprietary signals/); // signal is in the summary, not the stripped evidence
});

test("stampHarvested flips proposed to harvested once, idempotent", () => {
  const raw = "---\nid: learning-x\ntype: learning\nlearning_status: proposed\n---\nbody\n";
  const once = stampHarvested(raw);
  assert.match(once, /learning_status: harvested/);
  assert.doesNotMatch(once, /learning_status: proposed/);
  assert.equal(stampHarvested(once), once); // idempotent: already harvested -> unchanged
});
```

- [ ] **Step 2: Run the tests, confirm FAIL**

Run: `node --test "plugins/wildlife-vault/test/learnings-export.test.mjs"`
Expected: FAIL — module/exports missing.

- [ ] **Step 3: Implement the helpers**

Create `plugins/wildlife-vault/scripts/vault/learnings-export.mjs`:

```js
// scripts/vault/learnings-export.mjs
// Export captured learning nodes (learning_status: proposed) as a sanitized,
// copy-paste Markdown digest, and stamp them harvested. The harvestable payload
// is everything EXCEPT the "In-project evidence" section. Fail-safe no-op when
// no vault is configured. Pure helpers are exported for unit testing.
import * as fs from "node:fs";
import { resolveVault, resolveProjectDir } from "./config.mjs";
import { buildVaultIndex } from "./vault-index.mjs";
import { parseFrontmatter } from "./parse-frontmatter.mjs";

// Remove the "## In-project evidence" section (heading through the next "## " or EOF).
export function stripEvidence(body) {
  const lines = String(body).split("\n");
  const out = [];
  let skipping = false;
  for (const line of lines) {
    const isH2 = /^##\s+/.test(line);
    if (isH2 && /^##\s+In-project evidence\s*$/.test(line)) { skipping = true; continue; }
    if (isH2 && skipping) skipping = false; // next section ends the skip
    if (!skipping) out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// Heuristic: return flagged snippets that look proprietary (warn-only).
export function proprietarySignals(text) {
  const t = String(text);
  const hits = [];
  const email = t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  const url = t.match(/https?:\/\/[^\s)]+/g) || [];
  const pathish = t.match(/(?:^|\s)(\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+)/g) || [];
  const proper = t.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g) || [];
  for (const a of [email, url, pathish, proper]) for (const s of a) hits.push(s.trim());
  return [...new Set(hits)];
}

// Section helper: extract a "## <name>" section body (text up to next ## or EOF), or "".
function section(body, name) {
  const re = new RegExp(`^##\\s+${name}\\s*$([\\s\\S]*?)(?=^##\\s+|$(?![\\r\\n]))`, "m");
  const m = re.exec(String(body));
  return m ? m[1].trim() : "";
}

// Compose the full digest from selected nodes: [{ data, body }].
export function composeDigest(nodes) {
  const blocks = [];
  const allSignals = new Set();
  for (const n of nodes) {
    const clean = stripEvidence(n.body || "");
    const insight = section(clean, "Generalized insight") || "(none)";
    const change = section(clean, "Proposed plugin change") || "(none)";
    const scanText = `${n.data.summary || ""}\n${insight}\n${change}`;
    const sig = proprietarySignals(scanText);
    sig.forEach((s) => allSignals.add(s));
    blocks.push([
      `## ${n.data.id} — ${n.data.title || ""}`,
      `- kind: ${n.data.learning_kind || "(unspecified)"}`,
      `- summary: ${n.data.summary || ""}`,
      "",
      "### Generalized insight",
      insight,
      "",
      "### Proposed plugin change",
      change,
      sig.length ? `\n> ⚠ Possible proprietary signals to review before sharing: ${sig.join(", ")}` : "",
      "---",
    ].join("\n"));
  }
  const header = `# Vault learnings digest (${nodes.length})`;
  const banner = allSignals.size
    ? `\n> ⚠ Possible proprietary signals detected (${allSignals.size}); review each flagged learning before pasting.\n`
    : "";
  return `${header}\n${banner}\n${blocks.join("\n")}\n`;
}

// Flip the first inline `learning_status: proposed` to `harvested`. Idempotent.
export function stampHarvested(raw) {
  return String(raw).replace(/^(learning_status:\s*)proposed\s*$/m, "$1harvested");
}

function hasFlag(name) { return process.argv.includes(`--${name}`); }

function main() {
  const projectDir = resolveProjectDir();
  const vault = resolveVault(projectDir);
  if (!vault) process.exit(0); // no vault -> print nothing
  const dryRun = hasFlag("dry-run");

  const selected = [];
  for (const { filePath, data } of buildVaultIndex(vault.vaultRoot).nodes) {
    if (data.type !== "learning") continue;
    if (data.learning_status !== "proposed") continue;
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = parseFrontmatter(raw);
    selected.push({ filePath, raw, data, body: parsed.ok ? parsed.body : "" });
  }

  process.stdout.write(composeDigest(selected));

  if (!dryRun) {
    for (const n of selected) {
      const stamped = stampHarvested(n.raw);
      if (stamped !== n.raw) fs.writeFileSync(n.filePath, stamped);
    }
    process.stderr.write(`vault:learnings — exported ${selected.length}, stamped harvested${selected.length ? "" : " (none)"}\n`);
  } else {
    process.stderr.write(`vault:learnings — dry-run, ${selected.length} would be exported (not stamped)\n`);
  }
  process.exit(0);
}

const isMain = (() => {
  try {
    return process.argv[1] && (process.argv[1].endsWith("learnings-export.mjs"));
  } catch { return false; }
})();

if (isMain) {
  try { main(); } catch (e) { process.stderr.write(`learnings-export failed (no-op): ${e && e.message}\n`); process.exit(0); }
}
```

- [ ] **Step 4: Run the unit tests, confirm PASS**

Run: `node --test "plugins/wildlife-vault/test/learnings-export.test.mjs"`
Expected: PASS (7 tests). If `section()` regex misbehaves on the last-section case, verify `stripEvidence` first (it is the structural guarantee); `section()` is only for display.

- [ ] **Step 5: Full suite**

Run: `node --test "plugins/wildlife-vault/test/*.test.mjs"`
Expected: all prior 30 + 7 = 37 pass.

- [ ] **Step 6: Commit**

```bash
git add plugins/wildlife-vault/scripts/vault/learnings-export.mjs plugins/wildlife-vault/test/learnings-export.test.mjs
git commit -m "feat(plugin): learnings-export helpers (strip evidence, signal scan, digest, stamp)"
```

---

## Task 2: e2e export against a temp project + `/vault-learnings` skill

**Files:**
- Test: additions to `plugins/wildlife-vault/test/e2e-scripts.test.mjs`
- Create: `plugins/wildlife-vault/skills/vault-learnings/SKILL.md`

- [ ] **Step 1: Write the e2e tests**

Append to `plugins/wildlife-vault/test/e2e-scripts.test.mjs`:

```js
function writeLearning(dir, id, learning_status, evidence) {
  const ld = path.join(dir, "docs", "vault", "Knowledge", "_meta", "learnings");
  fs.mkdirSync(ld, { recursive: true });
  fs.writeFileSync(path.join(ld, `${id}.md`), [
    "---",
    `id: ${id}`,
    `title: "${id}"`,
    "type: learning",
    "doc_class: learning",
    "learning_kind: strategy",
    'summary: "A generalized, shareable claim."',
    "status: draft",
    `learning_status: ${learning_status}`,
    'adopted_in: ""',
    "provenance: inferred",
    'tags: ["area/meta", "class/learning"]',
    "updated: 2026-05-30",
    "rel_related: []",
    "---",
    "## Generalized insight",
    "",
    "Stub relation targets before linking.",
    "",
    "## In-project evidence",
    "",
    `${evidence}`,
    "",
    "## Proposed plugin change",
    "",
    "A two-pass bulk-seed mode.",
    "",
  ].join("\n"));
}

test("learnings export prints only proposed nodes, strips evidence, and stamps harvested", () => {
  const dir = freshProjectWithVault();
  writeLearning(dir, "learning-a", "proposed", "SECRET Acme evidence here.");
  writeLearning(dir, "learning-b", "harvested", "already harvested secret.");
  const r = run("learnings-export.mjs", dir);
  assert.equal(r.code, 0);
  assert.match(r.out, /learning-a/);            // proposed -> included
  assert.doesNotMatch(r.out, /learning-b/);     // already harvested -> excluded
  assert.doesNotMatch(r.out, /SECRET Acme/);    // evidence stripped
  // after a non-dry run, learning-a is now harvested
  const after = fs.readFileSync(path.join(dir, "docs", "vault", "Knowledge", "_meta", "learnings", "learning-a.md"), "utf8");
  assert.match(after, /learning_status: harvested/);
});

test("learnings export --dry-run does not stamp", () => {
  const dir = freshProjectWithVault();
  writeLearning(dir, "learning-c", "proposed", "evidence.");
  const r = run("learnings-export.mjs", dir, ["--dry-run"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /learning-c/);
  const after = fs.readFileSync(path.join(dir, "docs", "vault", "Knowledge", "_meta", "learnings", "learning-c.md"), "utf8");
  assert.match(after, /learning_status: proposed/); // unchanged
});

test("learnings export no-ops (prints nothing) when no vault", () => {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "learn-export-bare-"));
  const r = run("learnings-export.mjs", bare);
  assert.equal(r.code, 0);
  assert.equal(r.out.trim(), "");
});
```

- [ ] **Step 2: Run e2e, confirm PASS**

Run: `node --test "plugins/wildlife-vault/test/e2e-scripts.test.mjs"`
Expected: all pass (existing e2e + 3 new). If "prints only proposed" fails because `buildVaultIndex` did not pick up the new files, confirm the learnings live under the vault root and end in `.md` (they do). Do NOT relax the sanitization assertions.

- [ ] **Step 3: Create the `/vault-learnings` skill**

Create `plugins/wildlife-vault/skills/vault-learnings/SKILL.md`:

```markdown
---
name: vault-learnings
description: Export this project's captured learning nodes as a sanitized, copy-paste digest to feed into the wildlife-vault plugin's /vault-evolve. Use when you want to harvest learnings from this project to evolve the plugin.
allowed-tools: Bash
---
Export the project's proposed learnings as a sanitized digest.

1. Run:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/vault/learnings-export.mjs" --project-dir="${CLAUDE_PROJECT_DIR}"`
   This prints a Markdown digest of every learning node whose `learning_status` is `proposed`, with each node's `In-project evidence` section stripped, and then stamps those nodes `harvested` so they are not re-exported. To preview WITHOUT stamping, add `--dry-run`.

2. If the digest's top banner warns about possible proprietary signals (emails, URLs, paths, proper nouns), review the flagged learnings and edit their generalized text in the source nodes before sharing — then re-run with `--dry-run` to confirm the digest is clean.

3. Copy the printed Markdown block and paste it into a `/vault-evolve` session in the wildlife-vault plugin repo to turn the learnings into concrete plugin-change proposals.

4. After `/vault-evolve` decides, come back and set each source learning node's `learning_status` to `adopted` (and fill `adopted_in: "wildlife-vault@<version>"`) or `rejected`, then run `/vault-map`.
```

- [ ] **Step 4: Full suite**

Run: `node --test "plugins/wildlife-vault/test/*.test.mjs"`
Expected: all pass (37 + 3 e2e = 40).

- [ ] **Step 5: Commit**

```bash
git add plugins/wildlife-vault/test/e2e-scripts.test.mjs plugins/wildlife-vault/skills/vault-learnings/SKILL.md
git commit -m "feat(plugin): /vault-learnings export skill + e2e (sanitized digest, stamp, dry-run)"
```

---

## Task 3: `/vault-evolve` skill (plugin-repo reasoning procedure)

No script — an authored skill that proposes concrete plugin edits from a pasted digest.

**Files:**
- Create: `plugins/wildlife-vault/skills/vault-evolve/SKILL.md`

- [ ] **Step 1: Create the skill**

Create `plugins/wildlife-vault/skills/vault-evolve/SKILL.md`:

```markdown
---
name: vault-evolve
description: Turn a pasted vault-learnings digest into concrete, human-approved upgrades to the wildlife-vault plugin. Use in the wildlife-vault plugin repo when you have a learnings digest exported from a deployed project. Proposes changes; never applies them without approval.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---
Review a pasted learnings digest and propose concrete plugin changes. Run this ONLY in the wildlife-vault plugin repo (it edits the plugin's own files). Propose first; apply only after the user approves each change.

1. Parse the digest: for each `## learning-<id> — <title>` block, read its `kind`, `summary`, `Generalized insight`, and `Proposed plugin change`. If a block carries a proprietary-signal warning, surface it and ask the user to confirm the text is safe before proceeding.

2. For each learning, map its `kind` to a concrete proposal:
   - **type** → a new node template under `skills/vault-author/templates/<type>.md`, plus the matching entries in `scripts/vault/schema.mjs` (`TYPES`, `CATEGORY_DIRS`, `CATEGORY_ORDER`, and `TYPE_DOC_CLASS` if the doc_class is forced). Mirror how the `learning` type was added.
   - **taxonomy** → an addition to `DOC_CLASSES` and/or `TAG_NAMESPACES` in `schema.mjs`, and a `COLORS` palette entry (hex + note the decimal rgb) in `scripts/vault/colorize.mjs` if a new doc_class needs a graph color.
   - **validation** → a new rule in the appropriate pass in `scripts/vault/passes.mjs`, WITH a unit test. State whether it is a hard block or a soft warning.
   - **strategy** / **technique** → an edit to the authoring guidance in `skills/vault-author/SKILL.md` or `skills/vault-new/SKILL.md`, or a new skill if it is a distinct operator action.

3. Present each proposal as: the source learning (id + summary), the exact files to change, and a diff/sketch of the change, plus a recommended `adopted_in` version (read the current version from `.claude-plugin/plugin.json` and suggest the next bump).

4. Apply NOTHING until the user approves. On approval, implement via the normal TDD flow (write/adjust tests first where code is involved) and keep changes scoped to the approved proposals.

5. After applying, remind the user to go back to the source project and set each adopted learning node's `learning_status: adopted` + `adopted_in: "wildlife-vault@<version>"` (or `rejected` for ones not taken), then run `/vault-map` there.

Bias toward small, reviewable, well-scoped changes. A learning that cannot be generalized without project specifics should be flagged and skipped, not forced into the plugin.
```

- [ ] **Step 2: Validate the skill frontmatter parses**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('plugins/wildlife-vault/skills/vault-evolve/SKILL.md','utf8');const m=s.match(/^---\n([\s\S]*?)\n---/);console.log('has frontmatter:',!!m,'| name line:',/name:\s*vault-evolve/.test(m?m[1]:''),'| desc line:',/description:/.test(m?m[1]:''))"`
Expected: `has frontmatter: true | name line: true | desc line: true`.

- [ ] **Step 3: Commit**

```bash
git add plugins/wildlife-vault/skills/vault-evolve/SKILL.md
git commit -m "feat(plugin): add /vault-evolve skill (digest -> proposed plugin upgrades)"
```

---

## Task 4: Pre-flight verification

**Files:** none.

- [ ] **Step 1: Full end-to-end harvest simulation (no app)**

```
node -e "const fs=require('fs'),os=require('os'),path=require('path');const{spawnSync}=require('child_process');const SC=path.resolve('plugins/wildlife-vault/scripts/vault');const d=fs.mkdtempSync(path.join(os.tmpdir(),'harvest-'));spawnSync(process.execPath,[path.join(SC,'init.mjs'),'--project-dir='+d,'--name=Knowledge'],{encoding:'utf8'});const ld=path.join(d,'docs','vault','Knowledge','_meta','learnings');fs.mkdirSync(ld,{recursive:true});const mk=(id,st,ev)=>fs.writeFileSync(path.join(ld,id+'.md'),['---','id: '+id,'title: \"'+id+'\"','type: learning','doc_class: learning','learning_kind: strategy','summary: \"Generalized shareable claim.\"','status: draft','learning_status: '+st,'adopted_in: \"\"','provenance: inferred','tags: [\"area/meta\", \"class/learning\"]','updated: 2026-05-30','rel_related: []','---','## Generalized insight','','Stub targets before linking.','','## In-project evidence','','SECRET '+ev+' at /Users/dirk/x','','## Proposed plugin change','','Two-pass seed.',''].join('\n'));mk('learning-a','proposed','AcmeCorp');mk('learning-b','harvested','old');spawnSync(process.execPath,[path.join(SC,'index.mjs'),'--project-dir='+d],{encoding:'utf8'});const dry=spawnSync(process.execPath,[path.join(SC,'learnings-export.mjs'),'--project-dir='+d,'--dry-run'],{encoding:'utf8'});const realRun=spawnSync(process.execPath,[path.join(SC,'learnings-export.mjs'),'--project-dir='+d],{encoding:'utf8'});const after=fs.readFileSync(path.join(ld,'learning-a.md'),'utf8');const o=[];o.push('A_included='+/learning-a/.test(realRun.stdout));o.push('B_excluded='+!/learning-b/.test(realRun.stdout));o.push('evidence_stripped='+!/SECRET/.test(realRun.stdout));o.push('signal_warned='+/proprietary signals/.test(realRun.stdout));o.push('dry_no_stamp='+/learning_status: proposed/.test(fs.readFileSync(path.join(ld,'learning-a.md'),'utf8'))===false);o.push('stamped_after_real='+/learning_status: harvested/.test(after));o.push('lint='+(()=>{const l=spawnSync(process.execPath,[path.join(SC,'validate.mjs'),'--all','--project-dir='+d],{encoding:'utf8'});return /0 hard/.test((l.stdout||'')+(l.stderr||''))})());console.log(o.join('\n'))"
```
Expected: `A_included=true`, `B_excluded=true`, `evidence_stripped=true`, `signal_warned=true`, `dry_no_stamp=true`, `stamped_after_real=true`, `lint=true`.
(Note: the `dry_no_stamp` line runs the dry-run BEFORE the real run, so at dry-run time the node is still `proposed`; the expression checks the file stayed `proposed` after dry-run. The real run then flips it.)

- [ ] **Step 2: Confirm the two new skills are discoverable**

Run: `node -e "const fs=require('fs');for(const s of ['vault-learnings','vault-evolve']){const p='plugins/wildlife-vault/skills/'+s+'/SKILL.md';console.log(s, fs.existsSync(p)?'ok':'MISSING')}"`
Expected: both `ok`.

- [ ] **Step 3: Final full suite**

Run: `node --test "plugins/wildlife-vault/test/*.test.mjs"`
Expected: all pass (40).

- [ ] **Step 4: Manual app verification (requires Claude Code)**

In a test project with captured learnings, run `/vault-learnings`; confirm the digest prints, evidence is absent, signals are flagged, and the source nodes flip to `harvested`. Then paste the digest into a `/vault-evolve` session in the plugin repo and confirm it proposes concrete changes without applying them.

---

## Notes for the implementer

- `learnings-export.mjs` MUST exit 0 and print nothing when there is no vault (global-script discipline), and its `main()` is wrapped so any crash is a silent no-op.
- The structural guarantee is `stripEvidence` (it removes the evidence section unconditionally); `proprietarySignals` is a secondary warn-only net. Never let a signal-scan failure block the export.
- The lifecycle flip uses a single-line regex on `learning_status:`; do not attempt to rewrite multi-line YAML.
- `/vault-evolve` is the only skill that runs in the PLUGIN repo, not a consuming project — its description says so, and it edits plugin files only after approval.
- Phase 2 completes the loop. After it lands, the remaining backlog item is porting `STANDARD.md` + `seed-from-prd.md` into the plugin and then removing the legacy `vault-system/` (Task 13).
```
