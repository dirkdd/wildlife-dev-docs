# Codex compatibility and installation

The maintained source is `plugins/wildlife-vault`: its skills, references,
scripts, templates, and skeleton are shared with Claude. The Claude marketplace,
plugin manifest, and hook configuration remain intact. `usage-guard` is untouched.

`node scripts/build-codex.mjs` generates a separate, self-contained Codex
marketplace. It strips Claude-only skill metadata, adds the Codex manifest, and
copies only the vault's required resources. Generated copies are never edited or
committed. The package has no hooks, MCP server, credentials, or usage-guard.
The source tree's Claude hooks are **not** safe to expose through default Codex
hook discovery, so install the generated package, not the source plugin directory.

This uses the [official skill format](https://learn.chatgpt.com/docs/build-skills)
and [plugin distribution/session guidance](https://learn.chatgpt.com/docs/plugins).
CLI commands below were exercised with the installed Codex CLI during validation;
check `codex plugin --help` if using a different release. The skill-installer's
single-folder download is unsuitable here: sibling scripts/references would be
missing. Install the plugin once instead of installing duplicate loose skills.

## Build and validate an exact revision

Use a dedicated clone, with a clean checkout of the reviewed commit. Substitute
the full commit SHA provided by the PR/release for `TESTED_COMMIT`.

```sh
git clone https://github.com/dirkdd/wildlife-dev-docs.git
cd wildlife-dev-docs
git switch --detach TESTED_COMMIT
node --test plugins/wildlife-vault/test/*.test.mjs
node scripts/build-codex.mjs --out=../vault-codex-TESTED_COMMIT
```

The output directory must be new and outside the checkout. A dirty source is
rejected unless `--allow-dirty` is explicitly supplied for development tests.
Never install a dirty build as a verified release. The generated `SOURCE.json`
records the full source revision, dirty state, and SHA-256 of every package file
except the receipt itself. The generated manifest uses a commit-derived version
suffix, so different revisions cannot silently reuse one plugin cache version.
Keep the output in a persistent directory while installed.

Run the bundled Codex `plugin-creator/scripts/validate_plugin.py` on the generated
`plugins/wildlife-vault` directory and `skill-creator/scripts/quick_validate.py` on
every generated skill when those system skills are available. The repository's
Node tests also exercise relocation, package hashes, no-clobber behavior, Codex
initialization, and read-only commands. Runtime requires Node 18+; no npm install.

## Personal install

Inspect `codex plugin list --json`, `codex plugin marketplace list`, and existing
`vault-*` skill folders in your user/repository skill locations first. Stop if a
`wildlife-ai` Codex marketplace, wildlife-vault plugin, or loose `vault-*` skills
already come from another setup. Choose which installation to retain explicitly;
do not overwrite it or create competing copies. Claude's `wildlife-ai` marketplace
is independent and requires no changes.

Review the generated manifest and confirm there is no `hooks/`, `hooks.json`,
`.mcp.json`, or `.app.json`. Then, for the new generated marketplace:

```sh
codex plugin marketplace add /absolute/path/vault-codex-TESTED_COMMIT
codex plugin add wildlife-vault@wildlife-ai
codex plugin list --marketplace wildlife-ai --json
```

These commands change personal Codex plugin configuration/cache, so an agent must
use the environment's approval mechanism if that location needs extra authority.
They do not initialize or alter any consumer project. Verify the installed
`SOURCE.json` revision and package hashes, and confirm the new `vault-maintain`
skill appears in a fresh task/session's discovery. Installation alone does not
prove that an already running task has loaded the skills. Start a new task; if
missing, refresh/restart Codex and inspect discovery errors.

For an existing documentation project, use `$wildlife-vault:vault-maintain` without running init.
For an explicitly requested new typed vault, `$wildlife-vault:vault-init` selects `--client=codex`
and adds a marker-guarded AGENTS section; it does not modify CLAUDE.md. If the repo
already has a custom vault root, reuse it rather than creating another one.

## Update and rollback

Keep the prior tested package and its installation receipt. Build/test the new
clean commit into a new output directory. Confirm the configured Codex marketplace
is the one installed by this procedure and contains only wildlife-vault. Do not
edit `marketplace.json` or personal `config.toml` by hand to redirect an install.

To switch to the new reviewed package using supported CLI commands:

```sh
codex plugin marketplace remove wildlife-ai
codex plugin marketplace add /absolute/path/new-tested-package
codex plugin add wildlife-vault@wildlife-ai
```

Verify its installed receipt and new-task discovery again. To roll back an update,
repeat those commands with the retained prior package. Removing a marketplace does
not itself undo consumer documentation edits. No build/install/update operation
rewrites consumer history or rolls back user files.

For a first install with no previous version, rollback is:

```sh
codex plugin remove wildlife-vault@wildlife-ai
codex plugin marketplace remove wildlife-ai
```

Keep or archive the generated package until you no longer need its provenance.
Do not remove unrelated skills, marketplaces, or the Claude installation. Changes
to a consumer vault require their own reviewed diff and rollback decision.

## Hook and validation boundaries

Claude's existing hooks remain opt-in through its plugin installation. PreToolUse
can inspect a full Write, while Edit checks occur after mutation. Hook crashes
are fail-open; cross-document checks run only in `--all`. The legacy typed lint
is advisory for dangling links and does not implement the new debt ratchet.

Codex enables no hooks. `vault-lint`, `vault-status`, and the optional maintenance
helper run explicitly. Initialization, mapping, coloring, tag backfill, and default
learning export write files; none belongs in read-only audit mode. The maintenance
helper writes nothing, exits nonzero on invalid policy/runtime errors, and reports
its scope and limitations. It validates document targets, not headings or claim
truth. See [maintenance guidance](../references/maintenance.md) for policy,
classification, and baseline retirement. Project-specific rules take precedence.
