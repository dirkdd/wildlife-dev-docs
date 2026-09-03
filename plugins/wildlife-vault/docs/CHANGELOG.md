# Changelog

Versions match `.claude-plugin/plugin.json`. Newest first.

## Unreleased

- Added `vault-lifecycle` with a document-family catalog, development lifecycle,
  directed relationship conventions, and task-specific reading routes. Covers
  intent, design, specifications, planning, implementation evidence, operations,
  and retrospectives while preserving each project's formats and ID conventions.
  This is an authoring/navigation workflow, not automatic lifecycle validation.

- Added legacy document guidance for preserving canonical homes, formats, stable
  IDs, lifecycle vocabulary, and historical evidence. Authoring, initialization,
  seeding, and maintenance route to it when existing artifacts are involved.
- The optional `scripts/vault/maintenance-audit.mjs` policy accepts additive
  `documentIdFields` for wikilink resolution through existing flat metadata such as
  `document_id`. Defaults and typed-vault validation are unchanged. Ambiguous names
  remain debt; Markdown links remain paths. Audits do not rewrite source documents.

## 0.2.0

The first harvest release: seventeen learnings captured in a deployed 152-node vault, folded back into the plugin. Two themes — the tooling can no longer report a pass it did not earn, and the shipped documents can no longer promise a check that does not exist.

### The gate can no longer pass vacuously

- `/vault-lint` hard-fails when the configured `vaultRoot` does not exist, and when markdown files are present under it but none parsed as a node. A run that measured nothing used to print `0 hard, 0 soft`.
- `/vault-lint` prints the denominator alongside the counts — `N nodes, M files` — so a clean headline can be checked against what it was computed over.

### New and repaired checks

- `code_refs` liveness now runs inside `/vault-lint --all`, not only in `/vault-status`. Both halves are soft in lint (a path deleted in the same commit as the doc must not turn the gate red on documentation debt); `/vault-status` keeps treating a missing path as hard, because it is a deliberate audit rather than a gate. Refs resolve against the project directory instead of the process working directory.
- The `code_refs` symbol probe resolves a dotted `Class.method` reference part-wise on its final segment. The old literal-substring test could only ever fail for the dotted form, which made every dotted ref a permanent false positive.
- `dangling-link` audits wikilinks resolving to no node, alias, or file, grouped by target with a near-miss suggestion. **The scan root and the resolution root are separate settings, with opposite defaults, and that is the whole design.** `linkRoots` (default: the vault root) decides which files get checked, so an existing install sees no new scanning until it opts in via `docs/vault/.vault.json`. `linkResolveRoots` (default: the whole project) decides what counts as resolving, because the two errors are not symmetric: under-resolving accuses a healthy link, over-resolving is merely silent, and on a soft advisory silence is the safe failure. Measured on the 152-node source vault, resolution bounded by the scan root reported 15 targets of which 14 were ADRs in `docs/ADR/` declaring their own `aliases:` — all of them correct links. Splitting the roots took that to 1 finding, and the survivor was a real broken alias.
- `prose-claim` probes prose against the filesystem: a sentence asserting that a named path does not exist, contradicted by the filesystem. It speaks only when the filesystem contradicts the claim — there is no code path from a true claim to a warning — and is soft and out of the hook path by construction.
- Both of the above are **wired into `/vault-lint --all`**, not merely shipped in the tree. A pass that is implemented, unit-tested and green while being reachable from nothing is the exact defect this release exists to close, so `test/e2e-scripts.test.mjs` asserts each one fires *through the CLI* rather than only through its own unit tests.
- The `learning` type is fully registered: it has a router role and points at `_meta/learnings/`, the folder its nodes actually live in. The generated router used to print `undefined` and the wrong folder.

### The shipped contract is now true

- `skeleton/Knowledge/_meta/schema-spec.md` — the file copied verbatim into every consuming project — no longer promises six soft-warning checks that no code implements. Enforcement is split into "Soft Warnings — Enforced Today" (an exhaustive list, held exhaustive by `test/doc-contract.test.mjs`) and "Not Yet Enforced (Roadmap)", which names each unimplemented rule and says what is missing. The `vault_lint_disable` per-file opt-out is marked for what it is: a key no script reads, so a node using it gets no opt-out and no error either.
- Corrected in the same file: the type and doc_class enums and the folder table now include `learning`; graph colors are described as `tag:#class/<doc_class>` queries, which is what `/vault-colorize` actually emits (property-based queries silently match nothing on many Obsidian builds); the hard-block list now includes the decision-only relation rule, the relation-value format rule, and the MADR heading rule; the whole-vault gates that only run under `--all` have their own section.
- Upgrade note: `/vault-init` copies `skeleton/` without overwriting, so an existing vault keeps the schema-spec it was installed with. To pick up the corrected contract, copy `skeleton/Knowledge/_meta/schema-spec.md` over the project's `_meta/schema-spec.md` by hand.
- `/vault-lint`'s own skill advertised orphan detection, provenance-mix and code_ref drift; three of those five were fiction. It now names exactly the rules that run, and says what a green lint is not evidence of.

### Authoring guidance

- `provenance: verified` means you opened the code path and saw the claimed behavior. A green test suite is not verification — a test can be self-authored against the author's own blind spot, can silently skip when a service is missing, and can sit in a file CI never invokes. All three read as green.
- A `decision` node is read as a description of the running system. An accepted-but-unbuilt decision must say so in the first line of Decision Outcome, or a planner scopes work on top of a lane that does not exist. And a node is a home for an idea, not a date: `decision_status: proposed` records an open question, it does not schedule one.
- New in `docs/seed-from-prd.md`: the parallel-seeding protocol — publish the node-ID registry before anyone writes, write only resolvable links and backfill one edit at a time, run one sweep, one `/vault-map` and one `/vault-lint` at the end.
- `tags` must be a single-line inline array; the class-tag backfill silently skips a block-style list, leaving the node grey in the graph.
- `docs/STANDARD.md` documents the cohort approach to staleness: why an absolute 120-day threshold is structurally aimed at the wrong stratum, and why the oldest decile belongs in `/vault-status` as a work queue rather than in lint as a permanent warning per node.
- `/vault-evolve` now records where a validation rule goes (per-file pass vs whole-vault gate) and the severity ladder that constrains it — including that a cross-node rule can never block a write, and that a rule which throws is a rule that silently does not exist.

### Tests

- `test/e2e-scripts.test.mjs` asserts reachability: each whole-vault rule must fire when driven through `validate.mjs --all`. Both new rules failed these on first run — fully implemented, 40+ unit tests green, imported by nothing.
- `test/doc-contract.test.mjs` keeps the shipped documents true against the code: enums and the folder table cannot drift from `schema.mjs`, every rule listed as enforced must fire when probed, every rule listed as roadmap must be absent from the code, and a whole-vault rule that lands must be promoted out of the roadmap section in the same change.

## 0.1.0

Initial release: the frontmatter contract, the three validator passes, the Pre/Post/SessionStart/SessionEnd hooks, the three-tier generated index, the `vault-*` skills, and the capture-and-harvest learning loop.
