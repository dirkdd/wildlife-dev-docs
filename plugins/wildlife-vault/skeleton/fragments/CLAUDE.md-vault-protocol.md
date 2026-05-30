<!-- vault-system:begin -->
## Vault Protocol

`docs/vault/Knowledge/` is the agent-maintained knowledge base for this codebase. Use it:

- **Read first:** before working in a domain, read `docs/vault/Knowledge/_meta/index.md` (the router), then open only the sub-index and node bodies you need. The node `summary` tells you whether to open the body.
- **Capture back:** when you learn something durable (a flow, a data shape, an invariant, a decision), record it as a node with the `vault-author` skill. Every task produces two outputs: the work, and the vault update. An unindexed fact is invisible to the next session.
- **Capture learnings:** when you discover something generalizable about *how* to build or document (a reusable technique, a recurring shape the node types don't fit, a taxonomy gap, a validation idea, a workflow/graph-traversal breakthrough), record it with `/vault-learn` as a quarantined learning node — kept separate from project knowledge and later harvested to improve the tooling. A generalizable insight left uncaptured is lost.
- **Writes are gated:** the PreToolUse hook blocks malformed vault nodes; fix and retry. Run `/vault-lint` before finishing vault work and `/vault-map` after adding nodes.
- Nodes cite their sources (PRDs, specs, code) via `sources`/`code_refs`; they do not duplicate them.

Schema: `docs/vault/Knowledge/_meta/schema-spec.md`.
<!-- vault-system:end -->
