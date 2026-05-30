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
