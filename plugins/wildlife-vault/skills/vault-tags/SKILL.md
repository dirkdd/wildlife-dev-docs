---
name: vault-tags
description: Audit and normalize tags in docs/vault/Knowledge against the governed taxonomy in _meta/taxonomy.md. Use when asked to check tags, normalize tag namespaces, or audit tag usage across the vault.
allowed-tools: Bash, Read, Edit
---
Run the vault-lint skill (or `node "${CLAUDE_PLUGIN_ROOT}/scripts/vault/validate.mjs" --all --project-dir="${CLAUDE_PROJECT_DIR}"`) and filter the output for tag-related soft warnings: unknown namespace, value not in taxonomy whitelist, misspelled domain slug.

Act on the output:
- Unknown namespace (e.g., `feature/x` instead of `domain/x`): report the node and the offending tag; offer to rename to the correct namespace.
- Unknown domain slug: check whether the slug should be added to the `domains` array in `docs/vault/.vault.json` (a deliberate new domain) or corrected to an existing slug (a typo).
- Misspelled or non-canonical values: offer to normalize in place.

After normalization, run `/vault-map` so any new domain slugs materialize as sub-indexes.

The governed tag vocabulary lives in `docs/vault/Knowledge/_meta/taxonomy.md`. The per-project domain whitelist lives in `docs/vault/.vault.json` (`domains`); `TAG_NAMESPACES` is fixed in the plugin's `scripts/vault/schema.mjs`. `taxonomy.md` is the human-readable mirror.
