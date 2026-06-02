# wildlife-dev-docs

Public Claude Code marketplace (`wildlife-ai`) hosting the **wildlife-vault** plugin — an agent-maintained, Obsidian-compatible knowledge vault for code projects.

## Use it

Inside a Claude Code session (slash commands):

```
/plugin marketplace add dirkdd/wildlife-dev-docs
/plugin install wildlife-vault@wildlife-ai
```

Or from the terminal (Claude Code CLI — scriptable, e.g. for a remote project):

```bash
claude plugin marketplace add dirkdd/wildlife-dev-docs
claude plugin install wildlife-vault@wildlife-ai
```

> The marketplace is hosted at `dirkdd/wildlife-dev-docs`. The `@wildlife-ai`
> suffix is the marketplace's internal name, not the GitHub owner.
>
> wildlife-vault ships skills and hooks, not an MCP server, so it installs as a
> plugin (above) — there is no `claude mcp add` command for it.

The plugin lives in [`plugins/wildlife-vault/`](plugins/wildlife-vault/). See its README for usage. Design and implementation history are under `docs/superpowers/`.
