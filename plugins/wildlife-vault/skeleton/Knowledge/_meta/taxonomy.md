---
id: taxonomy
title: "Vault: Tag Taxonomy"
type: reference
doc_class: reference
summary: "Governed tag vocabulary: domain/*, audience/*, area/*, class/*."
status: canonical
provenance: verified
tags: ["area/meta", "class/reference"]
updated: 2026-05-29
rel_part_of:
  - "[[index]]"
---
# Tag Taxonomy

The governed tag namespaces. A tag in an unknown namespace is a soft warning.

- `domain/*`: your project's feature domains. Empty until you define them. Add each slug here and in `DOMAIN_WHITELIST` (`scripts/vault/schema.mjs`), then run `/vault-map` to materialize its sub-index.
- `audience/*`: intended reader (e.g. `engineering`, `ops`, `product`, `leadership`).
- `area/*`: cross-cutting concern (e.g. `meta`, `security`, `performance`).
- `class/*`: optional `doc_class` color mirror (fallback only).
