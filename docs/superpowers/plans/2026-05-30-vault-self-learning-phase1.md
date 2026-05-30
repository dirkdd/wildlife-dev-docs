# Vault Self-Learning — Phase 1 (Capture & Storage) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the in-project capture & storage half of the vault self-learning loop to the `wildlife-vault` plugin: a `learning` node type, a `/vault-learn` skill, an autonomous-capture protocol, and a non-blocking session-end sweep nudge.

**Architecture:** A new `type: learning` (doc_class `learning`, stored as `_meta/learnings/learning-<slug>.md`, doc_class forced via `TYPE_DOC_CLASS`, colored magenta). Capture is hybrid: the `/vault-learn` skill + an autonomous-capture clause in the Vault Protocol record insights in the moment; a `SessionEnd` hook (`learn-sweep.mjs`) emits a non-blocking nudge when the session touched vault nodes. Phase 2 (export + `/vault-evolve`) is a separate plan.

**Tech Stack:** Pure Node ESM, `node:test`, Claude Code plugin format. Same conventions as the existing plugin (per-project `resolveVault`, fail-safe no-op when unconfigured).

**Validator facts confirmed against `passes.mjs`:** there is NO type→folder enforcement; the only filename rule is `id` must equal the file's basename (so `_meta/learnings/learning-foo.md` requires `id: learning-foo`). `status` is enum-checked against `draft|canonical|stale|deprecated` (hence the harvest lifecycle uses a separate `learning_status` field). `TYPE_DOC_CLASS[type]` forces `doc_class`. Tag namespaces are soft-checked; `class` is already governed.

**Source of truth:** the spec at `docs/superpowers/specs/2026-05-30-vault-self-learning-design.md`.

**Branch:** continue on `feat/wildlife-vault-plugin`.

---

## File Structure

- Modify: `plugins/wildlife-vault/scripts/vault/schema.mjs` — register `learning` type/doc_class/dirs/order/forced-doc_class.
- Modify: `plugins/wildlife-vault/scripts/vault/colorize.mjs` — add `learning` palette color.
- Create: `plugins/wildlife-vault/skills/vault-author/templates/learning.md` — the learning node template.
- Create: `plugins/wildlife-vault/skeleton/Knowledge/_meta/learnings/.gitkeep` — ensure the folder exists in every initialized vault.
- Create: `plugins/wildlife-vault/skills/vault-learn/SKILL.md` — the `/vault-learn` capture skill.
- Modify: `plugins/wildlife-vault/skills/vault-author/SKILL.md` — autonomous-capture clause.
- Modify: `plugins/wildlife-vault/skeleton/fragments/CLAUDE.md-vault-protocol.md` — autonomous-capture clause for consuming repos.
- Create: `plugins/wildlife-vault/scripts/vault/learn-sweep.mjs` — the SessionEnd sweep.
- Modify: `plugins/wildlife-vault/hooks/hooks.json` — wire the SessionEnd hook.
- Test: `plugins/wildlife-vault/test/learning-type.test.mjs`, `plugins/wildlife-vault/test/learn-sweep.test.mjs`, additions to `e2e-scripts.test.mjs`.

---

## Task 1: Register the `learning` type (schema + colorize + template + skeleton folder)

**Files:**
- Modify: `plugins/wildlife-vault/scripts/vault/schema.mjs`
- Modify: `plugins/wildlife-vault/scripts/vault/colorize.mjs`
- Create: `plugins/wildlife-vault/skills/vault-author/templates/learning.md`
- Create: `plugins/wildlife-vault/skeleton/Knowledge/_meta/learnings/.gitkeep`
- Test: `plugins/wildlife-vault/test/learning-type.test.mjs`, additions to `plugins/wildlife-vault/test/e2e-scripts.test.mjs`

- [ ] **Step 1: Write the failing unit test**

