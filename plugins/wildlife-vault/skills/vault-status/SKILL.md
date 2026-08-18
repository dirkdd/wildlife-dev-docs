---
name: vault-status
description: Report vault staleness: source files whose content has changed since ingest, and code_refs that no longer resolve. Use when checking whether vault nodes are up to date with the codebase or source docs.
allowed-tools: Bash, Read, Edit
---
Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/vault/status.mjs" --project-dir="${CLAUDE_PROJECT_DIR}"`. It diffs the current repo against `_meta/.manifest.json` and checks `code_refs` liveness across all nodes.

Act on the output:
- Stale sources (a source file's hash changed): report which nodes they produced and offer to flag those nodes `status: stale` in their frontmatter, or to open the body for a targeted update.
- Hard code_ref issues (path missing): report the node and the broken ref; offer to remove or fix the `code_refs` entry.
- Soft code_ref issues (path exists but symbol not found): list as warnings; offer to update the symbol name if it was renamed.

Group all findings by source file to minimize alert fatigue. A clean run (exit 0) should confirm "0 stale sources, 0 hard / 0 soft code_ref issues."

Then do the part no threshold catches. The `stale-updated` soft warning fires at 120 days, and the nodes that rot hardest are never that old — they are a cohort seeded on one day, describing a scaffold that has since been rebuilt, sitting comfortably inside the threshold. Sort the vault by `updated`, take the oldest tenth (minimum 5 nodes; skip this on a vault under 10 nodes), and re-read that slice against the code. Report it as one block — a work queue, not one warning per node — and offer to re-verify or downgrade `provenance` on the ones that no longer match. See "Staleness: the threshold and the cohort" in the plugin's `docs/STANDARD.md`.
