---
name: vault-lifecycle
description: "Plan, author, or connect development lifecycle documents: product requirements, decisions, designs, specifications, delivery plans, implementation evidence, operations, and retrospectives. Use when choosing document types, improving an agent's reading path, or tracing requirements through a document graph. Preserve existing project formats; routine edits need only their local conventions."
---
Read [shared runtime and scope](../../references/runtime.md). Establish whether the
request is an explanation/review, an authorized documentation change, or execution
of the work described by a document. Authoring a deployment plan does not authorize
deployment. An explanation or review does not create files.

1. Open the project's declared entry point and register, then the source documents
   needed for the question. Resolve supplied IDs through that register; a prefix
   suggests a family, not an artifact's actual subject, existence, or approval.
2. Use the family lookup in [document types](../../references/document-types.md)
   and read only the relevant family sections. Distinguish design (how/why),
   specification (testable obligations), plan (who/when/how to execute), and
   implementation/verification evidence (what actually happened).
3. Follow [lifecycle and graph navigation](../../references/lifecycle.md) for the
   appropriate reading path, relationship direction, and change-impact review.
   Preserve existing source formats and ownership using
   [legacy document guidance](../../references/legacy-documents.md) when needed.
4. For authorized writing, update the canonical artifact and its existing registry
   row. Add a new artifact only when a real decision, contract, delivery, or evidence
   need requires it. Reuse project IDs, templates, states, headings, and trackers.
   Proposed IDs stay planned rows until files exist. Do not generate empty artifacts
   to complete the catalog or migrate legacy docs into typed nodes.
5. Link the affected requirements, decisions, contracts, work, and evidence with
   explicit meanings. Distinguish approval, applicability, implementation, and
   verification. Record unknown evidence and owner/next action in the existing
   tracker; a successful link check cannot establish those claims.
6. Verify changed links and the relevant content/evidence. For typed-node changes,
   use `vault-author` and the actual map/lint commands; for legacy documents, use
   project checks or the scoped maintenance helper. Report what was measured and
   what remains unresolved. Capture reusable learnings only within authorized work.

Deliver the requested explanation or document change with a short reading route,
the source of authority, and any material evidence gaps. This skill supplies an
authoring and navigation workflow, not an automatic lifecycle graph generator,
approval engine, or full YAML/semantic validator.