Create `plugins/wildlife-vault/test/learning-type.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { TYPES, DOC_CLASSES, CATEGORY_DIRS, CATEGORY_ORDER, TYPE_DOC_CLASS } from "../scripts/vault/schema.mjs";
import { buildColorGroups, hexToDecimal } from "../scripts/vault/colorize.mjs";

test("learning is a registered type with forced doc_class, in _meta", () => {
  assert.ok(TYPES.includes("learning"));
  assert.ok(DOC_CLASSES.includes("learning"));
  assert.equal(CATEGORY_DIRS.learning, "_meta");
  assert.ok(CATEGORY_ORDER.includes("learning"));
  assert.equal(TYPE_DOC_CLASS.learning, "learning");
});

test("learning has a magenta color group", () => {
  const g = buildColorGroups().find((x) => x.query === "tag:#class/learning");
  assert.ok(g, "learning color group exists");
  assert.equal(g.color.rgb, hexToDecimal("#E91E63"));
  assert.equal(g.color.rgb, 15277667);
});
```

- [ ] **Step 2: Run it, confirm FAIL**

Run: `node --test "plugins/wildlife-vault/test/learning-type.test.mjs"`
Expected: FAIL (learning not in TYPES; no learning color group).

- [ ] **Step 3: Wire the schema**

In `plugins/wildlife-vault/scripts/vault/schema.mjs`:

- `TYPES` — append `"learning"`:
```js
export const TYPES = [
  "concept", "module", "flow", "data", "invariant",
  "decision", "runbook", "guide", "reference", "moc", "learning",
];
```
- `DOC_CLASSES` — append `"learning"`:
```js
export const DOC_CLASSES = [
  "prd", "design", "spec", "plan", "kickoff", "adr",
  "analysis", "user-journey", "runbook", "guide", "knowledge", "reference", "learning",
];
```
- `CATEGORY_DIRS` — add `learning: "_meta"` after the `moc` entry:
```js
  reference: "_meta",
  moc: "_meta",
  learning: "_meta",
};
```
- `CATEGORY_ORDER` — insert `"learning"` before `"reference"`:
```js
export const CATEGORY_ORDER = [
  "moc", "concept", "module", "flow", "data", "invariant",
  "decision", "runbook", "guide", "learning", "reference", "other",
];
```
- `TYPE_DOC_CLASS` — add `learning: "learning"`:
```js
export const TYPE_DOC_CLASS = {
  decision: "adr",
  runbook: "runbook",
  moc: "reference",
  learning: "learning",
};
```

- [ ] **Step 4: Wire the colorize palette**

In `plugins/wildlife-vault/scripts/vault/colorize.mjs`, add a `learning` entry to the `COLORS` map (after `reference`):
```js
  knowledge: "#95A5A6",
  reference: "#C8CDD0",
  learning: "#E91E63",
};
```

- [ ] **Step 5: Run the unit test, confirm PASS**

Run: `node --test "plugins/wildlife-vault/test/learning-type.test.mjs"`
Expected: PASS (2 tests).

- [ ] **Step 6: Create the learning template**

Create `plugins/wildlife-vault/skills/vault-author/templates/learning.md`:

```markdown
---
id: learning-PLACEHOLDER
title: "PLACEHOLDER: short imperative insight"
type: learning
doc_class: learning
learning_kind: PLACEHOLDER
summary: "PLACEHOLDER: the generalized, project-agnostic claim. This is what gets harvested into the plugin."
status: draft
learning_status: proposed
adopted_in: ""
provenance: inferred
tags: ["area/meta", "class/learning"]
updated: YYYY-MM-DD
rel_related: []
---
## Generalized insight

<!-- Harvestable. The reusable claim, stated without any client names or proprietary specifics. -->

## In-project evidence

<!-- Stays local. The concrete case in THIS project that sparked the insight. NEVER exported. -->

## Proposed plugin change

<!-- Optional. What this implies for the plugin: a new template, a taxonomy/enum addition, a validation rule, or an authoring-guidance change. -->
```

