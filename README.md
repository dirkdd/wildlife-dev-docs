# wildlife-dev-docs

Public Claude Code marketplace (`wildlife-ai`) hosting the **wildlife-vault** and **usage-guard** plugins. wildlife-vault is an agent-maintained, Obsidian-compatible knowledge vault for code projects. usage-guard holds long-running sessions at the edge of their rolling 5-hour usage window instead of letting them run it out.

## Use it

Inside a Claude Code session (slash commands):

```
/plugin marketplace add dirkdd/wildlife-dev-docs
/plugin install wildlife-vault@wildlife-ai
```

```
/plugin marketplace add dirkdd/wildlife-dev-docs
/plugin install usage-guard@wildlife-ai
```

Or from the terminal (Claude Code CLI — scriptable, e.g. for a remote project):

```bash
claude plugin marketplace add dirkdd/wildlife-dev-docs
claude plugin install wildlife-vault@wildlife-ai
```

```bash
claude plugin marketplace add dirkdd/wildlife-dev-docs
claude plugin install usage-guard@wildlife-ai
```

> The marketplace is hosted at `dirkdd/wildlife-dev-docs`. The `@wildlife-ai`
> suffix is the marketplace's internal name, not the GitHub owner.
>
> Both plugins ship skills and hooks, not an MCP server, so they install as
> plugins (above) — there is no `claude mcp add` command for either.

The plugins live in [`plugins/wildlife-vault/`](plugins/wildlife-vault/) and [`plugins/usage-guard/`](plugins/usage-guard/). See each plugin's README for usage. Design and implementation history are under `docs/superpowers/`.
