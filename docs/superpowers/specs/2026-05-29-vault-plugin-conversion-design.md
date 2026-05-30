# Vault System → Claude Code Plugin (`wildlife-vault`)

**Date:** 2026-05-29
**Status:** Approved design, pending implementation plan
**Author:** dirk@wildlifeai.co

## Summary

Convert the existing installer-based `vault-system/` package into a first-class
Claude Code **plugin** named `wildlife-vault`, distributed through a private
**`wildlife-ai`** marketplace hosted in this repo (`wildlife-dev-docs`). The
plugin ships all machinery (skills, hooks, scripts) in the plugin cache and
scaffolds only the per-project vault *content* into each consuming repo via a new
`/vault-init` command. No `install.mjs`, no `npm run vault:*`, no copying scripts
into user repos.

## Decisions (locked)

1. **Distribution:** Private `wildlife-ai` marketplace (this repo). Fast iteration,
   no external review. Public submission deferred but kept feasible.
2. **Scripts home:** Plugin-only. Hooks and slash commands invoke scripts via
   `${CLAUDE_PLUGIN_ROOT}`. No `scripts/vault/` in user repos, no npm scripts.
   Vault linting works inside Claude Code only.
3. **Per-project config:** A committed `docs/vault/.vault.json` per repo holds
   `vaultRoot` and `vaultName`. Scripts resolve the vault from it (relative to
   `CLAUDE_PROJECT_DIR`) instead of a hardcoded constant.
4. **Plugin name:** `wildlife-vault`; marketplace owner `wildlife-ai`.

## Repository / marketplace layout

```
wildlife-dev-docs/                     # marketplace repo (this repo, becomes a git repo)
  .claude-plugin/
    marketplace.json                   # owner=wildlife-ai, lists the wildlife-vault plugin
  plugins/
    wildlife-vault/                    # the plugin
      .claude-plugin/
        plugin.json                    # name, version, description, author
      hooks/
        hooks.json                     # Pre/PostToolUse + SessionStart via ${CLAUDE_PLUGIN_ROOT}
      skills/
        vault-author/ (+ templates/)
        vault-new/  vault-lint/  vault-map/  vault-status/
        vault-link/ vault-colorize/ vault-tags/
        vault-init/                    # NEW — scaffolds vault content into a repo
      scripts/vault/                   # the ~13 Node modules, adapted (see "Script adaptation")
      skeleton/Knowledge/              # empty vault skeleton copied in by vault-init
      README.md
  vault-system/                        # OLD installer dir — retained during migration, deleted at end
  docs/superpowers/specs/              # this spec
```

Install path for a consumer:

```
/plugin marketplace add wildlife-ai/wildlife-dev-docs
/plugin install wildlife-vault@wildlife-ai
# then, inside a target repo:
/vault-init
```

## What replaces the installer

`install.mjs`, `fragments/`, and the npm-scripts entry point are removed. Their
responsibilities are redistributed:

| Old mechanism | New mechanism |
|---|---|
| Copy `scripts/vault/` into repo | Scripts stay in plugin; run via `${CLAUDE_PLUGIN_ROOT}` |
| Copy `.claude/skills/` into repo | Skills ship inside the plugin |
| Merge hooks into `.claude/settings.json` | Plugin `hooks/hooks.json` (auto-loaded when enabled) |
| `npm run vault:*` | Slash commands (`/vault-lint`, `/vault-map`, …) — already skills |
| Copy empty vault skeleton | `/vault-init` copies `skeleton/Knowledge/` → repo |
| Append Vault Protocol to `CLAUDE.md` | `/vault-init` appends it once, marker-guarded |
| Edit `VAULT_ROOT` to rename | `docs/vault/.vault.json` config file |
| `.gitignore` Obsidian stanza | `/vault-init` appends it once, marker-guarded |

## Per-project config (`.vault.json`)

`/vault-init` writes `docs/vault/.vault.json` (committed):

```json
{ "vaultRoot": "docs/vault/Knowledge", "vaultName": "Knowledge" }
```

