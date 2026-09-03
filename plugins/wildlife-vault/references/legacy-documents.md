# Work with existing documentation

Use this guidance when adopting Vault alongside established documents or connecting
legacy artifacts to a typed vault. Improve discovery and evidence without requiring
a new directory layout, document format, or metadata vocabulary. The lifecycle and
atlas PRD describes possible future capabilities; it does not authorize migration.

For choosing PRD/ADR/data/API/test/retro families and connecting them across the
development workflow, use [document types](document-types.md) and
[lifecycle navigation](lifecycle.md).

## Find the authoritative home

Read the project's instructions and current documentation entry point. Follow its
declared precedence and the artifact relevant to the task. A session briefing can
be authoritative for current state while a contract owns constraints and a register
owns delivery status. Recency alone does not settle a conflict. If precedence does
not resolve it, report the competing claims and what decision or evidence is needed.

Reuse the existing portal, index, register, or tracker. For the affected documents,
identify the canonical path or external location, existing ID, purpose, owner,
authority, and next review trigger. Record unknowns as unknown. A plain Markdown
table is sufficient when the project has no metadata convention; do not add YAML
or renumber documents merely to make them discoverable.

| Existing artifact | Preserve | Useful vault treatment, when needed |
|---|---|---|
| PRD, specification, design brief | Requirements, IDs, approval state, canonical path | Extract concepts, invariants, flows, or data contracts; cite the source |
| ADR or decision register | Decision ID, format, deciders, outcome, supersession | Link the authoritative ADR; retain native vault decisions when already used |
| Architecture view or interface contract | Viewpoint, version, intended/as-built label | Connect module, flow, and data nodes to the relevant view |
| Plan, test matrix, risk or access register | Existing rows, IDs, owners, dates, column meanings | Link the tracker; distill durable rules without copying changing status |
| Runbook or operating guide | Executable steps and its canonical home | Link it or maintain the existing native node; avoid two procedure copies |
| Research, incident analysis, historical report | As-of date, provenance, corrections, original evidence | Extract qualified findings; link supersession without rewriting history |
| Agent pointer, kickoff, current-state briefing | Project read order and each file's declared responsibility | Route through it; keep pointers free of duplicated state |
| CSV, JSON, Word, PDF, or externally hosted source | Format, location, access boundary, version | Cite the source; author a Markdown summary only if useful and authorized |

These are source artifact roles, not new Vault `type` or `doc_class` values.
Files outside the configured typed vault do not need the vault node schema.
Existing legacy documents already inside a typed root may fail its validator;
report that boundary and use project checks for those artifacts until an explicit
integration choice is made. Do not move files, exempt failures, or relabel them
as valid nodes to obtain a pass. Maintenance can run without a typed vault.

## Use one maintained register

Extend the existing register only with fields needed for the task. For example,
this fictional row can live in an existing project index:

| Existing ID | Canonical location | Role / authority | Owner | Source state | Review trigger |
|---|---|---|---|---|---|
| SPEC-042 | `specs/order-contract.md` | Interface contract | API team | Approved; implementation pending | Contract or implementation changes |

Keep the source's status vocabulary, including values such as `approved`, `active`,
`withdrawn`, or lifecycle stages such as `spec` and `specify`. Vault node `status`
describes the node; it must not overwrite the source's lifecycle or imply that its
claims are verified. A link resolving successfully proves neither authority nor
implementation. Do not create a second status board in the vault.

Traceability can use existing tracker columns. Add a separate matrix only when the
project needs it. Keep absent evidence visible:

| Requirement | Authoritative source | Decision / design | Implementation | Verification evidence | Next action |
|---|---|---|---|---|---|
| FR-042 | `specs/order-contract.md` | Existing ADR-007 | Pending | Not run | Owner schedules the integration check |

Approved intent, implemented behavior, and observed verification are different
claims. Record the relevant revision, observation date, and actual result when
evidence exists. Do not mark a requirement verified because a design was approved,
a PR merged, or a test command was proposed. A document edit date is not a new
verification date. Preserve source row semantics: for example, close a finding
through its existing resolution fields rather than overwriting what was found.

## Connect sources to nodes without copying them

Choose the smallest useful representation:

