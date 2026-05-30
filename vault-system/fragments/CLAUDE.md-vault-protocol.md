<!-- vault-system:begin -->
## Vault Protocol

`docs/vault/Knowledge/` is the agent-maintained knowledge base for this codebase. Use it:

- **Read first:** before working in a domain, read `docs/vault/Knowledge/_meta/index.md` (the router), then open only the sub-index and node bodies you need. The node `summary` tells you whether to open the body.
- **Capture back:** when you learn something durable (a flow, a data shape, an invariant, a decision), record it as a node with the `vault-author` skill. Every task produces two outputs: the work, and the vault update. An unindexed fact is invisible to the next session.
- **Writes are gated:** the PreToolUse hook blocks malformed vault nodes; fix and retry. Run `/vault-lint` before finishing vault work and `/vault-map` after adding nodes.
- Nodes cite their sources (PRDs, specs, code) via `sources`/`code_refs`; they do not duplicate them.

Schema: `docs/vault/Knowledge/_meta/schema-spec.md`.
<!-- vault-system:end -->
