# Shared runtime and scope

Project instructions and the user's requested scope take precedence. Read applicable
`AGENTS.md`, existing documentation conventions, and `docs/vault/.vault.json` when
present. Do not initialize a second vault or migrate a project's schema merely to
use this plugin. Ordinary documentation edits need only the relevant conventions
and changed-link checks; maintenance modes are opt-in.

When adopting existing PRDs, ADRs, registers, or other legacy artifacts, read
[legacy document guidance](legacy-documents.md). Preserve their canonical homes,
IDs, formats, and authority; the typed node contract is not a migration requirement.

For document-family selection, development workflows, or requirement-to-evidence
reading routes, use `vault-lifecycle` and its [lifecycle guide](lifecycle.md).

In command examples, `VAULT_PLUGIN_ROOT` means this installed plugin's root (two
levels above the skill directory); `VAULT_PROJECT_DIR` is the confirmed consumer
repository root. Resolve and quote those absolute paths in each command. Claude
may supply `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PROJECT_DIR`; Codex does not require
those variables. Prefer an explicit `--project-dir` over inherited environment.
Invoke skills by their discovered name. Codex namespaces these plugin skills,
for example `$wildlife-vault:vault-maintain`; Claude keeps its existing commands.

Claude's existing hooks are unchanged. The generated Codex package has **no
hooks**: run the scripts explicitly. PreToolUse sees full Write content, but Edit
validation happens after the edit; neither client has an automatic whole-project
link gate. A hook's presence is not evidence that a check ran.

Audit, lint, status, and preview requests are read-only: report in the conversation
unless an output file is requested. Do not run init, map, colorize, tag backfills,
learning capture, or default learning export during an audit. Use export's
`--dry-run` only if a preview was requested; automated sanitization is not approval
to share restricted information. Preserve raw evidence and restricted data.

For authorized writing, update the existing canonical document and current hub or
backlog. Capture durable findings only when relevant to that work. Do not append
status twins or invent missing artifacts to satisfy a validator. Cleanup approval
does not imply deleting evidence, rewriting history, or modifying unrelated work.
For lifecycle, evidence, link debt, or cleanup work, use `vault-maintain` and read
[maintenance.md](maintenance.md). Specialized modes do not apply to every edit.