- Edit the existing source for changes to its requirements, procedure, or status.
- Add a normal Markdown link from the existing portal for navigation alone.
- Add or update a typed node when there is durable knowledge to distill. Choose its
  type by the knowledge it describes, not by the source file extension or label.

For a derived node, use `sources` for the source pointer and a body link for human
navigation. Identify the relevant section, artifact ID, and source revision/as-of
date when that matters to the claim. Use `extracted` for claims read from a document
and `inferred` for deductions; verify runtime claims against the implementation.
Use `rel_*` only for existing vault node IDs, not legacy artifact IDs. An external
ADR can remain the source of a distilled node without becoming a duplicate decision
record. Do not imply its status was parsed or enforced by the vault validator.

A source-pointer example (not a complete node):

```yaml
provenance: extracted
sources:
  - "specs/order-contract.md"
```

Use the consumer's path convention; repository-relative paths are useful for
local sources. Binary and external sources remain in their current approved
locations. A local file link can be checked for existence without interpreting
its contents. Missing restricted sources remain evidence gaps, not a reason to
copy them into Git or reconstruct them. External URLs remain unchecked by the
maintenance helper.

## Resolve existing document IDs without rewriting sources

The optional maintenance helper always recognizes `id`, flat `aliases`, paths,
and basenames for wikilinks. Its version-1 policy can additionally name existing
flat frontmatter ID fields:

```json
{
  "version": 1,
  "scopes": [{"path": "specs", "role": "active"}],
  "documentIdFields": ["document_id", "artifact_id"]
}
```

With `document_id: SPEC-042` already in `specs/order-contract.md`, a wikilink
`[[SPEC-042]]` resolves without renaming the file or adding aliases. The fields
are additive; omitting them preserves prior resolution. Only nonempty scalar
strings from supported flat frontmatter are used. Arrays and nested metadata
are not document IDs. Plain documents need no frontmatter: link their paths.

The helper uses a lightweight lexical parser, not full YAML typing: unquoted
`42` and `null` are literal names. Inline comments and quoted escape sequences
are retained rather than interpreted. Prefer simple literal IDs, without inline
comments; block scalars, anchors, aliases, and tags are unsupported. If existing
metadata needs full YAML semantics, use project tooling or path links instead
of rewriting the source merely to accommodate this helper.

This is name resolution, not ID uniqueness enforcement or authority ranking.
Two documents claiming the same name remain ambiguous when linked, including an
ID colliding with an alias or basename. Qualify the link by an unambiguous path
and investigate ownership; do not renumber historical artifacts to silence it.
Normal Markdown links still resolve as paths, and heading fragments remain
unchecked. This setting does not change `/vault-map`, typed `rel_*` validation,
`/vault-link`, or the consumer's renderer. Use real paths when that renderer does
not support metadata IDs. See [maintenance policy and limits](maintenance.md).

Assign audit roles by responsibility. A maintained kickoff that governs current
work needs `role: active`; reserve `role: kickoff` for execution records whose
link debt should be historical warnings. A filename containing "kickoff" does
not make an authoritative current-state document historical. Exact file scopes
can override a surrounding historical directory.

## Adopt incrementally and verify the result

1. Identify the requested change and the existing authority, tracker, and checker.
2. Preserve source paths, IDs, formats, headings/anchors, and column meanings.
   Add the navigation or distilled knowledge needed for the task.
3. If a move or conversion is explicitly requested, record old and new locations,
   repair inbound links, preserve provenance and approval history, and verify the
   original references still lead to the intended artifact. Do not silently widen
   that migration to unrelated documents.
4. Verify the affected source-to-node and requirement-to-evidence links. Run typed
   lint/map only for typed vault changes, and the project's checker or scoped
   maintenance helper for legacy documents. Report each check's measured scope
   and limits; a clean vault lint says nothing about unscanned lifecycle documents.
5. Update the existing hub/tracker with the outcome and any pending evidence.
   Read-only reviews end with findings and do not create registers or nodes.

Across projects, share the reusable technique and synthetic examples. Keep local
evidence in the learning node's private evidence section. A contribution should
name the compatibility behavior, the tested plugin revision, and the checks that
actually ran; it must not imply the upgrade is installed in every project.
