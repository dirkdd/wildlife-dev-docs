# wildlife-vault

A drop-in, agent-maintained knowledge base for a code project, packaged as a Claude Code plugin. It gives Claude a navigable second brain: a small, typed, validated set of Markdown nodes it reads before touching code and writes back to after learning something durable. Obsidian-compatible, enforced by hooks, generated indexes, zero runtime dependencies (pure Node).

## Install

```
/plugin marketplace add wildlife-ai/wildlife-dev-docs
/plugin install wildlife-vault@wildlife-ai
```

Then, inside any repo where you want a vault:

```
/vault-init
```

Restart Claude Code so the SessionStart hook and `vault-*` skills load.

## What you get

- A frontmatter contract every node obeys, enforced by a validator hook.
- Pre/PostToolUse hooks that block malformed vault writes; a SessionStart hook that injects a vault pointer.
- The `vault-author` skill plus operator skills: `/vault-init`, `/vault-new`, `/vault-lint`, `/vault-map`, `/vault-status`, `/vault-link`, `/vault-colorize`, `/vault-tags`.
- A three-tier generated index and an Obsidian graph colored by document class.

## Per-project config

`/vault-init` writes `docs/vault/.vault.json` holding `vaultRoot`, `vaultName`, and `domains`. Edit it (and move the folder) to rename or relocate the vault, then run `/vault-map`.

## Requirements

- Node 18+ (uses `fs.cpSync`).
- Claude Code (for skills and hooks).
- Optional: Obsidian 1.4+ to browse the graph.