(`learning_kind` is one of: `type | strategy | taxonomy | validation | technique`.)

- [ ] **Step 7: Create the skeleton folder placeholder**

Create `plugins/wildlife-vault/skeleton/Knowledge/_meta/learnings/.gitkeep` (empty file) so a freshly-initialized vault already has the `_meta/learnings/` folder.

- [ ] **Step 8: Add an e2e test that a filled learning node lints clean**

Append to `plugins/wildlife-vault/test/e2e-scripts.test.mjs`:

```js
test("a learning node in _meta/learnings lints clean after a single map", () => {
  const dir = freshProjectWithVault();
  const learnDir = path.join(dir, "docs", "vault", "Knowledge", "_meta", "learnings");
  fs.mkdirSync(learnDir, { recursive: true });
  fs.writeFileSync(
    path.join(learnDir, "learning-prefer-stub-then-link.md"),
    [
      "---",
      "id: learning-prefer-stub-then-link",
      'title: "Stub relation targets before linking during bulk seeding"',
      "type: learning",
      "doc_class: learning",
      "learning_kind: strategy",
      'summary: "When seeding many related nodes, create stub targets first so rel_* links resolve on first write."',
      "status: draft",
      "learning_status: proposed",
      'adopted_in: ""',
      "provenance: inferred",
      'tags: ["area/meta", "class/learning"]',
      "updated: 2026-05-30",
      "rel_related: []",
      "---",
      "## Generalized insight",
      "",
      "Create relation targets as stubs before authoring nodes that link to them.",
      "",
      "## In-project evidence",
      "",
      "Seeding hit a missing-target error on rel_related.",
      "",
      "## Proposed plugin change",
      "",
      "A bulk-seed mode that two-passes: stubs then links.",
      "",
    ].join("\n")
  );
  assert.equal(run("index.mjs", dir).code, 0, "map should exit 0");
  const lint = run("validate.mjs", dir, ["--all"]);
  assert.equal(lint.code, 0, `lint should be clean:\n${lint.out}`);
  assert.match(lint.out, /0 hard/);
});
```

- [ ] **Step 9: Run the full suite**

Run: `node --test "plugins/wildlife-vault/test/*.test.mjs"`
Expected: all pass (prior 22 + 2 learning-type + 1 e2e = 25).
If the learning-node e2e fails on a hard violation, capture the exact `lint.out` and report it — do NOT weaken the validator. A `type`/`doc_class`/enum/id error there means the Step 3 wiring or the node's `id`↔filename match is wrong; fix that, not the test.

- [ ] **Step 10: Commit**

```bash
git add plugins/wildlife-vault/scripts/vault/schema.mjs plugins/wildlife-vault/scripts/vault/colorize.mjs plugins/wildlife-vault/skills/vault-author/templates/learning.md plugins/wildlife-vault/skeleton/Knowledge/_meta/learnings/.gitkeep plugins/wildlife-vault/test/learning-type.test.mjs plugins/wildlife-vault/test/e2e-scripts.test.mjs
git commit -m "feat(plugin): register learning node type (schema, palette, template, skeleton folder)"
```

---

## Task 2: `/vault-learn` skill + autonomous-capture protocol

**Files:**
- Create: `plugins/wildlife-vault/skills/vault-learn/SKILL.md`
- Modify: `plugins/wildlife-vault/skills/vault-author/SKILL.md`
- Modify: `plugins/wildlife-vault/skeleton/fragments/CLAUDE.md-vault-protocol.md`

- [ ] **Step 1: Create the `/vault-learn` skill**

Create `plugins/wildlife-vault/skills/vault-learn/SKILL.md`:

