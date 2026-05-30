---
name: vault-tags
description: Audit and normalize tags in docs/vault/Knowledge against the governed taxonomy in _meta/taxonomy.md. Use when asked to check tags, normalize tag namespaces, or audit tag usage across the vault.
allowed-tools: Bash, Read, Edit
---
Run `npm run vault:lint` from the repo root and filter the output for tag-related soft warnings: unknown namespace, value not in taxonomy whitelist, misspelled domain slug.

Act on the output:
- Unknown namespace (e.g., `feature/x` instead of `domain/x`): report the node and the offending tag; offer to rename to the correct namespace.
- Unknown domain slug: check whether the slug should be added to `DOMAIN_WHITELIST` in `scripts/vault/schema.mjs` (a deliberate new domain) or corrected to an existing slug (a typo).
- Misspelled or non-canonical values: offer to normalize in place.

After normalization, run `/vault-map` so any new domain slugs materialize as sub-indexes.

The governed tag vocabulary lives in `docs/vault/Knowledge/_meta/taxonomy.md`. Updates to the whitelist go in `scripts/vault/schema.mjs` (`DOMAIN_WHITELIST`, `TAG_NAMESPACES`); taxonomy.md is the human-readable mirror.
