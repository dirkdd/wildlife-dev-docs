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
   - **validation** → a new rule, WITH a unit test. Pick the tier first, then the severity; neither is a free choice (see "Where a validation rule goes" below).
   - **strategy** / **technique** → an edit to the authoring guidance in `skills/vault-author/SKILL.md` or `skills/vault-new/SKILL.md`, or a new skill if it is a distinct operator action.

3. Present each proposal as: the source learning (id + summary), the exact files to change, and a diff/sketch of the change, plus a recommended `adopted_in` version (read the current version from `plugins/wildlife-vault/.claude-plugin/plugin.json` — the plugin manifest, not the root `.claude-plugin/marketplace.json` — and suggest the next bump). Keep the sketch to the changed lines and the prose being added, not the surrounding file — if a proposal needs more code than that to be reviewable, cite `path:line` and let the reviewer open it. When this skill runs under a structured-output harness, a large escaped source payload in a schema field is what busts the validator and loses the entire proposal, so the biggest proposals are the ones that vanish.

4. Apply NOTHING until the user approves. On approval, implement via the normal TDD flow (write/adjust tests first where code is involved) and keep changes scoped to the approved proposals.

5. After applying, remind the user to go back to the source project and set each adopted learning node's `learning_status: adopted` + `adopted_in: "wildlife-vault@<version>"` (or `rejected` for ones not taken), then run `/vault-map` there.

Bias toward small, reviewable, well-scoped changes. A learning that cannot be generalized without project specifics should be flagged and skipped, not forced into the plugin.

## Where a validation rule goes

Two tiers. A rule proposed into the wrong one either cannot see the data it needs or cannot run at all.

**Tier 1 — per-file rules live in `scripts/vault/passes.mjs`.** A pass has the signature `(filePath, parsed, ctx) => ({ hard: [], soft: [] })`. It receives `filePath`; `parsed` = `{ data, raw, body }`, where `data` is the flat-YAML frontmatter object, `raw` is the verbatim text between the fences, and `body` is everything after; and `ctx`, which carries `body`, `knownIds` (a Set of OTHER nodes' ids — self is excluded, so the duplicate-id check fires only on real dupes) and `now`. A pass does NOT get other nodes' frontmatter or bodies. A rule that needs the unparsed text — the unquoted-wikilink scan, for instance — must read `parsed.raw`, because the parser strips quotes out of `parsed.data`. Wiring is automatic: `validate.mjs` calls all three passes and flat-maps their `hard`/`soft`, so a rule pushed into an existing pass needs no registration. Test it with a focused unit test that imports the pass directly.

**Tier 2 — whole-vault rules live in `scripts/vault/index-drift.mjs`** (or their own module, wired the same way). The signature is `(nodes, ...) => string[]` over the full node list, and they are wired by hand into `validate.mjs`'s `--all` branch. This is the only place a cross-node rule can go. Critically, this tier runs ONLY under `--all`, i.e. only from `/vault-lint` — never from either hook. **A cross-node rule cannot block a write.** Test it in `test/e2e-scripts.test.mjs`, which spawns the real CLI against a scratch vault.

## The severity ladder

Severity is constrained by the harness, not chosen freely:

- `hard` from a pass → stderr + `permissionDecision: "deny"` + exit 2. In `--mode=pre` this genuinely blocks the write.
- BUT PreToolUse only sees content for a **Write**, not an **Edit**: the validator reads `tool_input.content` and exits 0 when it is undefined ("Edit -> defer to post"). So a hard rule blocks a full-file write and only reports on an edit — PostToolUse fires after the bytes are on disk.
- `soft` → an `additionalContext` string, exit 0. Advisory to the agent, invisible in CI.
- Any crash → the validator catches it and exits 0, failing safe and allowing the write. A rule that throws is a rule that silently does not exist.
- The path guard runs first: the validator exits 0 unless the file is under the vault root, ends in `.md`, and is not under `_raw`. The hooks match `Write|Edit` globally, so that guard is the only thing keeping the plugin inert in the rest of the repo.

Choose severity by false-positive cost, not by how much you want the rule obeyed. A hard block that fires on a legitimate node gets the whole gate switched off; a soft warning nobody reads is decoration. Before proposing a hard rule, name the false-positive class and say why it is empty. Measure a proposed rule against a real vault and report the count — a rule that produces six false positives and no true positives on live data is a rejected proposal, not a tuning problem.
