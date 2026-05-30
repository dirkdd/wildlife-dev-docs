# The Vault Standard

The contract and the operating rules for the vault. The machine-readable source of truth for enums and structure is `scripts/vault/schema.mjs`; the human-readable frontmatter contract lives in the vault itself at `docs/vault/Knowledge/_meta/schema-spec.md`. This document explains the whole system and why it is shaped the way it is.

## 1. Goal

A code project accumulates documentation that captures history, not navigable current truth. Sessions re-derive how things work, get it subtly wrong, and reintroduce bugs. The vault is an agent-maintained knowledge base that holds the current state as a small, typed, validated graph. An agent loads a tiny, accurate slice (a flow, its data contracts, its invariants) before touching code, and writes back what it learns.

Success criteria: a malformed node cannot land silently; a session can find and load the relevant nodes from a static index without reading the whole vault; the graph is navigable and colored by document class; the standard is enforced by code, not by vigilance.

## 2. Architecture

Four layers, each with one job.

| Layer | Lives in | Job |
|---|---|---|
| Scripts (deterministic) | `scripts/vault/` | validate, index, colorize, tag-audit, link-scan, status. Pure, cross-platform Node ESM, no dependencies. |
| Hooks (enforcement) | `.claude/settings.json` | run the validator on writes into the vault; inject an L0 pointer at session start. |
| `vault-author` skill (judgment) | `.claude/skills/vault-author/` | how to author and maintain a correct node. |
| Commands (operator entry) | `.claude/skills/vault-*/` | run a script, then drive the agent to act on the result. |

One schema is the source of truth. `scripts/vault/schema.mjs` exports the enums, required fields, relation keys, the type-to-folder map, the type/doc_class consistency matrix, the tag namespaces, the inverse-label map, and the domain whitelist. The validator imports it; the indexer reads it plus live frontmatter to materialize the router and sub-indexes.

Vault layout (folders map to structural `type`; the graph lives in links, not folders):

```
docs/vault/Knowledge/
  _meta/
    index.md            # tier-0 router (read first), generated region
    index-by-type.md    # tier-1 sub-index: all nodes grouped by type (generated)
    index-domain-*.md   # tier-1 sub-indexes: one per domain (generated + curated anchors)
    schema-spec.md      # full human-facing frontmatter contract
    schema.md           # short machine-mirror of schema.mjs (generated)
    taxonomy.md         # governed tag vocabulary
    .manifest.json      # ingested-source ledger for staleness detection
  concepts/  modules/  flows/  data/  invariants/
  decisions/  runbooks/  guides/  _raw/
  .obsidian/            # committed graph + app config
```

## 3. Frontmatter contract

Three classification axes plus a documentation-mode axis.

- `type` (structural, drives folder and template): `concept | module | flow | data | invariant | decision | runbook | guide | reference | moc`
- `doc_class` (lineage, drives graph color): `prd | design | spec | plan | kickoff | adr | analysis | user-journey | runbook | guide | knowledge | reference`
- `tags` (governed namespaces): `domain/* | audience/* | area/*` (and optional `class/*`)
- `diataxis` (documentation mode, optional): `tutorial | how-to | reference | explanation`

Required on every node: `id`, `title`, `type`, `doc_class`, `summary`, `status`, `provenance`, `tags`, `updated`. Optional: `diataxis`, `sources`, `code_refs`, `aliases`, the `rel_*` relations, `c4_level` (module/flow), and `decision_status` + `deciders` (decision nodes).

| Field | Rule |
|---|---|
| `id` | kebab-case, equals filename without `.md`, unique across the vault |
| `summary` | one or two sentences; powers tiered retrieval; written for someone without context |
| `status` | `draft \| canonical \| stale \| deprecated` (doc lifecycle) |
| `provenance` | `verified \| extracted \| inferred \| ambiguous` |
| `sources` | repo paths or URLs the node distills; never duplicated into the body |
| `code_refs` | `path` or `path#symbol`; liveness-checked |

Consistency rules the validator enforces: `type: decision` implies `doc_class: adr`; `type: runbook` implies `doc_class: runbook`; `type: moc` implies `doc_class: reference`. All other types vary independently. `diataxis`, when present, is soft-checked against `type`.

### Worked example (a `flow` node)

```yaml
---
id: checkout-pipeline
title: Checkout Pipeline
type: flow
doc_class: design
diataxis: explanation
summary: "Turns a populated cart into a paid order: validates stock, authorizes payment, then emits order.created."
status: canonical
provenance: extracted
tags: ["domain/billing", "audience/engineering"]
updated: 2026-05-29
sources: ["docs/prd/checkout.md"]
code_refs: ["lib/checkout/pipeline.ts#runCheckout"]
aliases: ["checkout flow"]
rel_documents:
  - "[[module-cart]]"
rel_depends_on:
  - "[[data-order]]"
rel_governed_by:
  - "[[invariant-no-oversell]]"
rel_decided_in:
  - "[[decision-sync-payment-auth]]"
---
```

