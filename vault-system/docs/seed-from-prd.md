# Seeding the vault from a PRD

The vault installs empty. On a greenfield project your only source of truth is the PRD, so the first pass extracts structure from it rather than from code. This is the day-one bootstrap. Hand it to Claude (`seed the vault from <path-to-PRD>`) or follow it yourself.

The governing rule: a node's `provenance` records where its claim came from. Straight from the PRD is `extracted`. Your synthesis across sections is `inferred`. Nothing is `verified` yet, because there is no code to check against. Nodes graduate to `verified` later, as the code lands and you confirm them.

## Step 1: read the PRD and name the domains

Skim the whole PRD first. Identify the **feature domains**: the top-level areas the product is organized around (for example `billing`, `onboarding`, `search`, `notifications`). These become your `domain/*` tags.

Add them to `DOMAIN_WHITELIST` in `scripts/vault/schema.mjs`:

```js
export const DOMAIN_WHITELIST = ["billing", "onboarding", "search", "notifications"];
```

Mirror the same list in `docs/vault/Knowledge/_meta/taxonomy.md` under `domain/*`. Keep the count small (the sweet spot is roughly five to ten); you can register more later.

## Step 2: capture the durable structure as nodes

Go domain by domain. For each, create nodes only for things that are **durable and load-bearing**, not a restatement of the whole PRD. Use `/vault-new <type> "<title>"` or the `vault-author` skill. The types, and what each is for:

| Create a... | When the PRD describes... | Typical `provenance` |
|---|---|---|
| `concept` | a domain term or idea the team must share a definition of | extracted |
| `module` | a system surface or feature area that will become code | inferred |
| `flow` | an end-to-end process that crosses surfaces (the happy path) | inferred |
| `data` | a data shape or contract the PRD pins down | extracted |
| `invariant` | a rule that must always hold, and what breaks if it does not | extracted |
| `decision` | a choice the PRD makes and the alternatives it rejected (an ADR) | extracted |

Authoring discipline (the full version is in `STANDARD.md`):

- The `summary` is the most important field. One or two sentences. It is what shows in the index and what the next session reads before deciding whether to open the body. Write it for a reader who has not seen the PRD.
- Cite the PRD in `sources` (its repo path). Do not paste PRD prose into the body; distill it.
- Wire relations with the flat `rel_*` lists of quoted wikilinks: a flow `rel_depends_on` its data shapes, `rel_governed_by` its invariants, `rel_decided_in` the ADRs that shaped it. These render as graph edges and are how the next session walks from one node to its neighbors.
- Leave `code_refs` empty for now. You fill them in once the code exists, which is also when the node earns `provenance: verified`.

## Step 3: index, lint, and review

After each node, the `vault-author` skill runs `/vault-map`. When the domain is done:

```
npm run vault:map     # router + per-domain sub-index now list the new nodes
npm run vault:lint     # expect 0 hard; address soft warnings
```

A new whitelisted domain materializes its own `index-domain-<slug>.md` on the next map. Open `docs/vault/Knowledge/_meta/index.md` and confirm the catalog and sub-index list look right.

## Step 4: keep it alive as the project moves

The vault is only useful if it stays current. Two habits do that:

- **Every task produces two outputs:** the work, and the vault update. When you implement a flow, return to its node, set the real `code_refs`, and promote `provenance` from `inferred`/`extracted` to `verified`.
- **When the PRD changes,** re-run `npm run vault:status`. It diffs sources against the manifest and flags the nodes a changed PRD may have made stale.

## A good first pass looks like

For a typical PRD: each domain has one or two `module` nodes, the one or two `flow` nodes that matter most, the `data` shapes those flows touch, the handful of `invariant` nodes that capture the must-hold rules, and an ADR for each real decision the PRD already made. That is usually ten to thirty nodes, not hundreds. Breadth over depth on the first pass; depth follows the code.
