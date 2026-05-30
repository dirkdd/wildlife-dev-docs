// scripts/vault/schema.mjs
// Single source of truth for the vault frontmatter contract.

// The vault location and display name are NO LONGER constants here. They are
// per-project and resolved at runtime from docs/vault/.vault.json by
// scripts/vault/config.mjs (resolveVault). This file holds only the
// project-independent frontmatter contract.

export const ROUTER_TOKEN_BUDGET = 1200;

export const TYPES = [
  "concept", "module", "flow", "data", "invariant",
  "decision", "runbook", "guide", "reference", "moc", "learning",
];

export const DOC_CLASSES = [
  "prd", "design", "spec", "plan", "kickoff", "adr",
  "analysis", "user-journey", "runbook", "guide", "knowledge", "reference", "learning",
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

// Default domain whitelist (empty). Per-project domains come from
// docs/vault/.vault.json ("domains": [...]); this constant is the fallback.
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
  learning: "_meta",
};

// Stable ordering for generated indexes; "other" absorbs unregistered types.
export const CATEGORY_ORDER = [
  "moc", "concept", "module", "flow", "data", "invariant",
  "decision", "runbook", "guide", "learning", "reference", "other",
];

// Forced type -> doc_class consistency. Types absent here vary independently.
export const TYPE_DOC_CLASS = {
  decision: "adr",
  runbook: "runbook",
  moc: "reference",
  learning: "learning",
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
