// scripts/vault/schema.mjs
// Single source of truth for the vault frontmatter contract.

// The vault location. This is the ONLY place the path is defined; everything
// imports it. To rename the vault for your project, change this one line
// (e.g. "docs/vault/Acme") and run the INSTALL find/replace for the skill prose.
export const VAULT_ROOT = "docs/vault/Knowledge";

// Display name, derived from the path's last segment ("Knowledge"). Used in
// generated titles and the SessionStart blurb, so renaming VAULT_ROOT renames
// the display name too.
export const VAULT_NAME = VAULT_ROOT.split("/").pop();

export const ROUTER_TOKEN_BUDGET = 1200;

export const TYPES = [
  "concept", "module", "flow", "data", "invariant",
  "decision", "runbook", "guide", "reference", "moc",
];

export const DOC_CLASSES = [
  "prd", "design", "spec", "plan", "kickoff", "adr",
  "analysis", "user-journey", "runbook", "guide", "knowledge", "reference",
];

export const STATUSES = ["draft", "canonical", "stale", "deprecated"];
export const PROVENANCES = ["verified", "extracted", "inferred", "ambiguous"];
export const DIATAXIS = ["tutorial", "how-to", "reference", "explanation"];

export const REQUIRED_FIELDS = [
  "id", "title", "type", "doc_class", "summary", "status", "provenance", "tags", "updated",
];

export const REL_KEYS = [
  "rel_documents", "rel_depends_on", "rel_governed_by", "rel_decided_in",
  "rel_part_of", "rel_related", "rel_supersedes", "rel_superseded_by",
];

// Relations only valid on decision nodes.
export const DECISION_ONLY_RELS = ["rel_supersedes", "rel_superseded_by"];

// Tag namespaces governed by _meta/taxonomy.md.
export const TAG_NAMESPACES = ["domain", "audience", "area", "class"];

// Domain whitelist. EMPTY on a fresh install: populate it with your project's
// feature domains as you derive them from the PRD (see docs/seed-from-prd.md),
// then run /vault-map to materialize a sub-index per domain. A domain/* tag
// whose slug is not listed here is a soft warning, never a block.
// Example (delete and replace with your own):
//   export const DOMAIN_WHITELIST = ["billing", "auth", "search", "infra"];
export const DOMAIN_WHITELIST = [];

// type -> folder (relative to VAULT_ROOT). reference/moc live in _meta.
export const CATEGORY_DIRS = {
  concept: "concepts",
  module: "modules",
  flow: "flows",
  data: "data",
  invariant: "invariants",
  decision: "decisions",
  runbook: "runbooks",
  guide: "guides",
  reference: "_meta",
  moc: "_meta",
};

// Stable ordering for generated indexes; "other" absorbs unregistered types.
export const CATEGORY_ORDER = [
  "moc", "concept", "module", "flow", "data", "invariant",
  "decision", "runbook", "guide", "reference", "other",
];

// Forced type -> doc_class consistency. Types absent here vary independently.
export const TYPE_DOC_CLASS = {
  decision: "adr",
  runbook: "runbook",
  moc: "reference",
};

// Inverse labels for derivation/export only; never stored in frontmatter.
export const INVERSE_RELS = {
  rel_documents: "documented_by",
  rel_depends_on: "required_by",
  rel_governed_by: "governs",
  rel_decided_in: "decides",
  rel_part_of: "contains",
  rel_related: "related",
  rel_supersedes: "superseded_by",
  rel_superseded_by: "supersedes",
};

// Required decision-node body headings (MADR). Enforced by pass1 for type=decision.
export const DECISION_REQUIRED_SECTIONS = [
  "Context and Problem Statement",
  "Considered Options",
  "Decision Outcome",
];

// Diataxis soft cross-check vs type (used by pass3 soft-warn).
export const DIATAXIS_BY_TYPE = {
  runbook: ["how-to"],
  concept: ["explanation"],
  data: ["reference"],
  reference: ["reference"],
  guide: ["how-to", "explanation"],
};

// Index family declarations consumed by index.mjs.
export const INDEX_FAMILIES = [
  { name: "by-type", groupBy: "type" },
  { name: "by-domain", groupBy: "domain" },
];

// Staleness threshold for the `updated` soft-warn (days).
export const STALE_AFTER_DAYS = 120;
