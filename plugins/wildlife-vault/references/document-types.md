# Document families and useful contracts

Use the lookup to select the artifact needed for the current question, then read
only that family's guidance. These are conventions a project can adopt, not a
required catalog. Reuse its existing documents and taxonomy before creating any.
See [lifecycle and graph workflow](lifecycle.md) for connecting and browsing the
artifacts, and [legacy document guidance](legacy-documents.md) for preserving
existing formats, authority, and paths.

## Interpret the identity before the content

A family such as `PRD`, `DAT`, or `ANA` describes a document's role. The number in
its ID identifies that artifact; it does not establish priority, lifecycle order,
approval, or implementation. Preserve existing IDs, including their numbering.
`ANA` commonly means analysis, but the project's register decides its meaning.
`ANA-004` and `ANA-005` reveal no subject by themselves: inspect their titles and
sources before assigning either an analytics, inventory, or research topic.

Keep identity, version, approval status, implementation state, and verification
evidence distinct. A revised draft can have a newer version than an approved
contract without superseding it. An accepted decision can describe unbuilt work.
The source's vocabulary remains authoritative for that source.

Artifact families are also separate from Vault structural `type` and `doc_class`.
A `DAT` artifact might be JSON Schema, SQL, a spreadsheet, or prose; an `API`
contract might be OpenAPI YAML; a migration inventory might be CSV. Word, PDF,
and externally maintained documents can remain canonical in their existing homes.
Register and link them; do not make Markdown copies to fit this lookup.

## Distinguish the work each artifact does

| Job | Question answered | Input and useful output |
|---|---|---|
| Requirements | What outcome or behavior is needed, for whom, and within what scope? | Evidence and stakeholder intent become requirements with acceptance conditions. |
| Design | What shape could satisfy those requirements, and why choose it? | Requirements and constraints become boundaries, alternatives, views, and decisions. |
| Specification | What exact contract must an implementation satisfy? | Approved intent becomes testable rules, interfaces, data constraints, and failure behavior. |
| Plan | Who will do which work, in what dependency order, and how will it exit? | Contracts and open decisions become owned work, milestones, checks, and rollback tasks. |
| Implementation evidence | What exists at a particular revision, and what was actually checked? | Code, configuration, migrations, and executed checks become scoped evidence with results and limits. |
| Retrospective | What happened compared with the intent, and what should change next? | Outcomes and evidence become lessons, corrective actions, and revisions to the relevant sources. |

These jobs can share a document when their boundaries remain clear. A specification
is not an implementation plan, and a planned test is not an observed result. Keep
design-intent views distinguishable from as-built views. An as-built claim needs
the implementation revision and evidence supporting it.

## Family lookup

