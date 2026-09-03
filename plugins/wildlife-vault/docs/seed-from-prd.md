# Seeding the Vault from a PRD

How to bootstrap an empty vault into a useful knowledge graph from a single PRD (product requirements doc) or design brief. This is the fastest way to get value: turn a document you already have into a navigable, typed graph the agent reads before every task.

## The idea

A PRD is dense with exactly the things the vault wants: concepts, modules, flows, data shapes, decisions, invariants. Seeding extracts them into typed nodes so future sessions navigate the knowledge instead of re-reading the PRD.

For an existing artifact set, first read [legacy document guidance](../references/legacy-documents.md).
Keep the PRD, ADRs, specifications, and registers in their canonical homes with their
original IDs and lifecycle states. Seed only the durable knowledge needed, cite its
sources, and preserve source authority; a distilled node is not a replacement PRD.

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
- Capture PRD open questions as `decision` nodes with `decision_status: proposed` — and in each one, name who closes it and where it is tracked. A `proposed` node preserves the question; it does not schedule it.
- After a substantial seed, if you noticed a reusable seeding technique or a node shape the built-in types didn't fit, capture it with `/vault-learn` so it can improve the plugin.

## Seeding in parallel

Several authors can seed at once, but the validator hard-blocks any `rel_*` whose target does not yet exist on disk — and at seed time almost nothing exists. The pattern that works:

1. **Publish the registry before anyone writes.** Design the complete node set first and hand every author the full ID registry: `id`, `type`, and a one-line scope for every planned node. Authors then link only to planned ids, and nobody invents a target.
2. **Write only resolvable links; backfill the rest.** Each author writes their nodes with the subset of `rel_*` edges whose targets already exist, keeps a list of the edges they had to drop, and adds them back by edit as peer nodes land. Backfill **one edit at a time**: PreToolUse only sees the content of a full-file Write, so an Edit is validated by PostToolUse — after it has applied — and a rejected batch edit has to be reverted by hand.
3. **One sweep, one map, one lint.** Authors report their dropped links; the orchestrator adds the remaining edges once every node exists, then runs `/vault-map` and `/vault-lint` once, at the end. Do not have five authors each run `/vault-map` — it regenerates the index regions wholesale from live frontmatter, so concurrent runs race and a mid-seed run is stale the moment the next node lands.
4. **Give parallel authors the contract inline.** Do not assume an author can load a skill: paste the frontmatter contract and their type's target folder into their instructions.
5. **Authors trust the source over the brief.** Tell them to re-read the source document whenever it disagrees with their assignment summary. The brief is a summary, and summaries carry errors.

Write `tags` as a single-line inline array. The class-tag backfill only rewrites inline arrays (see the authoring contract), so a block-style `tags:` list seeded at scale leaves a batch of nodes grey in the graph and needs hand-fixing.
