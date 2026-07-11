# PRD — Documentation Lifecycle + Architecture Atlas

**Product:** `wildlife-vault` plugin · **Target release:** v0.2.0 · **Status:** DRAFT (for review) · **Date:** 2026-07-10 · **Author:** Wildlife AI

> Scopes three capabilities that formalize a repeatable documentation practice across every project the plugin is installed in. Written after a live proof-of-concept on `intelligence-harness` (a 39-diagram architecture atlas, authored from source by a grounding→author→adversarial-verify workflow, freshness-gated by `code_refs` liveness, vault-integrated). This PRD generalizes that proof into standing plugin features. **F3 (the containment model) is deliberately left as an options analysis with a recommendation, not a resolved decision** — it is the keystone and the owner has not yet chosen.

---

## 1. Summary

Today `wildlife-vault` maintains a typed, validated *knowledge graph* that sits **over** a project's documentation and code — nodes distill sources and cite them. It is excellent at capturing *distilled knowledge* but has no opinion about the project's *documents themselves* (the PRD, the specs, the plans, the kickoffs, the trackers, the retros) beyond a one-shot `seed-from-prd`, and no notion of *architecture diagrams* at all.

This PRD adds three things:

- **F1 — Architecture Diagram Atlas.** A standing, generalizable diagram *taxonomy* (8 categories, ~35 diagram types) plus a generator skill and a `code_refs` freshness gate, so every project gets an as-built, verified, drift-checked visual architecture reference.
- **F2 — Documentation Lifecycle Capture.** Formalize the full delivery lifecycle — PRD → Design → Spec → Plan → Implementation → Operate/Govern — as a first-class, vault-tracked practice, with a complete doc taxonomy (including the standard enterprise docs most projects *should* keep but don't), lifecycle state on each artifact, and skills to scaffold/ingest/sync them.
- **F3 — Containment Model.** Decide whether the vault *contains* the project's docs (docs-as-nodes) or stays *separate* from them (the current cite model), analyzed for robustness and portability. This choice governs where F1 and F2 land.

The north star: **a project's entire documented understanding — deliverables, distilled knowledge, and architecture diagrams — lives as one portable, typed, drift-checked, Obsidian-navigable, agent-first system that every future project inherits by installing the plugin.**

## 2. Motivation

- **Every project re-invents its doc practice.** `intelligence-harness` evolved a strong lifecycle (PRD → build-contract → superpowers spec/plan → kickoff → tracker → retro → verification), but none of it is codified in the plugin; the next project starts from a blank `docs/`.
- **Diagrams are absent or stale.** A rich system had 6 diagrams before this session; enterprises expect C4, sequences, data models, threat DFDs, deployment topologies. When diagrams do exist they rot silently against the code.
- **Docs and knowledge are split across two homes.** The human reads `docs/`; the agent reads `docs/vault/Knowledge/`. Cross-navigation is manual; provenance points outward; there is no single graph.
- **The bones already exist.** The `doc_class` enum already enumerates `prd | design | spec | plan | kickoff | adr | analysis | user-journey`; `c4_level` already classifies module/flow nodes; `seed-from-prd` already turns a PRD into nodes. This PRD connects those bones into a spine.

## 3. Goals / Non-goals

**Goals**
- G1. A generalizable diagram atlas any project generates from its own source, verified and freshness-gated.
- G2. A codified documentation lifecycle + a complete doc taxonomy the plugin scaffolds and tracks.
- G3. A ratified containment model (F3) with a clear migration path.
- G4. Zero runtime dependencies preserved (the plugin's defining constraint); Node ESM + Markdown + Mermaid only.
- G5. Everything additive to the existing schema/skills/hooks — no breaking change to installed vaults.

**Non-goals**
- N1. Rendering diagrams to images at build time (Mermaid-in-markdown renders in GitHub + Obsidian; no headless-browser dependency in the plugin).
- N2. Replacing superpowers' brainstorming/writing-plans skills — this *captures* their outputs, it does not re-implement them.
- N3. A hosted service or database — the vault stays a directory of Markdown.
- N4. Interactive/web diagram surfaces (React Flow / Cytoscape) — those are a consuming app's concern, not the plugin's.

## 4. Background — what the plugin is today (the reuse surface)

- **Schema** (`scripts/vault/schema.mjs`, `docs/STANDARD.md`): 11 node types; `doc_class` already includes the lifecycle classes; `c4_level` on module/flow; flat `rel_*` relations; `sources`/`code_refs` provenance.
- **Skills** (12): `vault-init, vault-new, vault-author, vault-map, vault-lint, vault-status, vault-link, vault-tags, vault-colorize, vault-learn, vault-learnings, vault-evolve`.
- **Scripts** (`scripts/vault/*.mjs`): `validate, index, status, colorize, link-scan, learn-sweep, init, config, …` — zero-dependency Node ESM.
- **Hooks** (`hooks/hooks.json`): PreToolUse validate (blocks malformed writes), PostToolUse re-validate, SessionStart pointer inject, SessionEnd learning nudge.
- **Skeleton** (`skeleton/`): the scaffold copied on `vault-init` (Knowledge folders, `_meta` seeds, CLAUDE.md/AGENTS.md fragments, gitignore stanza).
- **Docs** (`docs/`): `STANDARD.md`, `seed-from-prd.md`.

---

## 5. F1 — Architecture Diagram Atlas

### 5.1 What it is
A standing capability that generates and maintains an **as-built, source-verified architecture atlas** for any project: a set of Mermaid-in-markdown diagrams organized by a fixed enterprise taxonomy, each annotated with the source it depicts, each drift-checked by a freshness gate, each discoverable from the vault.

### 5.2 The taxonomy (generalized — a template, not fixed instances)
8 categories, ~35 diagram *types* (a given project realizes the ones that apply):

1. **C4 & structure** — L1 system context · L2 container · L3 component (per major container) · package/module dependency graph · seams/extension-points map.
2. **Behavioral & dynamic** — critical-path sequence · core pipelines (write/read/ingest) · auth/session · one integration call-flow per external system.
3. **Data & model** — the persisted entity/graph model · the API/wire contract (class) · the access-control/RLS model · migration/lineage.
4. **State machines & lifecycles** — one per stateful domain entity · review/approval lifecycles · the decision (ADR) lifecycle.
5. **Deployment & infrastructure** — topology per environment · local dev topology · network/egress/trust boundaries.
6. **Security & trust boundaries** — auth-perimeter DFD · threat-model DFD · supply-chain trust · credential/secrets model.
7. **Roadmap & governance** — milestone/roadmap timeline · ADR dependency map · ownership/80-20 boundary map · feature map.
8. **Process & team** — dev lifecycle loop · orchestration patterns · CI/test topology · quality (TDD/review) discipline.

Full generalized catalog in **Appendix A**.

### 5.3 Conventions (proven this session)
- **Mermaid-in-markdown only** (renders in GitHub + Obsidian, diffable, no dependency).
- **Theme-aware** — no hardcoded hex; `classDef stroke-dasharray` marks design-intent (forthcoming) diagrams.
- **Per-diagram annotation** drives the freshness gate and the as-built/design-intent boundary:
  `<!-- diagram: <slug> | status: as-built|design-intent | verified-as-of: <ref> | code_refs: path, path#symbol -->`
- **Grounded in source, never memory** — every node/edge/label traces to a named symbol/line; authored *after* reading source; adversarially verified before it lands.
- **Canonical home + citation** — diagrams live once; vault module/flow nodes set `c4_level` and cite the atlas via `sources:`.

### 5.4 The freshness gate
A zero-dependency Node ESM checker (`scripts/vault/diagram-freshness.mjs`, generalized from the proof) parses the annotations and asserts each `code_refs` path still exists (hard-fail as-built, warn design-intent) and each `#symbol` still resolves (warn on drift) — mirroring `vault-status` liveness. Surfaced via a new skill and foldable into a project's CI.

### 5.5 New plugin surface
- **Skill `vault-atlas`** — generate/refresh the atlas from the project's source, following the taxonomy. Runs the grounding→author→verify method (or hands the method to the calling agent). Idempotent; updates `verified-as-of`.
- **Skill `vault-diagram-check`** (or fold into `vault-status`) — run the freshness gate; report drift.
- **Script** `diagram-freshness.mjs` + its unit test.
- **Schema (optional, additive):** a diagram-atlas node type OR reuse `guide` + `c4_level` (decide in design; the proof used a `guide` "Architecture Atlas" node + `runbook` "maintenance" node + `c4_level` cross-links — no new type needed).
- **Skeleton:** an `architecture/` area (location depends on F3) + an atlas index stub + a maintenance runbook stub.

### 5.6 Ingestion vs build-time
Two triggers, both supported:
- **On ingestion** (`vault-init` / `seed-from-prd` of an existing project): generate the atlas from the current codebase as a one-shot baseline.
- **During the build** (each lifecycle stage): refresh affected diagrams at sprint/milestone boundaries; the freshness gate flags drift so refresh is prompted, not forgotten.

---

## 6. F2 — Documentation Lifecycle Capture

### 6.1 The lifecycle
Codify the delivery arc as a first-class, vault-tracked practice:

```
Discover → Design → Spec → Plan → Implement → Operate → Govern
  PRD       design    build     impl-plan   code+tests  runbooks   retro/verify
  teardown  ADR/RFC   contract  (superpowers)           deploy     tracker/risk
```

Each stage produces named artifacts; the vault tracks each artifact's `doc_class`, a **lifecycle state**, and its relations (what it decides, depends on, supersedes, documents). A `lifecycle` view answers "where is this project, and what's missing?"

### 6.2 The complete doc taxonomy (incl. what we *should* keep but don't yet)
The `✓ / ✗` column is `intelligence-harness` today — the `✗ should` rows are the gap this feature closes for future projects.

| Stage | Doc type | doc_class | We use it? |
|---|---|---|---|
| Discover | PRD (product requirements) | `prd` | ✓ |
| Discover | Competitive teardown / market analysis | `analysis` | ✓ |
| Discover | Vision / one-pager | `prd` | ✗ should |
| Discover | User journeys / personas | `user-journey` | ~ partial |
| Discover | Glossary / ubiquitous language | `reference` | ~ (protected-vocab) |
| Design | Design brief / UX handoff | `design` | ✓ |
| Design | **Architecture overview / C4 atlas** | *(F1)* | ✗ → **F1** |
| Design | ADR (decision record) | `adr` | ✓ |
| Design | **RFC (lightweight proposal, pre-ADR)** | `analysis` | ✗ should |
| Design | **Threat model / security design (STRIDE/DFD)** | `analysis` | ✗ should |
| Design | Data dictionary / schema catalog | `data` | ~ partial |
| Design | API / interface contract | `data` | ~ partial |
| Design | **NFR / SLO / SLI / capacity plan** | `reference` | ✗ should |
| Spec | Kickoff plan | `kickoff` | ✓ |
| Spec | Build contract / impl spec | `spec` | ✓ |
| Spec | **Test plan / test strategy** | `plan` | ✗ should |
| Spec | **Definition of Done / quality gates** | `reference` | ~ implicit |
| Plan | Implementation plan (superpowers) | `plan` | ✓ |
| Plan | Tracker / status board | `reference` | ✓ |
| Plan | Risk register / open questions | `reference` | ✓ |
| Operate | Operational runbooks | `runbook` | ✓ |
| Operate | Dev onboarding / local setup | `runbook` | ✓ |
| Operate | **Deployment / release runbook** | `runbook` | ~ partial |
| Operate | **Observability / monitoring plan** | `reference` | ✗ should |
| Operate | **Incident postmortem (template)** | `analysis` | ✗ should |
| Operate | **Rollback / DR plan** | `runbook` | ✗ should |
| Operate | **Release notes / changelog** | `reference` | ✗ should |
| Operate | Migration / upgrade guide | `guide` | ~ partial |
| Govern | Verification / gate report | `reference` | ✓ |
| Govern | Retro / postmortem | `analysis` | ✓ |
| Govern | License / dependency register | `reference` | ✓ |
| Govern | **Compliance / audit mapping** | `reference` | ✗ should |

### 6.3 New plugin surface
- **Skill `vault-lifecycle`** — scaffold/track the lifecycle: create the next stage's artifact from a template, set its lifecycle state, wire its relations; report gaps ("no test plan; no threat model").
- **Templates** (`skeleton/templates/<doc_class>.md`) — one per doc type above, with the section skeleton + frontmatter, so a stage's artifact is scaffolded consistently.
- **Extend `seed-from-prd`** into **`vault-seed`** — ingest not just a PRD but any existing lifecycle artifact set (PRD, ADRs, specs, plans, kickoffs, trackers, retros) into the vault (as nodes or as cited sources — per F3).
- **Schema (additive):** an optional `lifecycle_stage` field (`discover|design|spec|plan|implement|operate|govern`) and/or `lifecycle_state` on deliverable nodes; a soft cross-check that `doc_class` ↔ stage is consistent.

---

## 7. F3 — Containment Model (the keystone decision)

**The question:** does the vault *contain* the project's documents, or stay *separate* from them?

The plugin's Standard today is explicit: *nodes **cite** their sources; they do not duplicate them.* F1/F2 push on that — a PRD, a spec, an atlas are documents, and the owner's instinct is "contain them all in the vault instead of linking outside to docs." This section lays out the trade-offs so the choice is deliberate.

### 7.1 The three options

- **A — Separate (today).** Docs live in `docs/`; the vault (`docs/vault/Knowledge/`) is a distilled typed graph that cites them via `sources:`. Two homes; the vault is an *index over* the docs.
- **B — Contain-all.** Every document becomes a vault node (using the lifecycle `doc_class`es). No separate `docs/`. The vault *is* the document system; there is one graph.
- **C — Hybrid (docs-in-vault, code-cited).** Lifecycle *deliverables* (PRD, design, spec, plan, kickoff, tracker, retro, ADR, atlas) become **full-content vault nodes** under a deliverables tier; **distillation nodes** (concepts/flows) still cite them intra-vault; **code stays linked** via `code_refs`, never pulled in. One portable vault with two tiers (documents + distilled knowledge); code stays where it lives.

### 7.2 Trade-off analysis

| Dimension | A — Separate | B — Contain-all | C — Hybrid |
|---|---|---|---|
| **Portability** (one self-contained, Obsidian-openable, git-cloneable unit) | Two systems to carry; provenance points outside the vault | Best — one directory is everything | Best — one directory is everything (docs + knowledge); code referenced |
| **Robustness** (structure enforced, can't rot) | Docs are free-form/unenforced; only the graph is validated | Strongest — hooks govern *every* doc | Strong — hooks govern deliverables + knowledge; a *lighter* contract for long-form |
| **Agent navigation** (one place to read) | Two homes; agent must know both | One graph; best recall | One graph; best recall |
| **Human approachability** | Familiar `docs/` tree; PRDs read like docs | A PRD-as-node with frontmatter can feel over-structured | Deliverables keep full prose; frontmatter is a thin header |
| **Write friction** | None — a quick note is a quick note | High — every doc write passes validation | Medium — deliverables validate on a *relaxed* long-form contract |
| **External shareability** (send a PRD to a client/partner) | Easy — it's a plain doc | Harder — must strip vault frontmatter | Medium — frontmatter is a small, strippable header |
| **Tooling fit** (validator/indexer built for *nodes*) | Clean — tooling only touches the graph | Stressed — long deliverables break the "summary is what's read" model | Needs a long-form node contract (summary drives index; body is the deliverable) |
| **Migration cost / risk** | Zero (status quo) | High — migrate every existing doc; big-bang | Low — incremental; adopt per doc type |
| **Rot resistance** | Docs rot silently; graph is checked | Everything checked incl. `code_refs` liveness | Everything checked; deliverables + diagrams gated |
| **Provenance model** | `sources:` point outward (fragile links) | All intra-vault (wikilinks) | Docs intra-vault; code outward (stable `code_refs`) |

### 7.3 Recommendation (for ratification — not yet decided)

**Lean: C (Hybrid), phased.** It captures the owner's intent ("contain the docs") and the strongest portability/robustness/navigation, while avoiding B's two real costs — the migration big-bang and the write-friction/over-structuring of long-form docs — and preserving what makes the vault valuable (the *distilled* layer distinct from raw deliverables). Code is never ingested (it changes fastest and lives in the language's own tools); it is referenced by `code_refs`, which the freshness gate keeps honest.

The decisive framing: **the most robust + portable unit is one self-contained vault directory that holds two tiers — documents (full-content, lightly-typed) and distilled knowledge (typed nodes) — with code referenced, not contained.** That is C. B reaches the same portability but pays a migration + friction tax that buys little over C; A is the least portable and leaves docs unenforced.

**What C requires (design work, F3 is the gate):**
- A **long-form deliverable contract** — a node whose `summary` drives the index while its body *is* the full deliverable (relax the "summaries are what's read; bodies are distilled" assumption for `doc_class ∈ {prd, design, spec, plan, kickoff, adr, analysis}`).
- A **deliverables tier/location** in the skeleton (e.g. `Knowledge/deliverables/` or per-`doc_class` folders) distinct from the distillation folders.
- A **`vault-seed` migration** that moves an existing `docs/` tree into the vault incrementally, converting each doc to a deliverable node (or leaving it cited if the owner opts a type out).
- A **cite-vs-contain policy per doc_class** in `.vault.json`, so a project can keep, say, client-facing PRDs external while containing everything else.

### 7.4 Open sub-questions for F3
- Do **superpowers** artifacts (`docs/superpowers/specs`, `plans`) move into the vault, or stay where superpowers writes them and get *cited*? (They're generated by another tool's convention.)
- Does the **tracker** (a fast-moving, append-heavy doc) fit a validated node, or stay a cited free-form doc? (Write-friction is highest here.)
- Where do **client-shareable** docs live under a white-label constraint (strip frontmatter on export)?

---

## 8. How it composes with the existing plugin

| Area | Delta |
|---|---|
| **Schema** (`schema.mjs`, `STANDARD.md`) | Additive: optional `lifecycle_stage`, `lifecycle_state`; a long-form deliverable contract (F3); no breaking change. `c4_level` reused as-is. |
| **Skills** | New: `vault-atlas`, `vault-lifecycle`, `vault-diagram-check` (or fold into `vault-status`); extend `seed-from-prd`→`vault-seed`. |
| **Scripts** | New: `diagram-freshness.mjs` (+ test). Extend `validate.mjs` for the long-form contract + lifecycle cross-check. |
| **Hooks** | Unchanged mechanism; the validator gains the new (additive) checks. |
| **Skeleton** | New `templates/` (one per doc type), a deliverables tier (F3), an `architecture/` atlas stub + maintenance runbook stub. |
| **Docs** | New: `atlas-standard.md`, `lifecycle-standard.md`; update `STANDARD.md` + `seed-from-prd.md`. |

## 9. Phasing / rollout

- **Phase 1 — F1 Atlas** (independent, proven): taxonomy + `vault-atlas` + `diagram-freshness.mjs` + gate + docs. Ships alone; validated against `intelligence-harness`.
- **Phase 2 — F3 decision**: ratify the containment model (this PRD's §7), because it sets where F1/F2 artifacts land.
- **Phase 3 — F2 Lifecycle**: templates + `vault-lifecycle` + `vault-seed` + the doc taxonomy, landing per the F3 model.
- Each phase is a versioned plugin release with its own tests; installed vaults upgrade additively.

## 10. Success criteria
- A fresh `vault-init` on any repo can produce a source-verified atlas whose freshness gate is green, plus a scaffolded lifecycle with gap reporting — with zero added runtime dependencies.
- `intelligence-harness` migrates to the ratified F3 model with its existing docs + the 39-diagram atlas intact and lint-clean.
- The next new project inherits the full practice by installing the plugin — no bespoke `docs/` reinvention.

## 11. Open questions
- Q1. F3 containment model — A / B / C (recommendation: C). **Owner decision.**
- Q2. Diagram-atlas node: new type vs `guide`+`c4_level` (proof used the latter).
- Q3. superpowers artifacts + tracker: contain or cite (F3 sub-questions).
- Q4. Do we generate images (SVG) for non-Obsidian/non-GitHub consumers, or stay markdown-only (N1)? (Leaning markdown-only.)
- Q5. Per-`doc_class` cite-vs-contain override in `.vault.json` — needed for white-label/client-shareable docs?

---

## Appendix A — The generalized diagram catalog (F1)

*(Realize the subset that applies to a given project; mark forthcoming surfaces `design-intent`.)*

1. **C4 & structure:** `c4-l1-system-context` · `c4-l2-container` · `c4-l3-component-<container>` (×N) · `pkg-dependency-graph` · `seams-map`
2. **Behavioral:** `seq-critical-path` · `flow-<pipeline>` (×N: write/read/ingest) · `seq-auth-session` · `seq-<integration>` (×N external systems)
3. **Data & model:** `data-model` (ER/graph) · `class-api-contract` · `access-control-model` (RLS/tiers) · `migration-lineage`
4. **State machines:** `state-<entity>-lifecycle` (×N) · `state-review-approval` · `state-decision-adr`
5. **Deployment:** `deploy-<env>-topology` (×N) · `deploy-local-dev` · `deploy-network-egress-boundaries`
6. **Security:** `sec-auth-perimeter-dfd` · `sec-threat-model-dfd` · `sec-supply-chain` · `sec-credential-model`
7. **Roadmap & governance:** `roadmap-milestones` · `adr-dependency-map` · `ownership-boundary-map` · `feature-map`
8. **Process & team:** `process-dev-lifecycle` · `process-orchestration` · `process-ci-topology` · `process-quality-discipline`

## Appendix B — Provenance
Proof-of-concept: `intelligence-harness` branch `docs-architecture-atlas` (39 diagrams, freshness gate, vault integration) + the session handoff `docs/handoff-autonomous-2026-07-10.md`. Method: a grounding workflow (source→evidence-cited facts) → per-category authoring (from facts) → adversarial per-diagram verification (refute-against-source) → freshness gate + vault cross-links.
