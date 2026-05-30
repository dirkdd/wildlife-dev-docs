# Seeding the Vault from a PRD

How to bootstrap an empty vault into a useful knowledge graph from a single PRD (product requirements doc) or design brief. This is the fastest way to get value: turn a document you already have into a navigable, typed graph the agent reads before every task.

## The idea

A PRD is dense with exactly the things the vault wants: concepts, modules, flows, data shapes, decisions, invariants. Seeding extracts them into typed nodes so future sessions navigate the knowledge instead of re-reading the PRD.

## Steps

1. **Point the agent at the PRD.** `seed the vault from <path-to-prd>` (or paste it).
2. **The agent reads the schema** (`_meta/schema-spec.md`) and the templates first.
3. **Register the domains** you'll use in `docs/vault/.vault.json` (`domains: [...]`) before authoring, so the domain sub-indexes materialize and `domain/*` tags are recognized.
4. **Extract entities into nodes**, one per concept/module/flow/data/decision/invariant, using the `vault-author` skill. Author in dependency order so relation targets exist.
5. **Set provenance** to `extracted` (from the PRD) or `inferred`; never `verified` until checked against code.
6. **Run `/vault-map`** to generate indexes.
7. **Run `/vault-lint`** to confirm a clean vault.

## Tips

- One node per real thing; don't over-split.
- Author foundational nodes first (invariants, concepts) so later nodes can link to them.
- **Relation targets must already exist** when you write a node — a `rel_*` pointing at a not-yet-created node is a hard block. Either author strictly in dependency order, or write the target node first as a stub (valid frontmatter + a one-line summary) and flesh it out later. This avoids the write-blocked-then-reorder churn that bites large seeds.
- Keep summaries tight — they're what the next session reads.
- Capture PRD open questions as `decision` nodes with `decision_status: proposed`.
- After a substantial seed, if you noticed a reusable seeding technique or a node shape the built-in types didn't fit, capture it with `/vault-learn` so it can improve the plugin.