| Family | Main role | Create or expand when |
|---|---|---|
| [PRD](#prd-product-requirements) | Outcomes, scope, requirements, acceptance | Product behavior or stakeholder expectations need an agreed boundary. |
| [ADR](#adr-decision-record) | One consequential choice and its rationale | Alternatives have lasting consequences that future work must understand. |
| [DES / C4](#des--c4-design-and-architecture) | Design intent and architecture views | A boundary, responsibility, interaction, or user experience needs explanation. |
| [DAT](#dat-data-contract) | Data meaning, shape, and integrity | Stored or exchanged data has consequential semantics or constraints. |
| [API](#api-interface-contract) | Behavior across an interface | Components, teams, or external systems need a shared interaction contract. |
| [QAT](#qat-quality-attributes) | Measurable quality requirements | Performance, accessibility, reliability, or other qualities affect acceptance. |
| [SEC](#sec-security-and-privacy) | Trust, threats, controls, and residual risk | Data, actors, or operations cross a security or privacy boundary. |
| [TST](#tst-verification-strategy) | How requirements will be verified | Verification spans meaningful risks, environments, or multiple methods. |
| [MIG](#mig-migration-and-cutover) | Transition, compatibility, reconciliation, recovery | An existing system, contract, dataset, or route must change safely. |
| [ANA](#ana-analysis-and-observation) | Findings with methods and evidence limits | Research or observations need to inform a decision without becoming approved intent. |
| [PLN](#pln-delivery-plan) | Owned work and dependency order | Delivery needs coordination beyond the existing task list. |
| [IMP](#imp-implementation-record-when-needed) | Implementation and verification evidence | Existing PRs, release records, or tracker evidence cannot provide a stable home. |
| [RET / INC](#ret--inc-retrospective-and-incident-review) | Outcome review and corrective learning | A milestone, incident, or near miss merits review. |
| [OPS / RUN](#ops--run-operations-and-procedures) | Operating model and executable procedures | A service needs operation, support, recovery, or repeatable intervention. |
| [GVN / TRC / RSK](#gvn--trc--rsk-governance-traceability-and-risk) | Authority, requirement coverage, and uncertainty | Scale, coordination, or a review obligation needs explicit oversight. |

The questions below are the minimum useful content to consider, not mandatory
headings. For a new document, use only the sections its task needs. For an existing
one, preserve its headings, anchors, format, and row meanings; add missing answers
in the appropriate existing location.

### PRD: product requirements

Answer: Who has the problem? What outcome matters? What is in and out of scope?
Which behaviors and quality requirements are necessary, and how will acceptance
be judged? Identify assumptions, unresolved decisions, and approval ownership.
Inputs are stakeholder needs and qualified observations. Outputs are stable
requirements and acceptance conditions that design, specifications, and tests cite.
Keep implementation prescriptions in the PRD only when they are actual constraints.

### ADR: decision record

Answer: What consequential question is being decided? What constraints and
alternatives matter? Who decided what, why, and with which consequences? What
would cause reconsideration? Inputs are requirements, analysis, and options;
outputs are the choice, rationale, status, and affected contracts or planned work.
State implementation separately from acceptance. Preserve an existing ADR format
and supersession history. Use the Vault decision template only for a canonical
vault-native decision; an external ADR needs no duplicate decision node.

### DES / C4: design and architecture

Answer: What viewpoint and system boundary does this design cover? Which actors,
components, responsibilities, interactions, and constraints matter? What decisions
support the shape, and which parts remain unresolved? Inputs are requirements,
decisions, and observed constraints; outputs guide detailed specifications and
implementation. Label each view as design intent or as-built, with supporting
source references. Choose the needed structural or behavioral views; a diagram
catalog does not require every possible level or diagram.

### DAT: data contract

Answer: What do entities, fields, and relationships mean? How are identity,
cardinality, nullability, validation, ownership, and integrity handled? What are
the lifecycle, retention, and schema-evolution rules where relevant? Inputs are
domain requirements and decisions. Outputs are logical models, dictionaries,
schemas, and constraints consumed by implementation, API contracts, migration,
and tests. Distinguish observed source data from the intended target model; link
the machine-readable schema rather than restating every field in prose.

### API: interface contract

Answer: Who calls which operations? What are the request, response, authentication,
authorization, and error contracts? What do retries, timeouts, idempotency,
ordering, and version compatibility mean where applicable? Inputs are use cases,
data contracts, and security boundaries. Outputs are implementable interfaces,
examples, and conformance conditions for consumers and tests. Identify normative
schema or protocol definitions and distinguish them from illustrative examples.

### QAT: quality attributes

Answer: Which quality must hold, under what workload or conditions, and at what
measurable threshold? What scope, measurement method, environment, and owner make
the target meaningful? Include relevant trade-offs and acceptance criteria.
Inputs are product needs and operational constraints. Outputs constrain design
and supply test or monitoring targets. A target is not a measured baseline; keep
the observation and its date separate. Include only relevant qualities rather
than filling a universal performance, reliability, or accessibility checklist.

### SEC: security and privacy

Answer: Which assets and data need protection, from which actors and failure
scenarios? Where are the trust boundaries? Which controls address each material
threat, who owns them, and what risk remains? Inputs are architecture, data flows,
requirements, and applicable obligations. Outputs are control requirements,
design constraints, verification cases, and owned residual risks. Link evidence
for implemented controls; a proposed mitigation is not proof of enforcement.
Keep restricted details in their existing approved storage locations.

### TST: verification strategy

Answer: Which requirements and risks will be checked, by which method, against
what revision, fixtures, and environment? What are the pass/fail conditions,
coverage limits, owners, and evidence locations? Inputs are PRD, DAT, API, QAT,
SEC, and migration contracts as applicable. Outputs are executable or manual
verification tasks and acceptance gates. Link subsequent results separately,
including failures and skipped checks; do not mark a strategy itself as proof.

### MIG: migration and cutover

Answer: What is moving from which baseline to which target? What must remain
compatible? How are mappings, transformations, ordering, reconciliation, and
cutover performed? Who approves acceptance, and what triggers rollback or an
explicit forward-recovery path? Inputs are source inventories, target contracts,
and continuity requirements. Outputs are migration rules, executable work,
rehearsal and reconciliation evidence, and cutover/recovery procedures. Preserve
the original baseline and record dispositions rather than silently changing it.

### ANA: analysis and observation

Answer: What question was investigated, using which sources, scope, method, and
as-of date? What was observed, what is inferred, what conflicts, and what remains
unmeasured? Inputs are evidence and research questions. Outputs are qualified
findings, alternatives, and recommendations for PRDs, ADRs, or specifications.
Name the actual subject in the title and summary. Analysis may concern inventory,
feasibility, behavior, or many other topics; its numeric ID does not select one.
An observation or recommendation does not supersede an approved requirement.

### PLN: delivery plan

Answer: What work is needed, who owns it, and which dependencies or decisions
determine its sequence? What dates or milestones are committed versus estimated?
What is the exit evidence and how are blockers handled? Inputs are contracts,
open decisions, risks, and capacity. Outputs are owned work packages and gates
in the team's existing planning surface. Reference detailed specifications and
test criteria instead of copying them into a second requirements list.

### IMP: implementation record, when needed

Prefer existing PRs, release records, and tracker evidence. Create an `IMP`
artifact only when those surfaces cannot answer: Which requirements did this
revision implement? Where are the code, configuration, and migration changes?
Which checks actually ran, with what results, environment, and remaining gaps?
Inputs are the implemented change and executed verification. Outputs let reviewers
trace delivery to contracts and let as-built views cite evidence. A merged PR
alone does not prove deployment, operation, or complete requirement coverage.

### RET / INC: retrospective and incident review

Answer: What was expected, what happened, and what evidence explains the gap?
For incidents, include impact, timeline, contributing conditions, response, and
recovery. Which changes will reduce recurrence or improve the next iteration,
who owns them, and how will completion be checked? Inputs are outcomes and
implementation or operational evidence. Outputs are qualified lessons and owned
actions that update relevant requirements, designs, tests, plans, or runbooks.
Preserve original observations and corrections rather than rewriting history.

### OPS / RUN: operations and procedures

Use `OPS` to answer how a service is operated: ownership, service targets,
signals, escalation, dependencies, and recovery responsibilities. Use `RUN` for
a specific procedure: trigger, prerequisites, ordered actions, expected results,
stop conditions, recovery, and verification. Inputs are the implemented system,
quality/security requirements, and operational experience. Outputs support
repeatable operation and incident response. Distinguish an untested procedure
from one exercised against a named version and environment.

### GVN / TRC / RSK: governance, traceability, and risk

Use `GVN` for authority and review rules: which artifact owns each concern, who
approves changes, and what triggers review or supersession? Use `TRC` to connect
requirements to decisions, specifications, implementation, and actual evidence,
with gaps visible. Use `RSK` for consequential uncertainty: impact, likelihood or
uncertainty, mitigation, trigger, owner, and disposition. Inputs are the existing
artifact inventory and delivery evidence; outputs are reviewable ownership,
coverage, and action. Extend a suitable existing register or tracker before
creating separate files for these roles.

## Distill knowledge without multiplying documents

A source can inform several durable facts; several sources can support one node.
Create nodes for useful knowledge, not one node per document. Often a direct link
from the existing portal is sufficient. When a typed vault already exists, these
are examples using the current schema, not automatic family conversions:

| Knowledge being distilled | Supported `type` | Suitable `doc_class` |
|---|---|---|
| DAT entity or wire contract | `data` | `knowledge`, `design`, or `spec`, according to the node's role |
| QAT constraint with a failure mode | `invariant` | `knowledge` or `spec` |
| API interaction across modules | `flow` | `knowledge`, `design`, or `spec` |
| DES/C4 responsibility boundary | `module` or `concept` | `knowledge` or `design` |
| ADR authored canonically inside the vault | `decision` | `adr` |
| Durable finding extracted from ANA or RET | `concept`, `invariant`, or `guide` | `knowledge`, `analysis`, or `guide`, as appropriate |
| Canonical operational procedure already native to the vault | `runbook` | `runbook` |

`data` is a structural type, **not** a supported `doc_class`. Family labels such
as `QAT`, `SEC`, and `IMP` do not add schema values. Follow the existing node
schema and templates. Cite source artifacts using `sources` and body links;
typed `rel_*` links connect existing vault node IDs. A derived node must not
become a competing approval record or delivery-status board. See the
[lifecycle workflow](lifecycle.md) for the document graph and traversal rules.