```markdown
---
name: vault-learn
description: Capture a generalizable learning (a reusable technique, a recurring shape the built-in node types don't fit, a taxonomy gap, a validation idea, or a workflow/graph-traversal breakthrough) as a quarantined learning node, to later harvest into the wildlife-vault plugin. Use when you discover something durable about HOW to build or document that would help future projects, not project-specific facts.
allowed-tools: Read, Write, Edit, Bash
arguments: [insight]
---
Capture one learning node. These record insights about HOW to build/document well — to be harvested into the plugin later — NOT project domain knowledge (that is what the vault-author skill is for).

1. Classify the insight into a `learning_kind`: `type` (a node/doc shape the built-ins don't fit), `strategy` (an authoring/process heuristic), `taxonomy` (a vocabulary/enum gap), `validation` (a rule worth enforcing or relaxing), or `technique` (a workflow or graph-traversal breakthrough).

2. Read the template `${CLAUDE_PLUGIN_ROOT}/skills/vault-author/templates/learning.md`.

3. Derive the `id` as `learning-<kebab-slug>` from the insight. The file is `_meta/learnings/<id>.md` under the vault root (find the vault root in `docs/vault/.vault.json`). The `id` MUST equal the filename basename. Learning nodes live in `_meta/learnings/`, beside the router's folder.

4. Fill the frontmatter: `learning_kind`; `summary` = the generalized, project-agnostic claim; `status: draft`; `learning_status: proposed`; `adopted_in: ""`; `provenance: inferred`; `tags: ["area/meta", "class/learning"]`; `updated` = today; `rel_related` = quoted wikilinks to the node(s) that sparked it, if any.

5. Fill the body: **Generalized insight** (the reusable claim, no client names or proprietary specifics — this is what gets harvested), **In-project evidence** (the concrete local case that sparked it — this stays local and is never exported), and optionally **Proposed plugin change** (what it implies for the plugin).

6. Keep the generalized sections free of anything proprietary. If the insight cannot be stated generally without leaking project specifics, it is project knowledge — author it with vault-author instead.

7. Write the node (the Write tool creates the `_meta/learnings/` folder if needed). The PreToolUse hook validates it; fix any rejection. Then run `/vault-map` so it indexes.
```

- [ ] **Step 2: Add the autonomous-capture clause to vault-author**

In `plugins/wildlife-vault/skills/vault-author/SKILL.md`, find the final "Compounding rule (invariant)" paragraph. Immediately AFTER it, add a new paragraph:

```
Learning capture (autonomous): when you discover something generalizable about HOW to build or document — a recurring shape the built-in node types don't fit, a technique or workflow that worked, a taxonomy gap, or a validation idea — record it immediately with the vault-learn skill before moving on. That is separate from documenting project knowledge: project facts are nodes; reusable build/document insights are learning nodes to be harvested into the plugin. A generalizable insight left uncaptured is lost.
```

- [ ] **Step 3: Add the autonomous-capture clause to the consuming-repo protocol fragment**

In `plugins/wildlife-vault/skeleton/fragments/CLAUDE.md-vault-protocol.md`, find the `- **Capture back:**` bullet. Immediately AFTER that bullet (still inside the list, before the `- **Writes are gated:**` bullet), insert:

```
- **Capture learnings:** when you discover something generalizable about *how* to build or document (a reusable technique, a recurring shape the node types don't fit, a taxonomy gap, a validation idea, a workflow/graph-traversal breakthrough), record it with `/vault-learn` as a quarantined learning node — kept separate from project knowledge and later harvested to improve the tooling. A generalizable insight left uncaptured is lost.
```

- [ ] **Step 4: Verify the skill references the plugin-root template**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('plugins/wildlife-vault/skills/vault-learn/SKILL.md','utf8');console.log('plugin-root template ref:', /\\$\\{CLAUDE_PLUGIN_ROOT\\}\\/skills\\/vault-author\\/templates\\/learning\\.md/.test(s))"`
Expected: `plugin-root template ref: true`.

