---
name: vault-maintain
description: "Audit documentation lifecycle, link debt, provenance, and current-state navigation, or perform an authorized cleanup. Use for documentation maintenance, staleness reviews, canonical-versus-historical classification, or link ratchets; ordinary writing does not require a full audit."
---
Read [shared runtime and scope](../../references/runtime.md) and
[maintenance guidance](../../references/maintenance.md).

Determine whether the request is a read-only audit, a targeted repair, or an
explicitly authorized cleanup. Inspect project conventions, the existing checker,
and the current hub/backlog first. Reuse them when they serve the task.

For projects without an equivalent checker, the optional read-only helper is:

```sh
node "${VAULT_PLUGIN_ROOT}/scripts/vault/maintenance-audit.mjs" --project-dir="${VAULT_PROJECT_DIR}" --policy=<project-relative-policy.json>
```

Read the policy contract in the maintenance guidance before using it. Missing
policy is an error, not permission to create one. Report measured scope, excluded
sources, classified findings, fragment-validation limits, and evidence gaps.
The helper never writes a report, baseline, index, or source artifact.

For repairs, adjudicate each target against its actual source and lineage. Update
the canonical hub/backlog with owner, next action, evidence, and an explicit
disposition. Keep source evidence intact and retest changed links plus the debt
ratchet. Do not silently rebaseline or fabricate targets to produce a green check.
