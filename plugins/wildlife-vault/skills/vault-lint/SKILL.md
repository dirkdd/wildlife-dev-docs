---
name: vault-lint
description: Run the full vault health check (schema, structural, graph, and index-drift gates) and report or fix violations. Use when asked to lint, validate, or check the health of docs/vault/Knowledge.
allowed-tools: Bash, Read, Edit
---
Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/vault/validate.mjs" --all --project-dir="${CLAUDE_PROJECT_DIR}"`. It validates every node and the generated indexes.

- Hard errors (exit 1): report each with its file, and offer to fix the offending frontmatter or run `/vault-map` if the failure is index-drift (coverage / missing sub-index). A missing vault root, or markdown files that produced zero parsed nodes, is also hard — that run measured nothing.
- Soft warnings (exit 0): summarize and offer to address. The complete set is `tag-namespace`, `stale-updated`, `diataxis-mismatch`, `code-ref` (a `code_refs` path that is gone, or a `#symbol` that drifted), `dangling-link` (a `[[wikilink]]` resolving to no note, alias, or file — grouped by target), and `prose-claim` (a sentence asserting a filesystem state the filesystem contradicts). Nothing else is checked. The last three are whole-vault: they run under `--all` only, never from the write hook.

Read the denominator, not just the counts: the final line reports `N nodes, M files`. "0 hard, 0 soft" over 0 nodes is a vacuous pass, not a clean vault.

Do not report more than lint checked. It does not detect node orphanhood, hand-written inverse edges, `## Relations` drift, or a `canonical` node whose body is all inference — those sit under "Not Yet Enforced" in `_meta/schema-spec.md`. A green lint is evidence about the rules above and nothing else.

Never weaken the validator to make a check pass; fix the node or the index.