- [ ] **Step 5: Confirm the fragment is still marker-guarded and has the clause**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('plugins/wildlife-vault/skeleton/fragments/CLAUDE.md-vault-protocol.md','utf8');console.log('begin marker:', s.includes('<!-- vault-system:begin -->'), '| end marker:', s.includes('<!-- vault-system:end -->'), '| learn clause:', s.includes('/vault-learn'))"`
Expected: `begin marker: true | end marker: true | learn clause: true`.

- [ ] **Step 6: Commit**

```bash
git add plugins/wildlife-vault/skills/vault-learn/SKILL.md plugins/wildlife-vault/skills/vault-author/SKILL.md plugins/wildlife-vault/skeleton/fragments/CLAUDE.md-vault-protocol.md
git commit -m "feat(plugin): add /vault-learn skill + autonomous-capture protocol clause"
```

---

## Task 3: SessionEnd sweep hook (`learn-sweep.mjs`)

**Files:**
- Create: `plugins/wildlife-vault/scripts/vault/learn-sweep.mjs`
- Modify: `plugins/wildlife-vault/hooks/hooks.json`
- Test: `plugins/wildlife-vault/test/learn-sweep.test.mjs`, addition to `e2e-scripts.test.mjs`

- [ ] **Step 1: Write the failing unit test**

Create `plugins/wildlife-vault/test/learn-sweep.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { nudgeMessage } from "../scripts/vault/learn-sweep.mjs";

test("no nudge when nothing changed", () => {
  assert.equal(nudgeMessage([]), null);
});

test("nudge names the count and points at /vault-learn", () => {
  const msg = nudgeMessage(["a.md", "b.md"]);
  assert.match(msg, /2 vault nodes/);
  assert.match(msg, /\/vault-learn/);
});

test("singular phrasing for one file", () => {
  assert.match(nudgeMessage(["a.md"]), /1 vault node\b/);
});
```

- [ ] **Step 2: Run it, confirm FAIL**

Run: `node --test "plugins/wildlife-vault/test/learn-sweep.test.mjs"`
Expected: FAIL (module/function missing).

- [ ] **Step 3: Create `learn-sweep.mjs`**

Create `plugins/wildlife-vault/scripts/vault/learn-sweep.mjs`:

```js
// scripts/vault/learn-sweep.mjs
// SessionEnd sweep: a non-blocking nudge to capture learnings when the session
// touched vault nodes. Authors nothing; never blocks. Fail-safe no-op when the
// project has no vault configured.
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { resolveVault, resolveProjectDir } from "./config.mjs";
import { listVaultMarkdown } from "./vault-index.mjs";

// Pure: turn a list of changed vault node paths into a nudge string (or null).
export function nudgeMessage(changed) {
  const n = changed.length;
  if (n === 0) return null;
  return `This session touched ${n} vault node${n === 1 ? "" : "s"}. Before you finish, consider whether any durable technique, recurring shape, or taxonomy gap is worth capturing with /vault-learn — a generalizable insight left uncaptured is lost.`;
}

// Which vault .md files changed: prefer git (uncommitted changes under the vault),
// fall back to mtime within the last 2 hours when git is unavailable.
export function changedVaultFiles(projectDir, vaultRoot, now = Date.now(), windowMs = 2 * 60 * 60 * 1000) {
  try {
    const out = execFileSync("git", ["-C", projectDir, "status", "--porcelain", "--", vaultRoot],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.split("\n")
      .map((l) => l.slice(3).trim())
      .filter((f) => f.endsWith(".md") && !f.replace(/\\/g, "/").split("/").includes("_raw"));
  } catch {
    return listVaultMarkdown(vaultRoot).filter((f) => {
      try { return now - fs.statSync(f).mtimeMs <= windowMs; } catch { return false; }
    });
  }
}

function main() {
  const projectDir = resolveProjectDir();
  const vault = resolveVault(projectDir);
  if (!vault) process.exit(0); // no vault -> stay silent
  const msg = nudgeMessage(changedVaultFiles(projectDir, vault.vaultRoot));
  if (msg) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionEnd", additionalContext: msg },
    }));
  }
  process.exit(0);
}

const isMain = (() => {
  try { return path.resolve(process.argv[1] || "") === path.resolve(new URL(import.meta.url).pathname); }
  catch { return false; }
})() || (process.argv[1] != null &&
  (process.argv[1].endsWith("/learn-sweep.mjs") || process.argv[1].endsWith(`${path.sep}learn-sweep.mjs`)));

if (isMain) {
  try { main(); } catch { process.exit(0); } // fail-safe: a sweep crash must never disrupt session end
}
```

