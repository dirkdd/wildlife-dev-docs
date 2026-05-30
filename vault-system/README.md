# Vault System

A drop-in, agent-maintained knowledge base for a code project. It gives Claude Code (or any agent) a navigable second brain: a small, typed, validated set of Markdown nodes that the agent reads before touching code and writes back to after learning something durable. Obsidian-compatible, enforced by hooks, generated indexes, zero runtime dependencies (pure Node).

This package is **self-contained and starts empty**. It ships the machinery and an empty vault skeleton, not anyone else's content. The only input you need to seed it is a PRD (see `docs/seed-from-prd.md`).

## What you get

- **A frontmatter contract** every node obeys (`type`, `doc_class`, `summary`, `provenance`, typed `rel_*` relations), enforced by a validator.
- **Enforcement hooks** that block a malformed vault write before it lands and inject a one-line vault pointer at session start.
- **The `vault-author` skill** plus seven operator commands (`/vault-new`, `/vault-lint`, `/vault-map`, `/vault-status`, `/vault-link`, `/vault-colorize`, `/vault-tags`).
- **A three-tier index** (router -> sub-indexes -> bodies) regenerated from frontmatter, so context cost stays flat as the vault grows.
- **An Obsidian graph** colored by document class, with typed relations rendered as native edges.

## Install (60 seconds)

Unzip this folder at your repo root, then from the repo root run:

```
node vault-system/install.mjs
```

The installer copies the machinery, scaffolds an empty `docs/vault/Knowledge/`, merges the hooks and npm scripts and ignore rules, generates the indexes, and verifies the result. Restart Claude Code afterward so the hooks and skills load.

Prefer to do it by hand, or want Claude to do it? Point Claude at `INSTALL.md` — it is an ordered checklist.

## Requirements

- Node 18+ (uses `fs.cpSync`; tested on Node 20). No npm install needed for the vault itself.
- Claude Code (for the skills and hooks). The validator and generators are plain Node and run anywhere.
- Optional: Obsidian 1.4+ to browse the graph.

## Contents

```
vault-system/
  README.md            this file
  INSTALL.md           ordered install checklist + the rename table
  install.mjs          automated installer (idempotent)
  docs/
    STANDARD.md        the full vault standard (read this to understand the system)
    seed-from-prd.md   how to bootstrap an empty vault from just a PRD
  payload/             everything that gets copied into your repo
  fragments/           the snippets the installer merges into existing files
```

## Naming

The vault ships as `docs/vault/Knowledge`. That name lives in exactly one constant (`VAULT_ROOT` in `scripts/vault/schema.mjs`); the display name is derived from it. To rebrand it to your project, see the rename table in `INSTALL.md`. Keeping `Knowledge` is fine.
