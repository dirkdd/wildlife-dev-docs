# Documentation maintenance

## Choose the requested mode

- **Write:** follow project conventions, update the intended canonical page, verify
  changed links. No full lifecycle audit or new schema is required.
- **Audit:** inspect and report; do not change policy, baselines, frontmatter,
  indexes, statuses, or learning nodes. Missing policy is an evidence gap.
- **Repair/cleanup:** implement the authorized slice, preserve evidence, record
  dispositions, and check the result. Deletion or source/history changes need
  authorization covering those artifacts; an old timestamp is not authorization.

Prefer the consumer's existing checker and policy when they express its decisions.
The optional `maintenance-audit.mjs` does not replace typed-vault lint, project
checks, or a human assessment. Its policy is not required for ordinary writing.

## Establish authority and lifecycle

Find the maintained hub, current planning artifact, applicable instructions, and
source ownership. Distinguish active canonical docs, superseded decisions and
historical plans, generated evidence, and agent execution/kickoff records. A link
that resolves to history does not make that history current policy. Trace the
superseding target and relevant PR/commit evidence before changing a claim.

Use the project's taxonomy. The helper assigns roles by explicitly configured
path scopes (longest boundary match), including exact file paths. It does **not**
infer authority from dates, filenames, frontmatter, or link counts. Configure exact
file scopes for mixed directories, or use the project's more capable checker.
Generated and historical warnings are separate from active-document debt.

The `kickoff` role treats execution records as historical warnings; it is not an
authority inference. Classify a maintained, authoritative session briefing as
`active`, even if its name contains "kickoff". For legacy artifact ownership,
registers, and traceability, see [legacy document guidance](legacy-documents.md).

When cleanup is authorized, each item needs a disposition: retain active,
retain historical, superseded with target, consolidate into a named canonical
page, or remove with authorization and rationale. Preserve raw captures and
restricted source files byte-for-byte. Correct narrative history with an explicit
addendum when appropriate; do not silently rewrite the investigative record.
A missing historical artifact is a finding, never a request to reconstruct it.

Maintain one useful current-state hub/backlog. Update its existing row or section
with current claim, owner, next action, evidence, and review date. Link historical
records and evidence collections. Do not create a new status page for every audit
or force one manually maintained index row for every generated capture.

## Assess staleness with evidence

Age, changed hashes, and old cohorts are review signals only. A new file can be
wrong; an old decision can remain valid. Compare the specific claim to source
content, source revision/hash, implementing PR or commit, and evidence that the
relevant check actually executed. Record what was verified, by whom/what, when,
and against which revision. Distinguish proposed, accepted, implemented, and
verified states. Preserve an unknown state when the source is unavailable.

Useful checks include a scoped `git log -- <path>`, `git show <commit>:<path>`, and
an authorized read of the linked PR. Do not infer deployment from a merged PR or
correctness from a green test alone. Existing `status.mjs` compares source hashes
and probes code references; it cannot prove prose correct or remote artifacts
available. `code_refs` symbols are substring heuristics, not language analysis.

## Optional helper policy (version 1)

Create a policy only when requested or needed for authorized setup. The JSON file
may live anywhere under the project; pass its relative path explicitly. No default
file is created. Paths use `/`, remain inside the project, and cannot traverse
symlinks. Scan roots must exist. Metadata keys are checked; misspellings fail.

```json
{
  "version": 1,
  "scopes": [
    {"path": "docs", "role": "active"},
    {"path": "docs/history", "role": "historical"},
    {"path": "docs/evidence", "role": "generated"},
    {"path": "agent-notes", "role": "kickoff"}
  ],
  "resolveRoots": ["docs", "agent-notes"],
  "documentIdFields": ["document_id"],
  "exclude": ["docs/restricted"],
  "externalAssets": [
    {"id": "source-export", "path": "local-input", "owner": "data-owner",
     "reason": "Restricted upstream evidence", "sensitivity": "restricted",
     "commitPolicy": "never"}
  ],
  "exceptions": [
    {"source": "docs/index.md", "kind": "wiki", "target": "planned-guide",
     "verdict": "FORWARD", "owner": "docs-owner", "expires": "2030-01-01",
     "reason": "Tracked follow-up; replace with the owning issue or PR"},
    {"source": "docs/syntax.md", "kind": "wiki", "target": "tool:slot",
     "verdict": "LITERAL", "reason": "Literal syntax described by this page"}
  ],
  "baseline": "docs/link-debt.json"
}
```

Only include scopes that exist and exceptions actually needed. `resolveRoots`
defaults to the scopes; resolution may be wider than scanning. The helper excludes
`.git`, `node_modules`, `.obsidian`, `_raw`, `.cache`, `dist`, `build`, explicit
exclusions, and external asset paths. It reports omitted paths and denominators.
It does not open external content. Every declared external root must be ignored
by Git and contain no tracked files, even when the asset is absent. Ignored paths
without a declaration are **not** automatically accepted. Metadata is not a place
for secrets, raw source rows, credentials, or operational captures.

