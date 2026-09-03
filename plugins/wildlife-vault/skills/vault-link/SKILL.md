---
name: vault-link
description: "Find unlinked mentions of known vault node titles and aliases in docs/vault/Knowledge, then insert quoted wikilinks interactively. Use when asked to cross-link the vault, add missing wikilinks, or run the link scanner."
allowed-tools: Bash, Read, Edit
---
Read [shared runtime and scope](../../references/runtime.md) before acting.

Run `node "${VAULT_PLUGIN_ROOT}/scripts/vault/link-scan.mjs" --project-dir="${VAULT_PROJECT_DIR}"`. It scans every node body for mentions of known node titles and aliases that are not yet wikilinked, and prints candidates as `<source-node> -> [[target-node]] (matched: "<text>")` lines.

For each candidate, show the surrounding sentence for context and ask whether to insert the link. When the user confirms:
- If the mention should become a body wikilink, replace the bare text with `[[target-id|matched text]]` in the body.
- If the mention should instead appear as a frontmatter relation, add `- "[[target-id]]"` to the appropriate `rel_*` list (prefer `rel_related` when the relation type is ambiguous).

Do not insert links in bulk without per-candidate confirmation. The scan is non-destructive; nothing changes until the user approves each insertion.

## The other half: links that point nowhere

The scan above finds text that should be a link. The reverse audit finds links that resolve to nothing:

```
node "${VAULT_PLUGIN_ROOT}/scripts/vault/link-scan.mjs" --dangling --project-dir="${VAULT_PROJECT_DIR}"
```

It reports each unresolved `[[target]]` once, grouped by target, with the reference count, the files it appears in, and a near-miss suggestion when one exists. Links are written wherever docs are written, not only inside the vault, so point the audit at the whole documentation tree: add `linkRoots` (paths, relative to the repo root) to `docs/vault/.vault.json`. Left unset it scans the vault root only, so an existing install sees no change until it opts in. Add `linkIgnorePrefixes` for link families that are deliberately external.

Adjudicate by target, not by occurrence: one alias added to the intended node can fix ten references at once. Suggestions are candidates, not proof. A missing target may be historical, external, or intentional; classify it before proposing a change. Never create a placeholder just to quiet the checker.

After all insertions, run `/vault-lint` to confirm no malformed relations were introduced.

For Markdown links, ambiguous aliases, registered external assets, or debt ratchets, use `vault-maintain`. Prefer the project checker when one already defines these conventions.