### Hard-block conditions

A write is blocked on any of: a nested `relations:` map; an unquoted wikilink in a `rel_*` property; an unknown `rel_*` key; a relation target that resolves to no existing node; a duplicate `id`; `id` not equal to filename; an unknown enum value; a `type`/`doc_class` consistency violation; a missing required field; unparseable YAML.

### Registering new types and domains

A new `type` is added to the `type` enum, `CATEGORY_DIRS`, `CATEGORY_ORDER`, and (if it forces a `doc_class`) `TYPE_DOC_CLASS` in `schema.mjs`, gets a `templates/<type>.md`, and is recorded in an ADR. Until registered, a node of an unknown type lands in the `other` bucket of `index-by-type` (visible, never dropped). A new domain is added to `DOMAIN_WHITELIST`; the next `/vault-map` materializes its `index-domain-<slug>.md`. Keep the type count near the seven-to-ten sweet spot; adding one is a deliberate act.

## 4. Relations and the graph

Relations are **flat top-level `rel_*` properties**, never a nested `relations:` map. Each value is a YAML list of quoted wikilinks: `- "[[node-id]]"`. Unquoted `[[...]]` is malformed and does not parse as a link.

Allowed keys (closed; extended only in `schema.mjs`): `rel_documents`, `rel_depends_on`, `rel_governed_by`, `rel_decided_in`, `rel_part_of` (hierarchical), `rel_related` (symmetric), and `rel_supersedes` / `rel_superseded_by` (decision nodes only).

A quoted wikilink in a top-level frontmatter list property renders as a native edge in the Obsidian Graph view, with no plugin. So the `rel_*` layer is simultaneously the machine-walkable relation layer (typed by the YAML key) and the visual graph. No duplication. A `## Relations` body section is optional, for human readability; the validator soft-warns if it drifts from the frontmatter.

Node color comes from `doc_class` via committed graph color groups that match the property directly (`doc_class:"prd"`). Regenerate them with `/vault-colorize` after changing the `doc_class` enum. Requires Obsidian 1.4+ for property queries.

Inverse edges are derived at read time, never stored. `schema.mjs` holds the inverse-label map (`documents<->documented_by`, `depends_on<->required_by`, `governed_by<->governs`, `decided_in<->decides`, `part_of<->contains`, `supersedes<->superseded_by`). A hand-written stored inverse edge gets a soft-warn.

## 5. Validator

`scripts/vault/validate.mjs`, Node ESM, cross-platform. Path guard first: if the target is not a `.md` file under the vault root, it exits 0 immediately and never interferes with normal repo edits.

Three passes mirroring severity:

1. **Frontmatter schema (hard):** required fields, enum membership, kebab `id` equals filename, well-formed YAML, MADR sections on decisions.
2. **Structural cross-file (hard):** duplicate `id`, `type`/`doc_class` consistency, `type`/folder placement, quoted-wikilink format, nested-`relations` rejection, unknown `rel_*` key.
3. **Graph (mixed):** broken relation target (hard); orphan, stale `updated`, stored inverse edge, `code_refs` drift, provenance-mix, body-Relations drift (soft).

Modes: `--mode=pre` reads new content from the Write tool input; `--mode=post` re-reads the file from disk (this is where Edit results are validated, since an Edit does not expose the resulting file at pre time). `--all` validates the whole vault plus the index-drift gates, for `/vault-lint` and CI.

Output contract: a hard violation exits 2 and emits a deny decision so the reason enters the agent's context; soft violations exit 0 and emit warnings as additional context. Robustness: frontmatter is parsed with zero dependencies; CRLF and BOM are normalized; a validator crash fails safe (logs and exits 0) so it never wedges writes, while a clean hard-fail still blocks. A per-file `vault_lint_disable: [rule-name]` opts a node out of a specific rule.

Index-drift gates (only in `--all`, CI-enforced, hard): a node missing from the generated `index-by-type`; a domain index file whose domain has zero members; a populated domain with no index file. Drift cannot survive a green build.

## 6. Hooks

Project `.claude/settings.json`, team-shared. `PreToolUse` and `PostToolUse` match `Write|Edit` and call the validator; `SessionStart` calls `session-context.mjs` to inject a compact L0 pointer (vault location, read-first rule, current domain list with counts). The path scope lives in the validator's path guard, not the matcher. The exec form (`command: node`, `args: [...]`) avoids `.cmd` shim resolution on Windows.

## 7. Skills and commands

`vault-author` carries the authoring judgment and stays lean; per-type body templates live in `templates/<type>.md` and load on demand. The commands are thin skills that each run a script and then act on the result:

