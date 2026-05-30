---
name: vault-author
description: Author or update vault nodes (concept, module, flow, data, invariant, decision, runbook, guide) with the full frontmatter contract, typed rel_* relations, and controlled enums. Use when documenting domain knowledge, decisions, flows, data shapes, or runbooks under docs/vault/Knowledge/.
paths: docs/vault/Knowledge/**/*.md
allowed-tools: Read, Write, Edit, Grep, Bash
arguments: [type, title]
---
Author one node at a time. Steps:

1. Pick the `type` (drives the folder via CATEGORY_DIRS and the template). Read `${CLAUDE_PLUGIN_ROOT}/skills/vault-author/templates/<type>.md`.
2. Write frontmatter to the contract (see [[schema-spec]] / the plugin's `scripts/vault/schema.mjs`): required `id` (kebab == filename), `title`, `type`, `doc_class`, `summary` (one or two sentences; this is what the index shows and what other sessions read before opening the body), `status`, `provenance`, `tags` (domain/*, audience/*, area/*, and the mirror tag `class/<doc_class>` so the Obsidian graph colors the node), `updated`. Optional `diataxis`, `sources`, `code_refs` (point at the real code: `path` or `path#symbol`), `aliases`.
3. Relations are FLAT top-level `rel_*` lists of QUOTED wikilinks (`- "[[id]]"`): rel_documents, rel_depends_on, rel_governed_by, rel_decided_in, rel_part_of, rel_related (rel_supersedes/superseded_by on decision nodes only). They render as native Obsidian graph edges. Never use a nested `relations:` map.
4. Provenance discipline: mark `verified` only when checked against code; otherwise `extracted` (from a doc) or `inferred`. Cite `sources`; never duplicate a source doc into the body.
5. Prefer minimal edits over rewrites; never wholesale-rewrite a `canonical`/`verified` node for a small change.
6. After writing, run `/vault-map` so the indexes pick up the node. The PreToolUse hook will block a malformed write; fix and retry.

For `type: decision`, use the MADR body (Context and Problem Statement, Considered Options, Decision Outcome are required) and set `decision_status` + `deciders`.

Compounding rule (invariant): every task produces two outputs: the work itself, and the vault update. When you learn something durable while working, capture it as a node (or update an existing one) before you finish. An unindexed fact is invisible to the next session.
