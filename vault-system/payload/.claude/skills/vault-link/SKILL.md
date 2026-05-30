---
name: vault-link
description: Find unlinked mentions of known vault node titles and aliases in docs/vault/Knowledge, then insert quoted wikilinks interactively. Use when asked to cross-link the vault, add missing wikilinks, or run the link scanner.
allowed-tools: Bash, Read, Edit
---
Run `node scripts/vault/link-scan.mjs` from the repo root. It scans every node body for mentions of known node titles and aliases that are not yet wikilinked, and prints candidates as `<source-node> -> [[target-node]] (matched: "<text>")` lines.

For each candidate, show the surrounding sentence for context and ask whether to insert the link. When the user confirms:
- If the mention should become a body wikilink, replace the bare text with `[[target-id|matched text]]` in the body.
- If the mention should instead appear as a frontmatter relation, add `- "[[target-id]]"` to the appropriate `rel_*` list (prefer `rel_related` when the relation type is ambiguous).

Do not insert links in bulk without per-candidate confirmation. The scan is non-destructive; nothing changes until the user approves each insertion.

After all insertions, run `/vault-lint` to confirm no malformed relations were introduced.
