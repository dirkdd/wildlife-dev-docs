---
id: schema-spec
title: "Vault: Frontmatter Schema"
type: reference
doc_class: reference
summary: "Full human-facing frontmatter contract: fields, enums, rel_* semantics."
status: canonical
provenance: verified
tags: ["area/meta"]
updated: 2026-05-29
rel_part_of:
  - "[[index]]"
---
# Frontmatter Schema

Mirrors `scripts/vault/schema.mjs`. The machine file is the source of truth for enums; this node is the human-readable contract. When they diverge, fix `schema.mjs` and update this node.

## Required Fields

Every vault node must carry all nine of these fields. A missing field is a hard error that blocks the write.

| Field | Type | Rule |
|---|---|---|
| `id` | string | kebab-case; equals the filename without `.md`; unique across the entire vault |
| `title` | string | human-readable title |
| `type` | enum | see Type enum below; determines folder and template |
| `doc_class` | enum | see Doc Class enum below; drives graph color |
| `summary` | string | one or two sentences; this is what the index shows and what sessions read before opening the body |
| `status` | enum | `draft | canonical | stale | deprecated`; the doc lifecycle |
| `provenance` | enum | `verified | extracted | inferred | ambiguous` |
| `tags` | list | namespaced strings; validated against `_meta/taxonomy.md` |
| `updated` | date | ISO date (`YYYY-MM-DD`) |

## Optional Fields

| Field | Type | Notes |
|---|---|---|
| `diataxis` | enum | `tutorial | how-to | reference | explanation`; soft-checked against `type` |
| `sources` | list | repo paths or URLs this node distills; never duplicated into the body |
| `code_refs` | list | `path` or `path#symbol`; liveness-checked by `/vault-status` |
| `aliases` | list | alternate names for `/vault-link` matching |
| `c4_level` | string | on `module` and `flow` nodes: `context | container | component | code | dynamic | deployment` |
| `decision_status` | enum | on `decision` nodes only: `proposed | accepted | rejected | deprecated | superseded-by` |
| `deciders` | list | on `decision` nodes only: names or roles who made the call |

## Type Enum

```
concept | module | flow | data | invariant | decision | runbook | guide | reference | moc
```

Each type maps to a folder:

| type | folder |
|---|---|
| concept | `concepts/` |
| module | `modules/` |
| flow | `flows/` |
| data | `data/` |
| invariant | `invariants/` |
| decision | `decisions/` |
| runbook | `runbooks/` |
| guide | `guides/` |
| reference | `_meta/` |
| moc | `_meta/` |

## Doc Class Enum

```
prd | design | spec | plan | kickoff | adr | analysis | user-journey | runbook | guide | knowledge | reference
```

Doc class drives the Obsidian graph color (via `doc_class:"<value>"` property queries in `.obsidian/graph.json`). Regenerate colors with `/vault-colorize`.

## Status Enum

```
draft | canonical | stale | deprecated
```

Status is the doc lifecycle, orthogonal to `provenance`. A node can be `canonical` (doc is authoritative) while recording a `deprecated` decision.

## Provenance Enum

```
verified | extracted | inferred | ambiguous
```

- `verified`: checked against code.
- `extracted`: pulled from a doc (PRD, spec, postmortem).
- `inferred`: synthesized from multiple sources; not directly confirmed.
- `ambiguous`: conflicting sources; requires human resolution.

Mark `verified` only when you have checked the code. Use `extracted` or `inferred` otherwise. Cite `sources` whenever possible. On a fresh project whose only source is the PRD, most early nodes are `extracted` (straight from the PRD) or `inferred` (your synthesis); they graduate to `verified` once code exists and you check it.

## Type / Doc Class Consistency Rules

Three types enforce a fixed `doc_class`; all others vary independently:

| type | required doc_class |
|---|---|
| `decision` | `adr` |
| `runbook` | `runbook` |
| `moc` | `reference` |

A `decision` node with `doc_class: design` is a hard error.

## Diataxis Cross-Check (Soft)

When `diataxis` is present, the validator soft-warns on mismatches:

| type | expected diataxis |
|---|---|
| `runbook` | `how-to` |
| `concept` | `explanation` |
| `data` | `reference` |
| `reference` | `reference` |
| `guide` | `how-to` or `explanation` |

## Tag Namespaces

Tags must use a governed namespace. Unknown namespaces are soft-warned.

```
domain/*   — your project's feature domains, defined in DOMAIN_WHITELIST (scripts/vault/schema.mjs)
audience/* — intended reader (e.g. engineering, ops, product, leadership)
area/*     — cross-cutting concern (e.g. meta, security, performance, i18n)
class/*    — optional mirror of doc_class for Obsidian color fallback
```

`DOMAIN_WHITELIST` is empty on a fresh install. Add a slug there and run `/vault-map` to materialize its sub-index. A `domain/*` tag whose slug is not whitelisted is a soft warning, never a block.

## Flat `rel_*` Relation Properties

Relations are **flat top-level YAML properties**, never nested under a `relations:` key. Each value is a list of **quoted wikilinks**: `- "[[node-id]]"`. Unquoted `[[...]]` in a `rel_*` property is a hard error (YAML parses it as a sequence).

Allowed relation keys (closed set; additions require a `schema.mjs` change and an ADR):

| key | semantics | direction |
|---|---|---|
| `rel_documents` | this node documents a code surface or feature | -> module/flow/data |
| `rel_depends_on` | this node's subject depends on another node's subject | -> any |
| `rel_governed_by` | this node is constrained by an invariant | -> invariant |
| `rel_decided_in` | this node's design was decided in an ADR | -> decision |
| `rel_part_of` | this node belongs to a parent MOC or module | -> moc/module |
| `rel_related` | symmetric catch-all for non-directional associations | -> any |
| `rel_supersedes` | this decision supersedes an older decision | decision only -> decision |
| `rel_superseded_by` | this decision was superseded by a newer one | decision only -> decision |

Inverse labels are derived at read time and are never stored. Storing a hand-written inverse edge triggers a soft-warn.

Example on a `flow` node:

```yaml
rel_documents:
  - "[[module-example]]"
rel_depends_on:
  - "[[data-example]]"
rel_governed_by:
  - "[[invariant-example]]"
rel_decided_in:
  - "[[decision-example]]"
```

A body `## Relations` section is optional (for human readability). The validator soft-warns when it drifts from the frontmatter `rel_*` properties.

## Hard-Block Conditions

A write is blocked (exit 2) on any of these:

- A nested `relations:` map anywhere in frontmatter
- An unquoted wikilink in a `rel_*` property
- An unknown `rel_*` key not in the allowed set above
- A relation target that resolves to no existing vault node
- A duplicate `id` across the vault
- `id` does not equal the filename (without `.md`)
- An enum value not in the declared set
- A `type`/`doc_class` consistency violation
- A required field missing
- Unparseable YAML in the frontmatter block

## Soft Warnings (Exit 0)

These pass but appear in the lint report:

- An orphan node (no inbound or outbound edges)
- `updated` older than 120 days
- Stored inverse edge (hand-written)
- `code_refs` symbol not found in the referenced file (path exists but symbol drifted)
- Provenance-mix: `status: canonical` but body dominated by `inferred`/`ambiguous` claims
- Unknown tag namespace
- `diataxis` value mismatches the soft cross-check table above
- A `## Relations` body section that drifts from `rel_*` frontmatter

## Per-File Opt-Out

A node can opt out of a specific rule with `vault_lint_disable: [rule-name]` in its frontmatter. Use sparingly and document the reason in the body.
