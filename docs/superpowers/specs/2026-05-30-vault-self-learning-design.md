# Vault Self-Learning Loop (`wildlife-vault`)

**Date:** 2026-05-30
**Status:** Approved design, pending Phase 1 implementation plan
**Author:** dirk@wildlifeai.co
**Builds on:** `2026-05-29-vault-plugin-conversion-design.md` (the plugin this extends)

## Summary

Give the `wildlife-vault` plugin a feedback loop: each deployed vault captures
**generalizable learnings** discovered during real work — new node/doc types,
authoring strategies, taxonomy/vocabulary gaps, validation rules, and creative
techniques (workflow or graph-traversal innovations). Those learnings are stored
as quarantined `type: learning` nodes, exported as a **sanitized digest**, and
fed (by the user) into the plugin repo where a `/vault-evolve` skill proposes
concrete, human-approved upgrades to the plugin. Adopted upgrades flow forward to
every future `/vault-init`. The loop is one-way and human-gated so no proprietary
project content can leak into the shared plugin.

## Decisions (locked)

1. **Learning scope:** structural (new types, taxonomy, validation rules) *and*
   generative (authoring strategies, breakthrough techniques in workflows /
   graph-edge traversal).
2. **Capture is hybrid:** in-the-moment (autonomous protocol + `/vault-learn`
   skill) PLUS a once-per-session sweep (`SessionEnd` hook) that nudges reflection.
3. **Storage:** quarantined `type: learning` nodes under
   `docs/vault/<name>/_meta/learnings/`, graph-visible and linkable to the source
   node, but walled off from project domain knowledge.
4. **Feedback:** `/vault-learnings` exports a sanitized digest; `/vault-evolve`
   (run in the plugin repo) reviews it and *proposes* plugin changes for approval
   — never auto-applies.
5. **Phasing:** two shippable phases. Phase 1 = capture & storage. Phase 2 =
   harvest & evolve. **This plan implements Phase 1 first.**

## The learning node

New `type: learning`, folder `_meta/learnings/` (sits with `moc`/`reference`, so
it is excluded from domain coverage and needs no `domain/*` tag).

```
---
id: learning-<slug>
title: "<short imperative insight>"
type: learning
doc_class: learning                 # new doc_class (forced via TYPE_DOC_CLASS) -> graph color + class/learning tag
learning_kind: type | strategy | taxonomy | validation | technique
summary: "<the generalized, project-agnostic claim — harvested>"
status: draft                       # standard node status (draft|canonical|stale|deprecated)
learning_status: proposed           # harvest lifecycle: proposed -> harvested -> adopted | rejected
adopted_in: ""                      # e.g. "wildlife-vault@0.3.0" once it lands in the plugin
provenance: inferred
tags: ["area/meta", "class/learning"]
updated: <date>
rel_related: ["[[source-node-that-sparked-it]]"]
---
## Generalized insight        ← harvestable. No client names, no proprietary specifics.
## In-project evidence        ← stays local. The concrete case that sparked it; NEVER exported.
## Proposed plugin change     ← optional: what in the plugin this implies (new template, enum, rule…).
```

**The boundary:** the harvestable payload is `summary` + the *Generalized insight*
and *Proposed plugin change* sections. *In-project evidence* is quarantined and
the export digest strips it. The harvest lifecycle lives on a dedicated
**`learning_status`** field (NOT `status`, whose enum is fixed at
`draft|canonical|stale|deprecated` and is enforced by the validator); `adopted_in`
records the plugin version that absorbed the learning so it is not re-fed.

## Schema / validator wiring (plugin `schema.mjs` + passes)

- `TYPES` += `learning`.
- `CATEGORY_DIRS.learning = "_meta"` (lives in `_meta`, like `reference`/`moc`;
  excluded from domain coverage, no `domain/*` tag required).
- `CATEGORY_ORDER` += `learning` (so learning nodes render in `index-by-type`,
  satisfying the index-drift coverage gate).