- [ ] **Step 4: Run the unit test, confirm PASS**

Run: `node --test "plugins/wildlife-vault/test/learn-sweep.test.mjs"`
Expected: PASS (3 tests).

- [ ] **Step 5: Add an e2e test for no-op + nudge behavior**

Append to `plugins/wildlife-vault/test/e2e-scripts.test.mjs`:

```js
test("learn-sweep no-ops silently on a project with no vault", () => {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "sweep-bare-"));
  const r = run("learn-sweep.mjs", bare);
  assert.equal(r.code, 0);
  assert.equal(r.out.trim(), "");
});

test("learn-sweep emits a nudge when the vault has recent changes", () => {
  const dir = freshProjectWithVault(); // freshly copied skeleton -> recent mtimes, no git
  const r = run("learn-sweep.mjs", dir);
  assert.equal(r.code, 0);
  assert.match(r.out, /\/vault-learn/);
});
```

- [ ] **Step 6: Wire the SessionEnd hook**

In `plugins/wildlife-vault/hooks/hooks.json`, add a `SessionEnd` array as a sibling of `PreToolUse`/`PostToolUse`/`SessionStart` (inside the `"hooks"` object). Add a comma after the existing `SessionStart` array's closing bracket, then:

```json
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": [
              "${CLAUDE_PLUGIN_ROOT}/scripts/vault/learn-sweep.mjs",
              "--project-dir=${CLAUDE_PROJECT_DIR}"
            ],
            "timeout": 15
          }
        ]
      }
    ]
```

Validate the JSON: `node -e "const h=JSON.parse(require('fs').readFileSync('plugins/wildlife-vault/hooks/hooks.json','utf8')).hooks;console.log(Object.keys(h).join(','))"`
Expected: `PreToolUse,PostToolUse,SessionStart,SessionEnd`.

- [ ] **Step 7: Full suite**

Run: `node --test "plugins/wildlife-vault/test/*.test.mjs"`
Expected: all pass (25 from Task 1 + 3 unit + 2 e2e = 30).

- [ ] **Step 8: Commit**

```bash
git add plugins/wildlife-vault/scripts/vault/learn-sweep.mjs plugins/wildlife-vault/hooks/hooks.json plugins/wildlife-vault/test/learn-sweep.test.mjs plugins/wildlife-vault/test/e2e-scripts.test.mjs
git commit -m "feat(plugin): SessionEnd learn-sweep hook (non-blocking learning-capture nudge)"
```

---

## Task 4: Pre-flight + manual verification

**Files:** none (verification)

- [ ] **Step 1: Simulate the learning capture flow end to end (no app)**

