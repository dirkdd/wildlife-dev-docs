---
id: schema-spec
title: "Vault: Frontmatter Schema"
type: reference
doc_class: reference
summary: "Full human-facing frontmatter contract: fields, enums, rel_* semantics."
status: canonical
provenance: verified
tags: ["area/meta", "class/reference"]
updated: 2026-08-17
rel_part_of:
  - "[[index]]"
---
# Frontmatter Schema

Mirrors `scripts/vault/schema.mjs`. The machine file is the source of truth for enums; this node is the human-readable contract. When they diverge, fix `schema.mjs` and update this node.

Everything below is split into what the validator **enforces today** and what is **not yet enforced**. A rule in the roadmap section is a shape worth writing to, but nothing checks it — do not read it as a guarantee, and do not cite it as evidence that something was checked.

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
| `code_refs` | list | `path` or `path#symbol`; liveness-checked — see the enforcement sections below for by what, and at what severity |
| `aliases` | list | alternate names for `/vault-link` matching |
| `c4_level` | string | on `module` and `flow` nodes: `context | container | component | code | dynamic | deployment` |
| `decision_status` | enum | on `decision` nodes only: `proposed | accepted | rejected | deprecated | superseded-by` |
| `deciders` | list | on `decision` nodes only: names or roles who made the call |
| `learning_kind` | enum | on `learning` nodes only: `type | strategy | taxonomy | validation | technique` |
| `learning_status` | enum | on `learning` nodes only: `proposed | harvested | adopted | rejected` |
| `adopted_in` | string | on `learning` nodes only: the plugin version that adopted it, e.g. `wildlife-vault@0.2.0` |

## Type Enum

```
concept | module | flow | data | invariant | decision | runbook | guide | reference | moc | learning
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
| learning | `_meta/learnings/` |

## Doc Class Enum

```
prd | design | spec | plan | kickoff | adr | analysis | user-journey | runbook | guide | knowledge | reference | learning
```

Doc class drives the Obsidian graph color, but **not** through the `doc_class` property: `.obsidian/graph.json` holds tag queries of the form `tag:#class/<doc_class>`, because property-based graph queries silently match nothing on many Obsidian builds. That is why every node also carries the mirror tag `class/<doc_class>` — a node without it is grey in the graph. Regenerate the color groups with `/vault-colorize`.

## Status Enum

```
draft | canonical | stale | deprecated
```

Status is the doc lifecycle, orthogonal to `provenance`. A node can be `canonical` (doc is authoritative) while recording a `deprecated` decision.

## Provenance Enum

```
verified | extracted | inferred | ambiguous
```

- `verified`: you opened the code yourself and saw the behavior the node claims. A green test suite is not verification.
- `extracted`: pulled from a doc (PRD, spec, postmortem).
- `inferred`: synthesized from multiple sources; not directly confirmed.
- `ambiguous`: conflicting sources; requires human resolution.

Mark `verified` only when you have opened the code path and seen the claimed behavior — a test that passes can be self-authored against the author's own blind spot, can silently skip when a service is missing, or can sit in a file CI never invokes, and all three read as green. Use `extracted` or `inferred` otherwise. Cite `sources` whenever possible. On a fresh project whose only source is the PRD, most early nodes are `extracted` (straight from the PRD) or `inferred` (your synthesis); they graduate to `verified` once code exists and you check it.

## Type / Doc Class Consistency Rules

Four types enforce a fixed `doc_class`; all others vary independently:

| type | required doc_class |
|---|---|
| `decision` | `adr` |
| `runbook` | `runbook` |
| `moc` | `reference` |
| `learning` | `learning` |

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

Inverse labels are derived at read time and are never stored. Do not hand-write an inverse edge — but note that nothing checks this today (`INVERSE_RELS` in `schema.mjs` is declared for export/derivation and is read by no validator pass).

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

A body `## Relations` section is optional (for human readability). Nothing checks it against the frontmatter `rel_*` properties, so a drifted section is a lie no gate will catch — prefer leaving it out over letting it rot.

## Hard-Block Conditions

A write is blocked (exit 2 from the hook, exit 1 from `/vault-lint --all`) on any of these. Each one is implemented in `scripts/vault/passes.mjs`:

- Unparseable YAML in the frontmatter block
- A required field missing (or present but empty)
- An enum value not in the declared set (`type`, `doc_class`, `status`, `provenance`, `diataxis`)
- A `type`/`doc_class` consistency violation
- `id` does not equal the filename (without `.md`)
- A duplicate `id` across the vault
- A nested mapping anywhere in frontmatter (e.g. a `relations:` map)
- An unquoted wikilink in any frontmatter list item
- An unknown `rel_*` key not in the allowed set above
- A `rel_*` value that is not in `"[[id]]"` form
- `rel_supersedes` / `rel_superseded_by` on a node that is not a `decision`
- A relation target that resolves to no existing vault node
- A `decision` node missing any of the three required MADR headings (Context and Problem Statement, Considered Options, Decision Outcome)

