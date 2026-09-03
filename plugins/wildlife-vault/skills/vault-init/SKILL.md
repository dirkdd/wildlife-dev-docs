---
name: vault-init
description: "Initialize the wildlife-vault knowledge base in this repo — scaffold the empty vault, write its config, and wire CLAUDE.md/AGENTS.md/.gitignore. Use when setting up the vault in a new project, or when asked to install or initialize the vault."
allowed-tools: Bash, Read, Edit
---
Read [shared runtime and scope](../../references/runtime.md) before acting.

For a project with existing documents, read [legacy document guidance](../../references/legacy-documents.md).
Initialization adds a typed graph alongside those sources; it does not migrate them
or decide their canonical ownership. Maintenance alone does not require init.

Initialize the vault in the current repo. This is the one-time setup that replaces the old installer.

1. Use the requested vault name (default `Knowledge`) and select the current client. Inspect existing config before initializing; reuse an existing vault. The vault will live at `docs/vault/<name>/`.

2. Run the initializer (it reads the bundled skeleton from the plugin and writes into this repo):

   `node "${VAULT_PLUGIN_ROOT}/scripts/vault/init.mjs" --project-dir="${VAULT_PROJECT_DIR}" --name=<name> --client=<claude|codex>`

   It is idempotent: it never overwrites existing vault content, and the CLAUDE.md / AGENTS.md / .gitignore additions are marker-guarded.

3. Report what it created: the vault folder, `docs/vault/.vault.json` (the per-project config: `vaultRoot`, `vaultName`, `domains`), the client-specific agent guidance, and the .gitignore Obsidian stanza.

4. For Claude, restart to load its hooks. For Codex, use a new task after plugin installation and verify discovery; initialization itself does not install skills or hooks. Seed only from authorized sources.

5. To rename or relocate the vault later, edit `docs/vault/.vault.json` (and move the folder), then run `/vault-map`.
