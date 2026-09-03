# Independent skill forward test

These scenarios complement executable tests; wording checks are not evidence of
agent behavior. Run against an isolated synthetic project, with the generated
package available. Snapshot contents and filesystem metadata before and after.
Do not give the evaluator the expected result before it performs the task.

## Scenario: read-only documentation audit

User request: "Audit this project's documentation without changing files. Assess
link health, current-state navigation, and staleness; give concrete next actions."

Synthetic project:

- AGENTS instructs use of plain Markdown, `docs/index.md`, and `docs/backlog.md`.
- The hub links a service guide, backlog, and historical launch notes.
- The service guide claims queue behavior at an unresolvable synthetic commit,
  links a declared but absent restricted CSV, and a nonexistent backlog heading.
- An old design explicitly says it was superseded by a synthetic PR.
- Historical launch notes link an absent results CSV.
- A generated capture contains an unresolved wikilink; a raw source is excluded.
- Policy assigns active, historical, and generated scopes and registers the
  gitignored external asset. No typed-vault configuration is supplied.

Observed in the independent forward test for this change:

- Audit left 28 files / 42 entries unchanged in content and tested metadata.
- Helper measured six Markdown documents, correctly separated external,
  historical, and generated findings, and reported its fragment limitation.
- Evaluator manually found the nonexistent heading despite a file-level pass.
- Queue behavior remained unknown because the cited revision/evidence could not
  be verified. Age alone did not downgrade the historical design.
- Recommendations updated the existing backlog, preserved historical/raw data,
  and did not invent the missing CSV or convert the project to a typed vault.

This is one bounded behavioral evaluation, not proof of all model behavior.
The executable suite covers repeatable parser, policy, no-write, packaging,
source-provenance, and initialization invariants. Re-run this scenario after
substantial changes to skill routing or maintenance instructions.