Exceptions match **exact source, link kind, and target**. No wildcard waivers.
A forward reference requires an owner, reason, and ISO expiry; it becomes broken
after that date. An actually resolved target wins over a forward exception.
A forward waiver cannot hide ambiguity. Literal exceptions are for real syntax,
not ordinary missing docs. Review exceptions and exclusions as policy changes.

## Link verdicts and limits

| Verdict | Meaning / gate |
|---|---|
| RESOLVED | A unique document/file target exists; fragments remain unchecked |
| BROKEN | Active target missing; gated against the baseline |
| AMBIGUOUS | Multiple wiki targets or duplicate reference definitions; gated |
| EXTERNAL_LOCAL | Explicit, gitignored asset, accepted while absent |
| FORWARD | Exact owner/expiry-bound reference, accepted until expiry |
| LITERAL | Exact documented syntax exception |
| HISTORICAL_WARNING | Broken/ambiguous reference in historical/kickoff scope |
| GENERATED_WARNING | Broken/ambiguous reference in generated scope |
| REMOTE_UNCHECKED | URL syntax recognized; reachability/content not checked |
| BLOCKED_PATH | Undeclared traversal/symlink; audit fails without reading it |

The helper supports common inline Markdown links/images, angle destinations,
percent-encoded paths, one balanced parenthesis level, reference definitions,
full/collapsed/defined-shortcut references, and wikilinks with display labels.
Markdown paths resolve relative to the source document; labels are not aliases.
Wikilinks resolve through relative/root paths, basenames, IDs, and inline/block
**flat** frontmatter aliases. Matching is case-folded for wiki names; collisions
are ambiguous. Arbitrary YAML, heading titles as implicit aliases, HTML/MDX links,
escaped/nested Markdown grammar, and undefined shortcut references need a
renderer-specific checker/manual review. The helper is not a full Markdown parser.

Optional `documentIdFields` adds existing flat frontmatter fields to wiki name
resolution, for example `["document_id", "artifact_id"]`. Omission or an empty
array preserves the default behavior; `id`, `aliases`, paths, and basenames remain
available. Field names are case-sensitive, unique, and contain only letters,
digits, underscores, or hyphens. Nonempty scalar strings are names; arrays and
nested metadata are not. Matching values uses the same Unicode normalization and
case folding as other wiki names, with collisions reported as `AMBIGUOUS` when
referenced. This does not check unreferenced IDs for uniqueness. It does not alter
Markdown path resolution, renderers, typed-node schemas, `rel_*`, `/vault-map`,
or `/vault-link`. No frontmatter is added or rewritten.

The flat parser treats plain values literally (`42` and `null` are strings),
retains inline comments, and does not decode quoted YAML escapes. Use simple
literal IDs without inline comments. Block scalars, anchors, aliases, and tags
are unsupported for custom ID fields. For richer existing YAML, prefer project
tooling or path links; this option is not a YAML schema adapter.

Fenced/indented code, inline code, comments, and frontmatter are masked. Relations
in frontmatter remain the typed-vault validator's responsibility. Indented list
content may need manual review because indentation is conservatively treated as
code. **Heading and block fragments are not validated**, including same-document
fragments: a file-level pass never proves `#heading` or `#^block` exists. Each
fragment finding carries `fragmentStatus: NOT_VALIDATED`; reports state the limit.

## Debt ratchet and explicit retirement

No baseline means zero accepted active debt. Existing debt may be recorded only
with explicit owner review; use exact source/kind/target/verdict plus count,
`disposition: accepted-debt`, owner, and reason. Moving prose within one file does
not create debt; adding another occurrence does. Do not regenerate a baseline
from today's findings simply to green a change.

```json
{
  "version": 1,
  "entries": [
    {"source": "docs/guide.md", "kind": "wiki", "target": "missing-guide",
     "verdict": "BROKEN", "count": 1, "disposition": "accepted-debt",
     "owner": "docs-owner", "reason": "Existing debt assigned for repair"}
  ],
  "retirements": []
}
```

The report's `retire` list identifies baseline counts no longer observed. Reduce
those counts/remove entries and add a retirement record with the original `key`
from the report, retired `count`, `disposition` (`resolved`, `reclassified`,
`consolidated`, `superseded`, `authorized-removal`), `reason`, and `evidence`
(e.g. PR/commit/document pointer). Keep the record with the cleanup diff.

In CI, compare against the base revision's policy and baseline review. Supply an
already prepared, project-local baseline snapshot using
`--baseline-before=<relative.json>` to reject baseline growth and require new
retirement dispositions for reduced counts. Prepare that snapshot outside a
read-only audit invocation; the checker never runs `git show` into a file itself.
Without `--baseline-before`, it validates the current baseline but cannot prove
that entries were not erased in Git history. Exclusion/role/exception changes also
need diff review; no static baseline comparison can authorize policy changes.

Exit codes: **0** = no active regression or pending baseline retirement;
**1** = regression, unused accepted count, missing retirement disposition,
blocked path, or any active debt under `--strict`; **2** = invalid input/config,
missing scan root, zero measured Markdown, or runtime failure. Non-active warnings
remain visible even in strict mode. Nothing is written in any mode.