```
node -e "const fs=require('fs'),os=require('os'),path=require('path');const{spawnSync}=require('child_process');const SC=path.resolve('plugins/wildlife-vault/scripts/vault');const d=fs.mkdtempSync(path.join(os.tmpdir(),'learn-'));spawnSync(process.execPath,[path.join(SC,'init.mjs'),'--project-dir='+d,'--name=Knowledge'],{encoding:'utf8'});const ld=path.join(d,'docs','vault','Knowledge','_meta','learnings');fs.mkdirSync(ld,{recursive:true});const node=['---','id: learning-x','title: \"X\"','type: learning','doc_class: learning','learning_kind: technique','summary: \"A generalized technique worth harvesting.\"','status: draft','learning_status: proposed','adopted_in: \"\"','provenance: inferred','tags: [\"area/meta\", \"class/learning\"]','updated: 2026-05-30','rel_related: []','---','## Generalized insight','','Reusable claim.','','## In-project evidence','','Local case.','','## Proposed plugin change','','Maybe a new rule.',''].join('\n');fs.writeFileSync(path.join(ld,'learning-x.md'),node);spawnSync(process.execPath,[path.join(SC,'index.mjs'),'--project-dir='+d],{encoding:'utf8'});const lint=spawnSync(process.execPath,[path.join(SC,'validate.mjs'),'--all','--project-dir='+d],{encoding:'utf8'});console.log('learning-node lint:', /0 hard/.test((lint.stdout||'')+(lint.stderr||''))?'0 hard OK':'PROBLEM:\n'+lint.stdout+lint.stderr);const col=spawnSync(process.execPath,[path.join(SC,'colorize.mjs'),'--project-dir='+d],{encoding:'utf8'});const g=JSON.parse(fs.readFileSync(path.join(d,'docs','vault','Knowledge','.obsidian','graph.json'),'utf8'));console.log('learning color group rgb:', (g.colorGroups.find(x=>x.query==='tag:#class/learning')||{}).color);const sweep=spawnSync(process.execPath,[path.join(SC,'learn-sweep.mjs'),'--project-dir='+d],{encoding:'utf8'});console.log('sweep nudge present:', /\\/vault-learn/.test(sweep.stdout||''))"
```
Expected: `learning-node lint: 0 hard OK`, a `learning color group rgb:` object containing `rgb: 15277667`, and `sweep nudge present: true`.

- [ ] **Step 2: Manual app verification (requires Claude Code) — does the SessionEnd nudge actually surface?**

Reload the plugin in a test repo with a vault, do some vault authoring, end the session, and confirm the SessionEnd nudge is surfaced (you see the "consider a /vault-learn" reflection).

**FALLBACK if it does not surface:** SessionEnd hooks fire at teardown; if this Claude Code build does not surface a SessionEnd `additionalContext` to the agent, switch the wiring to a `Stop` hook throttled to once per session: (a) move the entry from `SessionEnd` to `Stop` in `hooks.json`; (b) in `learn-sweep.mjs main()`, read the hook stdin JSON (`fs.readFileSync(0,"utf8")`), parse `session_id`, and if a marker file `path.join(os.tmpdir(), "wildlife-vault-swept-"+session_id)` exists, `process.exit(0)` with no output; otherwise create the marker (`fs.writeFileSync(marker,"")`) before emitting the nudge. Keep the `hookEventName` in the output matching the chosen event. This preserves the approved "one actionable nudge per session" intent.

- [ ] **Step 3: Confirm `/vault-learn` is invocable**

In the test repo, run `/vault-learn "always stub relation targets before linking during bulk seeds"`; confirm it authors a `_meta/learnings/learning-*.md` node that passes validation, then `/vault-lint` is clean.

---

## Notes for the implementer

- `new Date()` is fine in these plugin scripts (normal Node processes).
- Keep the global-hook discipline: `learn-sweep.mjs` MUST exit 0 and stay silent when there is no vault, and must never throw out of `main()` (the bottom `try/catch` guarantees this).
- The `id` must equal the file basename (validator rule). `/vault-learn` and the tests both name the file `<id>.md`, so they comply.
- Do NOT weaken the validator to make the learning node lint clean — if it doesn't, the schema wiring (Task 1 Step 3) is the thing to fix.
- Phase 2 (`/vault-learnings` export + `/vault-evolve`) is intentionally NOT in this plan; it gets its own spec-derived plan later.
```
