---
name: vault-map
description: Regenerate the vault router and all sub-indexes (index-by-type, index-domain-*, schema mirror) from live frontmatter. Use when asked to regenerate the index, update the vault map, or after adding or moving nodes.
allowed-tools: Bash, Read
---
Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/vault/index.mjs" --project-dir="${CLAUDE_PROJECT_DIR}"`. It regenerates the `<!-- vault-map:begin/end -->` regions in `_meta/index.md`, `_meta/index-by-type.md`, every `_meta/index-domain-*.md`, and `_meta/schema.md` from live node frontmatter.

After it completes, report the node count, domain count, and sub-index count from the script output.

Key behaviors to communicate:
- Curated anchor sections in domain sub-indexes sit outside the generation markers and are never overwritten.
- A new whitelisted `domain/*` value triggers creation of a new `index-domain-<slug>.md`.
- The command is idempotent; running it twice produces no diff.

If the run fails, check that all vault nodes have valid frontmatter (run `/vault-lint` first).
