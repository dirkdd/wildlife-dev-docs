---
name: vault-learnings
description: "Export this project's captured learning nodes as a sanitized, copy-paste digest to feed into the wildlife-vault plugin's /vault-evolve. Use when you want to harvest learnings from this project to evolve the plugin."
allowed-tools: Bash
---
Read [shared runtime and scope](../../references/runtime.md) before acting.

Export the project's proposed learnings as a sanitized digest.

1. Run:
   `node "${VAULT_PLUGIN_ROOT}/scripts/vault/learnings-export.mjs" --project-dir="${VAULT_PROJECT_DIR}"`
   This prints a Markdown digest of every learning node whose `learning_status` is `proposed`, with each node's `In-project evidence` section stripped, and then stamps those nodes `harvested` so they are not re-exported. To preview WITHOUT stamping, add `--dry-run`.

2. If the digest's top banner warns about possible proprietary signals (emails, URLs, paths, proper nouns), review the flagged learnings and edit their generalized text in the source nodes before sharing — then re-run with `--dry-run` to confirm the digest is clean.

3. Copy the printed Markdown block and paste it into a `/vault-evolve` session in the wildlife-vault plugin repo to turn the learnings into concrete plugin-change proposals.

4. After `/vault-evolve` decides, come back and set each source learning node's `learning_status` to `adopted` (and fill `adopted_in: "wildlife-vault@<version>"`) or `rejected`, then run `/vault-map`.
