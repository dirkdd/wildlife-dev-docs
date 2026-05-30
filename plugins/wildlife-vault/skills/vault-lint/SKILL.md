---
name: vault-lint
description: Run the full vault health check (schema, structural, graph, and index-drift gates) and report or fix violations. Use when asked to lint, validate, or check the health of docs/vault/Knowledge.
allowed-tools: Bash, Read, Edit
---
Run `npm run vault:lint` from the repo root. It validates every node and the generated indexes.

- Hard errors (exit 1): report each with its file, and offer to fix the offending frontmatter or run `/vault-map` if the failure is index-drift (coverage / missing sub-index).
- Soft warnings: summarize and offer to address (orphans, stale `updated`, unknown tag namespace, provenance-mix, code_ref drift).

Never weaken the validator to make a check pass; fix the node or the index.
