---
name: vault-status
description: Report vault staleness: source files whose content has changed since ingest, and code_refs that no longer resolve. Use when checking whether vault nodes are up to date with the codebase or source docs.
allowed-tools: Bash, Read, Edit
---
Run `npm run vault:status` from the repo root. It diffs the current repo against `_meta/.manifest.json` and checks `code_refs` liveness across all nodes.

Act on the output:
- Stale sources (a source file's hash changed): report which nodes they produced and offer to flag those nodes `status: stale` in their frontmatter, or to open the body for a targeted update.
- Hard code_ref issues (path missing): report the node and the broken ref; offer to remove or fix the `code_refs` entry.
- Soft code_ref issues (path exists but symbol not found): list as warnings; offer to update the symbol name if it was renamed.

Group all findings by source file to minimize alert fatigue. A clean run (exit 0) should confirm "0 stale sources, 0 hard / 0 soft code_ref issues."
