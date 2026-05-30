---
id: index
title: "Vault: Router"
type: moc
doc_class: reference
summary: "Tier-0 router. Read first. Routes to sub-indexes; open node bodies on demand."
status: canonical
provenance: verified
tags: ["area/meta"]
updated: 2026-05-29
---
# Vault: Router

Read this file first every session, before working in a domain. Then open only the sub-index and the node bodies you need. Do not read the whole vault.

## How to walk the vault

1. Find your entry point. If the task names a domain (a feature area listed in the catalog below), open `index-domain-<that-domain>`. Otherwise open `[[index-by-type]]` and scan by structural type.
2. Read the row `summary` before opening any body. The summary tells you whether the body is worth loading.
3. From a body, follow the typed `rel_*` links: `rel_depends_on` for blast radius, `rel_governed_by` / `rel_decided_in` before changing an invariant or a decision, `rel_part_of` to climb to the owning map of content.
4. Cap the walk at about 3 hops and 1-2 open indexes at a time. Fall back to search only when the curated structure misses; when it does, the index is stale, so run `/vault-map` then `/vault-lint`.

## Schema

Full contract: [[schema-spec]]. Machine mirror: [[schema]]. Tag vocabulary: [[taxonomy]].

## Catalog

<!-- vault-map:begin -->
<!-- vault-map:end -->