Know the one asymmetry in how these are applied: the PreToolUse hook only sees file content for a **Write**. An **Edit** is validated by PostToolUse — after the bytes are on disk — so a hard rule blocks a full-file write and merely reports a bad edit. Batch edits that fail have to be reverted by hand.

## Vault-Wide Gates (`/vault-lint` only)

These run over the whole node set, only under `--all`. They never run from a hook, so they can never block a write — the worst they do is turn the lint red.

Hard:

- The configured `vaultRoot` does not exist on disk
- Markdown files are present under the vault root but none of them parsed as a node (the lint measured nothing)
- A node that does not appear in the generated `_meta/index-by-type` region (run `/vault-map`)
- An `index-domain-*.md` whose domain has no member nodes
- A populated `domain/*` with no `index-domain-*.md`

`/vault-lint` prints the denominator it measured — `N nodes, M files` — alongside the counts. A "0 hard, 0 soft" over 0 nodes is not a clean vault; it is a lint that ran over nothing.

## Soft Warnings — Enforced Today (Exit 0)

These pass, but appear in the report. This list is exhaustive: it is the complete set of soft warnings the tooling can emit, and the plugin's own test suite fails if any entry here stops firing.

- `tag-namespace` — a tag whose namespace is not one of `domain/`, `audience/`, `area/`, `class/`.
- `stale-updated` — `updated` is older than 120 days.
- `diataxis-mismatch` — `diataxis` is unusual for the node's `type` (see the cross-check table above).
- `code-ref` — a `code_refs` entry whose path is gone, or whose `#symbol` is no longer in the file. `/vault-lint --all` reports both halves as soft; `/vault-status` reports the missing path as hard, because it is a deliberate audit rather than a gate. Not run from the hooks: a filesystem probe over every ref on every write is the wrong budget, and a path deleted in the same commit as the doc must never deny the write.
- `dangling-link` — a body `[[wikilink]]` resolving to no note, alias, or file. Grouped by target, not by occurrence. Resolution is deliberately WIDER than the scan: `linkRoots` (default: the vault root) decides which files are checked, `linkResolveRoots` (default: the whole project) decides what counts as resolving — an ADR in `docs/ADR/` declaring `aliases: [ADR-0018]` resolves a link from inside the vault. Under-resolving accuses a healthy link; over-resolving is only silent.
- `prose-claim` — a body sentence asserting a filesystem state ("`scripts/foo.mjs` does not exist") that the filesystem contradicts. Silent unless the filesystem disagrees: there is no path from a true claim to a warning. Exempt: `decision`, `adr`, `learning`, `deprecated`; opt out one line with `vault-ok: prose-claim`.

The first three come from the per-file passes and reach both the lint and the hook's advisory context. `code-ref`, `dangling-link` and `prose-claim` are whole-vault and only run under `--all` — never in the hook path, because heuristic attribution must never deny a write.

On `stale-updated`, know what it cannot catch: an absolute threshold only fires on nodes nobody touched for four months, and the nodes that rot hardest are a cohort seeded on one day describing a scaffold that has since been rebuilt — a set that sits far inside the threshold and never approaches it. Treat the oldest slice of the vault by `updated` as the re-verification queue regardless of what this warning says; see "Staleness: the threshold and the cohort" in the plugin's `docs/STANDARD.md`.

## Not Yet Enforced (Roadmap)

Shapes worth writing to; **no code checks any of them**. Earlier versions of this document listed them as soft warnings, which was untrue.

- `orphan-node` — a node with no inbound or outbound edges. (Nothing computes node orphanhood. The `orphanedDomainIndexes` gate is about index files, not nodes.)
- `stored-inverse-edge` — a hand-written inverse of an existing edge. (`INVERSE_RELS` is declared in `schema.mjs` and read by no pass.)
- `provenance-mix` — `status: canonical` on a body dominated by `inferred`/`ambiguous` claims. (`provenance` is only checked against its enum.)
- `relations-drift` — a body `## Relations` section that disagrees with the frontmatter `rel_*` properties. (No rule reads that heading.)
- `vault-lint-disable` — a per-file `vault_lint_disable: [rule-name]` opt-out. No script reads this key, so a node carrying it gets no opt-out **and** no error. Do not use it; there is no way to suppress a single rule today.