Renaming/relocating = run init with a different name, or edit this one file.
`schema.mjs` stops exporting a hardcoded `VAULT_ROOT`; it exposes a
`resolveVault(projectDir)` loader that reads `.vault.json` and returns the
resolved absolute vault root and display name. `_meta` node titles remain
name-neutral so no rename touches generated content.

## Script adaptation (core code change)

Scripts currently assume `cwd == repo root` and a hardcoded `VAULT_ROOT`. They
change to:

- Accept the **project dir**: hooks pass `${CLAUDE_PROJECT_DIR}` as an argument;
  slash-command-invoked scripts use `cwd` / the same arg.
- Resolve the vault by loading `.vault.json` via `resolveVault(projectDir)`
  instead of importing a constant.
- **Fail-safe no-op** when no `.vault.json` exists (repo doesn't use the vault).
  This is mandatory because the plugin's hooks now fire in *every* project, not
  only opted-in ones.

Affected modules (verify exact list during implementation): `schema.mjs`,
`validate.mjs`, `index.mjs`, `vault-index.mjs`, `colorize.mjs`, `status.mjs`,
`session-context.mjs`, `index-drift.mjs`, `link-scan.mjs`, `passes.mjs`,
`parse-frontmatter.mjs`, `marker-region.mjs`, `node-row.mjs`.

## Hook safety (new requirement from going global)

- **PreToolUse / PostToolUse (`Write|Edit`)**: instantly short-circuit (exit 0)
  for any path *outside* the configured `vaultRoot`, and when no vault is
  configured. Only validate writes landing under `vaultRoot`.
- **SessionStart**: emit the vault pointer only if `.vault.json` exists; silent
  otherwise.
- Preserve today's fail-open guarantee: any validator crash exits 0 and lets the
  write through, so a broken hook never wedges editing. New addition:
  "not-my-project → exit 0."

`hooks/hooks.json` mirrors the current three entries but with
`${CLAUDE_PLUGIN_ROOT}/scripts/vault/…` command paths and
`${CLAUDE_PROJECT_DIR}` passed as the project-dir argument.

## Skills vs. commands

Keep all operator actions as **skills** (already written, both model-invocable and
slash-invocable; avoids a rewrite). Only `vault-init` is new. Each skill's prose
is updated to:

- reference `${CLAUDE_PLUGIN_ROOT}/scripts/vault/…` instead of
  `${CLAUDE_PROJECT_DIR}/scripts/vault/…` / repo-relative paths;
- drop hardcoded `docs/vault/Knowledge` in favor of the resolved vault from
  `.vault.json`.

`vault-init` responsibilities (idempotent):
1. Copy `skeleton/Knowledge/` → `docs/vault/<name>/` (never clobber existing content).
2. Write `docs/vault/.vault.json`.
3. Append the Vault Protocol to `CLAUDE.md` and the pointer to `AGENTS.md`
   (marker-guarded, create if missing).
4. Append the Obsidian `.gitignore` stanza (marker-guarded).
5. Stamp `_meta` node dates with today's date.
6. Run map + colorize + lint to verify a clean, indexed vault.

## Migration & testing

- Build the plugin alongside the old `vault-system/` dir; delete `vault-system/`
  only once the plugin is verified end to end.
- Initialize this repo as a git repo (required for marketplace hosting).
- **Test plan** (throwaway consumer repo):
  1. `/plugin marketplace add` (local path) + `/plugin install wildlife-vault`.
  2. `/vault-init` → vault scaffolded, `.vault.json` + CLAUDE.md + .gitignore updated.
  3. `/vault-new` → node created; PreToolUse validation fires; malformed node blocked.
  4. Write a non-vault file → hooks no-op (exit 0), write succeeds.
  5. `/vault-map`, `/vault-lint` (0 hard), `/vault-colorize` all work.
  6. New session → SessionStart injects the pointer.
  7. Second repo with **no** vault → hooks and SessionStart stay silent.

## Out of scope (YAGNI)

- Public marketplace submission / review polish.
- CI/agent-agnostic linting outside Claude Code (explicitly dropped with the
  plugin-only decision).
- Auto-discovery of the vault (rejected in favor of explicit `.vault.json`).
- Converting operator skills into separate `commands/*.md` definitions.
```
