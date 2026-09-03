---
name: vault-colorize
description: "Regenerate the Obsidian graph color groups for docs/vault/Knowledge from the doc_class enum. Use when asked to update graph colors, after adding a new doc_class, or when colors look wrong in the Obsidian graph."
allowed-tools: Bash
---
Read [shared runtime and scope](../../references/runtime.md) before acting.

Regenerate the Obsidian graph color groups for the vault. Colors are keyed by a `class/<doc_class>` mirror tag (NOT by a frontmatter property — property-based color queries silently match nothing on many Obsidian builds).

Two steps, in order:

1. **Backfill the mirror tags** so every node carries `class/<doc_class>`:
   `node "${VAULT_PLUGIN_ROOT}/scripts/vault/add-class-tags.mjs" --project-dir="${VAULT_PROJECT_DIR}"`
   It is idempotent; report how many nodes it tagged vs. were already tagged. Any node reported as `[skip non-inline tags]` has a multi-line `tags:` block — normalize it to an inline array by hand, then re-run.

2. **Write the color groups:**
   `node "${VAULT_PLUGIN_ROOT}/scripts/vault/colorize.mjs" --project-dir="${VAULT_PROJECT_DIR}"`
   It writes one `tag:#class/<doc_class>` group per doc_class into `<vault>/.obsidian/graph.json` (decimal-rgb colors, separate alpha), preserving all other graph settings. Report how many color groups were written (one per `doc_class`).

**Critical gotcha — Obsidian must be CLOSED when you colorize.** Obsidian rewrites `graph.json` from memory while it is open, so a palette written while Obsidian is running gets clobbered on its next save. To make colors stick: close Obsidian fully → run the two commands above → reopen Obsidian. The color groups use `tag:#class/<value>` queries, which require Obsidian 1.4+.

The commands are idempotent and non-destructive to other `graph.json` keys (`showTags`, `showArrow`, `hideUnresolved`, etc.).
