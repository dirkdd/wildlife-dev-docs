---
name: vault-colorize
description: Regenerate the Obsidian graph color groups for docs/vault/Knowledge from the doc_class enum. Use when asked to update graph colors, after adding a new doc_class, or when colors look wrong in the Obsidian graph.
allowed-tools: Bash
---
Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/vault/colorize.mjs" --project-dir="${CLAUDE_PROJECT_DIR}"`. It rewrites the `colorGroups` array in `docs/vault/Knowledge/.obsidian/graph.json` from the `DOC_CLASSES` enum in the plugin's `scripts/vault/schema.mjs`, preserving all other graph settings.

After it completes, report how many color groups were written.

Remind the user: reload the Obsidian graph (close and reopen the Graph view, or restart Obsidian) to see the updated colors. The color groups use `doc_class:"<value>"` property queries, which require Obsidian 1.4+.

The command is idempotent and non-destructive to other `graph.json` keys (`showTags`, `showArrow`, `hideUnresolved`, etc.).
