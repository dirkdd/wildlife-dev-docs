---
name: vault-author
description: "Author or update vault nodes (concept, module, flow, data, invariant, decision, runbook, guide) with the full frontmatter contract, typed rel_* relations, and controlled enums. Use when documenting domain knowledge, decisions, flows, data shapes, or runbooks under docs/vault/Knowledge/."
paths: docs/vault/Knowledge/**/*.md
allowed-tools: Read, Write, Edit, Grep, Bash
arguments: [type, title]
---
Read [shared runtime and scope](../../references/runtime.md) before acting.

For an existing document, first use [legacy document guidance](../../references/legacy-documents.md)
to decide whether to edit its canonical source, link it, or distill a node. Preserve
external ADRs and artifact IDs; `rel_*` targets must still be vault node IDs.

Author one node at a time. Steps:

1. Pick the `type` (drives the folder via CATEGORY_DIRS and the template). Read `${VAULT_PLUGIN_ROOT}/skills/vault-author/templates/<type>.md`.
2. Write frontmatter to the contract (see [[schema-spec]] / the plugin's `scripts/vault/schema.mjs`): required `id` (kebab == filename), `title`, `type`, `doc_class`, `summary` (one or two sentences; this is what the index shows and what other sessions read before opening the body), `status`, `provenance`, `tags` (domain/*, audience/*, area/*, and the mirror tag `class/<doc_class>` so the Obsidian graph colors the node) — write `tags` as a single-line inline array, `tags: ["domain/x", "audience/y", "class/knowledge"]`. The class-tag backfill (`scripts/vault/add-class-tags.mjs`) only rewrites an inline `tags: [ ... ]`; it silently skips a block-style list, so a node whose tags run over multiple lines never gets its mirror tag and stays grey in the graph, `updated`. Optional `diataxis`, `sources`, `code_refs` (point at the real code: `path` or `path#symbol`), `aliases`.
3. Relations are FLAT top-level `rel_*` lists of QUOTED wikilinks (`- "[[id]]"`): rel_documents, rel_depends_on, rel_governed_by, rel_decided_in, rel_part_of, rel_related (rel_supersedes/superseded_by on decision nodes only). They render as native Obsidian graph edges. Never use a nested `relations:` map.
4. Provenance discipline: mark `verified` only when you opened the code yourself and saw the behavior the node claims; otherwise `extracted` (from a doc) or `inferred`. A green test suite is not verification. A test can be self-authored against the author's own blind spot (it asserts the denials the author thought of, and the surface nobody considered stays open), it can silently SKIP when a tool or service is missing, and it can sit in a file CI never invokes — all three read as green. So for any node claiming something is ENFORCED, check three things before writing `verified`: is the check reached on the live path, what does it do when left unconfigured, and did its test actually execute rather than skip or sit outside CI. Then cite the file in `code_refs`. If you cannot answer all three, the node is `inferred` and its body should say what would settle it. Cite `sources`; never duplicate a source doc into the body.
5. Prefer minimal edits over rewrites; never wholesale-rewrite a `canonical`/`verified` node for a small change.
6. After writing, run `/vault-map` so the indexes pick up the node. Run the validator explicitly in Codex; Claude hook limits are described in the shared runtime.

For `type: decision`, use the MADR body (Context and Problem Statement, Considered Options, Decision Outcome are required) and set `decision_status` + `deciders`.

`decision_status` is read as a claim about the running system. `accepted` reads as "this works" and gets built on top of; `draft` reads as "not started yet." So if the decision is accepted but the mechanism it describes does not exist, say so in the FIRST line of Decision Outcome — "Accepted <date>; NOT BUILT — nothing calls this today" — and leave `provenance: inferred`. And know what the node cannot do: it is a home for the idea, not a date. `decision_status: proposed` records an open question; it does not schedule one, and an open question nothing forces closed is indistinguishable from one that was never raised. If the decision implies work, put a dated row on whatever artifact the team plans against in the same sitting and name that artifact under `## More Information`. A third home for the same undated item is not diligence — homes preserve the idea, only a row carries the date.

Capture durable findings and reusable learnings when they are relevant to the authorized
writing task. Read-only audits produce findings, not automatic node or index writes.
