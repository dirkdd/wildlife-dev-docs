---
name: vault-new
description: Scaffold a new vault node of a given type and title with prefilled frontmatter, then author the body. Use when asked to create a new vault node, document a concept, module, flow, data shape, invariant, decision, runbook, or guide.
allowed-tools: Read, Write, Edit, Bash
arguments: [type, title]
---
Scaffold and author a new vault node. Steps:

1. Confirm `type` is one of: `concept | module | flow | data | invariant | decision | runbook | guide`. If the user provided a different value, suggest the closest match.

2. Derive the target folder from `CATEGORY_DIRS` (in the plugin's `scripts/vault/schema.mjs`):
   - concept -> `docs/vault/Knowledge/concepts/`
   - module -> `docs/vault/Knowledge/modules/`
   - flow -> `docs/vault/Knowledge/flows/`
   - data -> `docs/vault/Knowledge/data/`
   - invariant -> `docs/vault/Knowledge/invariants/`
   - decision -> `docs/vault/Knowledge/decisions/`
   - runbook -> `docs/vault/Knowledge/runbooks/`
   - guide -> `docs/vault/Knowledge/guides/`
   (If this repo's `docs/vault/.vault.json` sets a different `vaultRoot`, use that root in place of `docs/vault/Knowledge`.)

3. Derive the `id`: kebab-case the title (lowercase, spaces to hyphens, strip punctuation). The filename is `<id>.md`.

4. Read `${CLAUDE_PLUGIN_ROOT}/skills/vault-author/templates/<type>.md` to get the skeleton.

5. Fill the frontmatter placeholders:
   - `id`: derived kebab id
   - `title`: the provided title
   - `summary`: ask if not obvious; this is what the index shows and what other sessions read first
   - `type`: from argument
   - `doc_class`: suggest a sensible default (concept/flow/data/invariant -> `knowledge` or `design`; decision -> `adr`; runbook -> `runbook`; guide -> `guide`)
   - `status: draft`
   - `provenance: inferred`
   - `tags`: prompt for at least one `domain/*` tag
   - `updated`: today's date (ISO)

6. Write the scaffolded file. The PreToolUse hook validates it; fix any rejection before proceeding.

7. Hand off to the `vault-author` skill to author the body sections.

8. After the body is written, run `/vault-map` so the new node appears in the indexes.