| Command | Runs | Then |
|---|---|---|
| `/vault-new <type> <title>` | scaffold from `templates/<type>.md` | prefilled frontmatter; author the body |
| `/vault-lint` | `validate.mjs --all` | full report incl. index drift; offer fixes |
| `/vault-map` | `index.mjs` | regenerate router + sub-indexes + schema mirror |
| `/vault-status` | `status.mjs` | manifest delta + `code_refs` liveness |
| `/vault-link` | `link-scan.mjs` | insert wikilinks for unlinked known titles, interactively |
| `/vault-colorize` | `colorize.mjs` | regenerate graph color groups from `doc_class` |
| `/vault-tags` | `validate.mjs --tags` | audit and normalize tags against the taxonomy |

All commands are idempotent. `vault-author` runs `/vault-map` after every node write so the indexes never drift between full passes. Curated anchor sections in domain sub-indexes sit outside the generation markers and are never overwritten.

## 8. Decision nodes (MADR)

`type: decision`, `doc_class: adr`. Carries `decision_status` (`proposed | accepted | rejected | deprecated | superseded-by`), `deciders`, and `rel_supersedes` / `rel_superseded_by` for the supersession chain. `status` stays the orthogonal doc-lifecycle field. The validator hard-blocks a decision node missing **Context and Problem Statement**, **Considered Options**, or **Decision Outcome**. The full MADR skeleton ships in the `decision` template.

## 9. Diagram conventions

One convention: C4 expressed as a Mermaid flowchart (native Mermaid C4 blocks are experimental and fail silently, so they are reserved for throwaway sketches). A node label carries `[Person|System|Container|Component]`; a `subgraph` is a C4 boundary; external systems are suffixed `[external]`; every edge is verb-labeled. `module` and `flow` nodes may set `c4_level`. Diagrams are derived views, never the source of truth.

## 10. Tiered retrieval and the index

The index is a three-tier hierarchy, not one file, so context cost stays flat as the vault grows. All index files are generated between `<!-- vault-map:begin -->` and `<!-- vault-map:end -->` markers and are never hand-edited inside them. They are themselves nodes (`type: moc`), wired with `rel_part_of`.

- **Tier 0, the router (`_meta/index.md`).** Read first every session. Holds the read-first rule, the walking playbook, a schema pointer, a generated type catalog, and the sub-index directory. No node-instance rows.
- **Tier 1, the sub-indexes.** `index-by-type.md` (sectioned by type, with an `other` bucket) is the structural fallback. `index-domain-<slug>.md` (one per domain) is a curated map of content: a hand-anchored canonical-anchors section outside the markers, plus a generated coverage table.
- **Tiers 2 and 3, bodies and the walk.** Open a body only after its `summary` (mirrored in the index row) justifies it. From a body, walk the `rel_*` edges by semantics, with a 3-hop cap and a one-to-two-open-indexes rule.

Two rules keep this self-maintaining: an unindexed node is invisible to the agent (like an unregistered service to service discovery); and every task produces two outputs, the deliverable and the vault update.

## 11. Provenance and anti-drift

`provenance` is hard-validated: `verified` (checked against code), `extracted` (from a doc), `inferred` (synthesized), `ambiguous` (conflicting sources). Mark `verified` only when you checked the code.

Mechanisms: a soft provenance-mix warn when a `canonical` node's body is dominated by `inferred`/`ambiguous` claims with no backing; a targeted-edit-over-rewrite preference (a large diff to a `canonical`/`verified` node soft-warns, prompting human confirmation); `code_refs` liveness checks; and the manifest-based staleness report from `/vault-status`. Human-in-the-loop review is expected for `status: canonical` and `provenance: verified` nodes.

## 12. Taxonomy governance

`_meta/taxonomy.md` is the governed tag vocabulary; `/vault-tags` audits against it. Namespaces: `domain/*`, `audience/*`, `area/*`, and optional `class/*`. Domain slugs are whitelisted in `DOMAIN_WHITELIST` (`schema.mjs`); an unknown namespace or unwhitelisted domain is a soft-warn, never a block. `taxonomy.md` is the human mirror; `schema.mjs` is the source of truth.

## 13. Verification

The infrastructure is verifiable without any content: `npm run vault:lint` validates the skeleton and the generated indexes and must report zero hard violations. The validator's behaviors worth confirming on a target environment: a malformed Write is blocked; a valid Write is allowed; an Edit that breaks a relation is flagged in post; the path guard exits 0 outside the vault; CRLF and BOM inputs parse; a crash fails safe. If you adopt Obsidian, confirm that a `rel_*` frontmatter link renders as a graph edge and that a `doc_class` color group recolors a node (the `class/*` mirror tag is the fallback if a given Obsidian version does not color on the property query).