- `DOC_CLASSES` += `learning`; colorize `COLORS.learning = "#E91E63"` (magenta,
  decimal `15277667`); `TYPE_DOC_CLASS.learning = "learning"` so the doc_class is
  forced and the `class/learning` mirror tag is auto-correct.
- `learning_status` and `adopted_in` are optional extra frontmatter keys; the
  validator checks *required* fields and enum-controlled fields, so extra keys are
  allowed. No new hard rule is required for Phase 1. (`learning_status` value
  validation is a candidate Phase 2 soft-check, not required now.)

## Phase 1 — Capture & storage (this implementation)

1. **Schema wiring** (above) + a new `learning.md` template under
   `skills/vault-author/templates/`.
2. **`/vault-learn` skill** — `vault-learn <insight>`: choose `learning_kind`,
   draft the generalized claim into `summary` + *Generalized insight*, fill
   *In-project evidence* from current context, link `rel_related` to the sparking
   node(s), write the node to `_meta/learnings/`. The PreToolUse validator gates
   it like any node; run `/vault-map` after so it indexes.
3. **Autonomous protocol** — `/vault-init` appends a short clause to the
   consuming repo's Vault Protocol (CLAUDE.md), and the plugin's `vault-author`
   skill carries the matching guidance: *"When you discover something
   generalizable about how to build or document — a recurring shape the built-in
   types don't fit, a technique that worked, a taxonomy gap — record it
   immediately with `/vault-learn` before moving on. A generalizable insight left
   uncaptured is lost."*
4. **`SessionEnd` sweep hook** — `scripts/vault/learn-sweep.mjs`, wired in
   `hooks/hooks.json` under `SessionEnd`. Lazy and **non-blocking**: resolves the
   vault (fail-safe no-op when none); if the session touched vault nodes (git /
   mtime heuristic), emits a one-line `additionalContext` nudge — *"Session
   touched N vault nodes; consider a `/vault-learn` for any durable technique or
   pattern before you go."* It authors nothing and never blocks exit.

### Phase 1 testing
- Unit: `learning.md` template lints clean; adding the `learning` type/doc_class
  does not break existing lint; colorize emits a `tag:#class/learning` group with
  rgb `15277667`.
- e2e: `init` → write a `learning` node → single-pass `vault-map` + lint clean →
  `learn-sweep.mjs` no-ops (exit 0, no output) on a project with no vault, and
  emits a nudge when the vault has recent changes.

## Phase 2 — Harvest & evolve (designed, deferred to its own plan)

- **`/vault-learnings` + `learnings-export.mjs`** (runs in the deployed project):
  collect `type: learning` nodes with `learning_status: proposed`; emit a
  portable Markdown digest of `learning_kind` + `summary` + *Generalized insight*
  + *Proposed plugin change*, **stripping *In-project evidence***; optionally
  stamp exported nodes `learning_status: harvested`. Fail-safe no-op when no vault.
- **`/vault-evolve` skill** (runs in the `wildlife-dev-docs` plugin repo): ingest
  a pasted digest and, per learning, propose a concrete reviewable plugin change
  mapped to `learning_kind` — `type` → new template + `TYPES`/`CATEGORY_DIRS`
  entry; `taxonomy` → `DOC_CLASSES`/`TAG_NAMESPACES`/palette addition;
  `validation` → a new pass rule + test; `strategy`/`technique` → edits to
  `vault-author`/`vault-new` guidance or a new skill. Proposes only; the human
  approves and sets `adopted_in` back in the source project.

### The full loop
work in a project → `/vault-learn` (in-moment) + `SessionEnd` nudge capture
insights → `/vault-learnings` exports a sanitized digest → paste into the plugin
repo → `/vault-evolve` proposes plugin upgrades → human approves → plugin
improves → every future `/vault-init` carries the improvement forward.

## Out of scope (YAGNI)

- Cross-project / fleet-wide learning aggregation (a registry over many vaults).
- Auto-PRs to the plugin repo (no human gate → leak/quality risk).
- Automatic application of plugin changes by `/vault-evolve` (proposes only).
- `learning_status` enum hard-validation (Phase 2 soft-check at most).
