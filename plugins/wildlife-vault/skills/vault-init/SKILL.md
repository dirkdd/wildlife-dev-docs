---
name: vault-init
description: Initialize the wildlife-vault knowledge base in this repo — scaffold the empty vault, write its config, and wire CLAUDE.md/AGENTS.md/.gitignore. Use when setting up the vault in a new project, or when asked to install or initialize the vault.
allowed-tools: Bash, Read, Edit
---
Initialize the vault in the current repo. This is the one-time setup that replaces the old installer.

1. Decide the vault name with the user (default `Knowledge`). The vault will live at `docs/vault/<name>/`.

2. Run the initializer (it reads the bundled skeleton from the plugin and writes into this repo):

   `node "${CLAUDE_PLUGIN_ROOT}/scripts/vault/init.mjs" --project-dir="${CLAUDE_PROJECT_DIR}" --name=<name>`

   It is idempotent: it never overwrites existing vault content, and the CLAUDE.md / AGENTS.md / .gitignore additions are marker-guarded.

3. Report what it created: the vault folder, `docs/vault/.vault.json` (the per-project config: `vaultRoot`, `vaultName`, `domains`), the CLAUDE.md Vault Protocol section, and the .gitignore Obsidian stanza.

4. Tell the user to **restart Claude Code** so the SessionStart hook picks up the new vault, then to seed it from their PRD (`seed the vault from <path>`), and that `/vault-new`, `/vault-lint`, `/vault-map`, `/vault-status`, `/vault-link`, `/vault-colorize`, `/vault-tags` are now available.

5. To rename or relocate the vault later, edit `docs/vault/.vault.json` (and move the folder), then run `/vault-map`.
