---
name: vault-new
description: "Scaffold a new vault node of a given type and title with prefilled frontmatter, then author the body. Use when asked to create a new vault node, document a concept, module, flow, data shape, invariant, decision, runbook, or guide."
allowed-tools: Read, Write, Edit, Bash
arguments: [type, title]
---
Read [shared runtime and scope](../../references/runtime.md) before acting.

Scaffold and author a new vault node. Steps:

1. Confirm the request is for a typed vault node. For a PRD, specification, register,
   existing ADR, or another source artifact, follow [legacy document guidance](../../references/legacy-documents.md)
   and preserve its project format. If a distilled node is wanted, choose its type
   from `concept | module | flow | data | invariant | decision | runbook | guide`
   according to the knowledge being documented.

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

4. Read `${VAULT_PLUGIN_ROOT}/skills/vault-author/templates/<type>.md` to get the skeleton.

5. Fill the frontmatter placeholders:
   - `id`: derived kebab id
   - `title`: the provided title
   - `summary`: ask if not obvious; this is what the index shows and what other sessions read first
   - `type`: from argument
   - `doc_class`: suggest a sensible default (concept/flow/data/invariant -> `knowledge` or `design`; decision -> `adr`; runbook -> `runbook`; guide -> `guide`)
   - `status: draft`
   - `provenance: inferred`
   - `tags`: prompt for at least one `domain/*` tag, and always include the mirror tag `class/<doc_class>` matching the node's `doc_class` (the Obsidian graph colors by this tag)
   - `updated`: today's date (ISO)

6. Write the scaffolded file. Validate the written node explicitly in Codex; fix any reported errors.

7. Hand off to the `vault-author` skill to author the body sections.

8. After the body is written, run `/vault-map` so the new node appears in the indexes.
