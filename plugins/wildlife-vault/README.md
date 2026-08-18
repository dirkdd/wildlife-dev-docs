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
- Pre/PostToolUse hooks that block malformed vault writes; a SessionStart hook that injects a vault pointer; a non-blocking SessionEnd hook that nudges learning capture.
- Operator skills: `/vault-init`, `/vault-new`, `/vault-lint`, `/vault-map`, `/vault-status`, `/vault-link`, `/vault-colorize`, `/vault-tags`, plus the `vault-author` skill.
- A self-learning loop: `/vault-learn` (capture), `/vault-learnings` (sanitized export), and `/vault-evolve` (turn harvested learnings into proposed plugin upgrades).
- A three-tier generated index and an Obsidian graph colored by document class via `class/<doc_class>` tags.

## Per-project config

`/vault-init` writes `docs/vault/.vault.json` holding `vaultRoot`, `vaultName`, and `domains`. Edit it (and move the folder) to rename or relocate the vault, then run `/vault-map`.

## Documentation

- [`docs/STANDARD.md`](docs/STANDARD.md) — the full vault standard: node types, the frontmatter contract, relations, the index system, and enforcement.
- [`docs/seed-from-prd.md`](docs/seed-from-prd.md) — how to bootstrap a vault from a PRD or design brief, including the parallel-seeding protocol.
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — what changed in each release.

## Requirements

- Node 18+ (uses `fs.cpSync`).
- Claude Code (for skills and hooks).
- Optional: Obsidian 1.4+ to browse the graph.
