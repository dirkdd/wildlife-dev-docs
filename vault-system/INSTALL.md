# Install

Two ways: the script, or by hand. Both end the same way. The target is your repo root (the directory with your `package.json` / `.git`).

## Option 1: the script

From your repo root:

```
node vault-system/install.mjs
```

It is idempotent (safe to re-run) and does all of the steps below. Skip to **Verify** and **After install**.

## Option 2: by hand (or have Claude follow this)

Do these in order. Paths are relative to the repo root.

1. **Copy the machinery.**
   - `vault-system/payload/scripts/vault/`  ->  `scripts/vault/`
   - `vault-system/payload/.claude/skills/`  ->  `.claude/skills/`  (8 skill folders, merge alongside any existing skills)

2. **Copy the empty vault skeleton** (only if `docs/vault/Knowledge/` does not already exist):
   - `vault-system/payload/docs/vault/Knowledge/`  ->  `docs/vault/Knowledge/`

3. **Merge the hooks** from `vault-system/fragments/settings.hooks.json` into `.claude/settings.json`. If that file does not exist, use the fragment as-is (rename it to `.claude/settings.json`). If it does exist, add the three hook entries (`PreToolUse`, `PostToolUse`, `SessionStart`) into the matching arrays. Do not duplicate an entry that is already there.

4. **Merge the npm scripts** from `vault-system/fragments/package.scripts.json` into the `"scripts"` block of your `package.json` (`vault:lint`, `vault:map`, `vault:colorize`, `vault:status`).

5. **Append the ignore stanza** in `vault-system/fragments/gitignore-stanza.txt` to your `.gitignore` (once).

6. **Append the Vault Protocol** in `vault-system/fragments/CLAUDE.md-vault-protocol.md` to your `CLAUDE.md`, and `vault-system/fragments/AGENTS.md-pointer.md` to your `AGENTS.md` (create either file if missing). The fragments are wrapped in `<!-- vault-system:begin/end -->` markers; do not add them twice.

7. **Generate and verify:**
   ```
   npm run vault:map        # builds the router, sub-indexes, schema mirror
   npm run vault:colorize   # writes the Obsidian graph colors
   npm run vault:lint       # must report 0 hard violations
   ```

## Verify

A clean install ends with `npm run vault:lint` printing `0 hard` (soft warnings are fine). The router exists at `docs/vault/Knowledge/_meta/index.md`. In Claude Code, `/vault-new`, `/vault-lint`, etc. are available after a restart.

## After install

- **Restart Claude Code** so the SessionStart hook and the `vault-*` skills load.
- **Seed the vault from your PRD:** open `vault-system/docs/seed-from-prd.md` and follow it, or tell Claude `seed the vault from <path-to-PRD>`.
- **Read the standard:** `vault-system/docs/STANDARD.md` is the full contract and the authoring rules.

## Renaming the vault (optional)

The vault is named `Knowledge`. To rebrand it to, say, `Acme`:

1. **One constant:** in `scripts/vault/schema.mjs`, set `export const VAULT_ROOT = "docs/vault/Acme";`. Every script reads this, and the display name (`VAULT_NAME`) is derived from it automatically.
2. **Rename the folder:** `docs/vault/Knowledge/`  ->  `docs/vault/Acme/`.
3. **Find/replace** the literal path string `docs/vault/Knowledge` with `docs/vault/Acme` in these files:

   | File(s) | What references the path |
   |---|---|
   | `.claude/skills/vault-*/SKILL.md` and `.claude/skills/vault-author/SKILL.md` | the `paths:` frontmatter and prose folder examples |
   | `.gitignore` | the Obsidian whitelist stanza |
   | `CLAUDE.md`, `AGENTS.md` | the Vault Protocol section |

4. **Regenerate:** `npm run vault:map`.

The `_meta` node titles are deliberately name-neutral ("Vault: Router", etc.), so you do not need to touch them. Doing the rename in `vault-system/payload/` *before* running the installer works too.

## Troubleshooting

- **A vault write was blocked.** That is the PreToolUse hook catching a malformed node. The stderr message names the violation; fix the frontmatter and retry. The contract is in `docs/vault/Knowledge/_meta/schema-spec.md`.
- **`vault:lint` reports index drift.** Run `npm run vault:map`, then lint again. Drift means a node is not yet in the generated index.
- **Hooks not firing on Windows.** The hooks call `node` via the exec form, which avoids `.cmd` shim issues. Confirm `node` resolves in the shell Claude Code launched. The validator fails safe: if it ever crashes it exits 0 and lets the write through, so a broken hook never wedges your editing. Fall back to `npm run vault:lint` manually.
