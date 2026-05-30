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
