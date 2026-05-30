# Vault Self-Learning — Phase 2 (Harvest & Evolve) Design

**Date:** 2026-05-30
**Status:** Approved design, pending implementation plan
**Author:** dirk@wildlifeai.co
**Builds on:** `2026-05-30-vault-self-learning-design.md` (the loop) and the shipped Phase 1 (capture & storage).

## Summary

The second half of the self-learning loop: harvest the `type: learning` nodes a
deployed project captured (Phase 1) into a **sanitized, copy-paste digest**, and
feed that digest (manually) into the `wildlife-vault` plugin repo where a
`/vault-evolve` skill reviews it and **proposes concrete, human-approved** plugin
upgrades. One-way and human-gated, so no proprietary project content reaches the
shared plugin.

## Locked mechanics (this phase)

1. **Transport: copy-paste Markdown block.** `/vault-learnings` prints a digest to
   the terminal. The user copies it into a `/vault-evolve` session in the plugin
   repo. No file is written; no cross-repo filesystem coupling.
2. **Lifecycle: auto-stamp `proposed → harvested`.** Exporting a learning flips its
   `learning_status` so the next export does not repeat it. `adopted`/`rejected`
   + `adopted_in` are set later by the user after `/vault-evolve` decides.
3. **Evolve scope: propose concrete edits per learning.** `/vault-evolve` maps each
   learning's `learning_kind` to a specific plugin change and presents each as a
   reviewable proposal the user approves *before anything is written*. Never
   auto-applies.
4. **Sanitization: structural strip + heuristic warning.** Export ALWAYS strips the
   *In-project evidence* section; additionally it scans the harvestable text for
   likely-proprietary signals and flags them in the output for the user to review
   before pasting. Flags are warnings, not blocks.

## Component A — `/vault-learnings` + `learnings-export.mjs` (runs in the project)

`scripts/vault/learnings-export.mjs`, surfaced by the `/vault-learnings` skill.

**Selection:** all `type: learning` nodes with `learning_status: proposed`.
(Resolve the vault via `resolveVault`; fail-safe no-op printing nothing when no
vault is configured.)

**Harvestable payload per learning** (everything EXCEPT *In-project evidence*):
- `id`, `title`, `learning_kind`, `summary`
- the *Generalized insight* body section
- the *Proposed plugin change* body section (if present)

**Sanitization (pure, unit-testable):**
- `stripEvidence(body)` removes the `## In-project evidence` section (from that
  heading up to the next `## ` or EOF). Structural guarantee.
- `proprietarySignals(text)` returns an array of flagged snippets matching
  heuristics: email addresses, URLs, filesystem-ish paths
  (`/[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+/`), and runs of 2+ Capitalized Words
  (candidate proper nouns / client names). Used to annotate, never to block.

**Output (printed to stdout):** a single Markdown block:
```
# Vault learnings digest (N)

## learning-<id> — <title>
- kind: <learning_kind>
- summary: <summary>

### Generalized insight
<text>

### Proposed plugin change
<text or "(none)">

> ⚠ Possible proprietary signals to review before sharing: <comma-list>   ← only if any
---
(repeat per learning)
```
If signals were found anywhere, a top banner notes the count so the user reviews
before pasting.

**Lifecycle stamping:** after composing the digest, rewrite each exported node's
frontmatter `learning_status: proposed → harvested` (idempotent inline-field
replace, same discipline as `add-class-tags.mjs`). A `--dry-run` flag prints the
digest WITHOUT stamping, for previewing.

## Component B — `/vault-evolve` skill (runs in the plugin repo)

A skill (no script; it is an authored reasoning procedure). Input: the pasted
digest. For each learning, by `learning_kind`:

- **type** → propose a new template under `skills/vault-author/templates/` + the
  `TYPES`/`CATEGORY_DIRS`/`CATEGORY_ORDER`/(optionally `TYPE_DOC_CLASS`) entries,
  mirroring how `learning` itself was added.
- **taxonomy** → propose a `DOC_CLASSES` / `TAG_NAMESPACES` / `COLORS` palette
  addition (+ decimal rgb).
- **validation** → propose a new pass rule in `passes.mjs` *with a test*.
- **strategy / technique** → propose an edit to `vault-author` / `vault-new`
  guidance, or a new skill.

For each, `/vault-evolve` presents: the source learning, the proposed concrete
change (files + diffs/sketch), and a recommended `adopted_in` version. It writes
NOTHING until the user approves; on approval it may hand off to the normal
TDD/implementation flow. It also reminds the user to set `adopted`/`adopted_in`
(or `rejected`) on the source nodes back in the project.

## Testing

- Unit (`learnings-export.test.mjs`): `stripEvidence` removes exactly the evidence
  section and nothing else (incl. when it's the last section / mid-document);
  `proprietarySignals` flags an email/URL/path/proper-noun and ignores clean text;
  the digest composer includes the generalized payload and EXCLUDES evidence text;
  `--dry-run` does not stamp; a normal run flips `proposed → harvested` and is
  idempotent (a second run exports nothing).
- e2e (`e2e-scripts.test.mjs`): in a temp project, write two learning nodes (one
  `proposed`, one already `harvested`); `learnings-export` prints only the
  proposed one, strips its evidence, and after the run the node is `harvested`;
  no-op (prints nothing, exit 0) when no vault.

## Out of scope (unchanged from the loop spec)

- Cross-project / fleet aggregation; auto-PRs; `/vault-evolve` auto-applying;
  hard-blocking exports on proprietary-signal hits (warning only).
