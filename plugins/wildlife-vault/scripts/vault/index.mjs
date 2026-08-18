// scripts/vault/index.mjs
import * as fs from "node:fs";
import * as path from "node:path";
import {
  TYPES, DOC_CLASSES, STATUSES, PROVENANCES, CATEGORY_ORDER,
  CATEGORY_DIRS, REL_KEYS,
} from "./schema.mjs";
import { resolveVault } from "./config.mjs";
import { buildVaultIndex } from "./vault-index.mjs";
import { replaceMarkedRegion } from "./marker-region.mjs";
import { nodeRow, domainsOf, TABLE_HEADER } from "./node-row.mjs";

function bySection(nodes, keyFn) {
  const map = new Map();
  for (const n of nodes) {
    const k = keyFn(n);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(n);
  }
  for (const arr of map.values()) arr.sort((a, b) => a.id.localeCompare(b.id));
  return map;
}

export function renderByType(nodes) {
  const map = bySection(nodes, (n) => (TYPES.includes(n.type) ? n.type : "other"));
  const out = [];
  for (const type of CATEGORY_ORDER) {
    const arr = map.get(type);
    if (!arr || arr.length === 0) continue;
    out.push(`## ${type} (${arr.length})`, "", TABLE_HEADER, ...arr.map(nodeRow), "");
  }
  return out.join("\n").trim();
}

export function renderDomainCoverage(domain, allNodes) {
  const nodes = allNodes.filter((n) => domainsOf(n).includes(domain));
  const map = bySection(nodes, (n) => (TYPES.includes(n.type) ? n.type : "other"));
  const out = [];
  for (const type of CATEGORY_ORDER) {
    const arr = map.get(type);
    if (!arr || arr.length === 0) continue;
    out.push(`### ${type}`, "", TABLE_HEADER, ...arr.map(nodeRow), "");
  }
  return out.join("\n").trim() || "_No nodes in this domain yet._";
}

// Every entry in TYPES needs a role here AND a CATEGORY_DIRS folder, or the
// router row renders `undefined`. Guarded by test/learning-type.test.mjs.
const TYPE_ROLE = {
  concept: "domain or technical concept",
  module: "a code surface or feature area",
  flow: "an end-to-end process across modules",
  data: "a data-shape contract",
  invariant: "a rule that must hold + its failure mode",
  decision: "an ADR (MADR)",
  runbook: "an operational procedure",
  guide: "a how-to or explanation",
  reference: "a pointer or schema doc",
  moc: "a map of content (index)",
  learning: "a generalizable insight captured to evolve the plugin",
};

export function renderRouterCatalog(nodes, subIndexIds) {
  const counts = new Map();
  for (const n of nodes) counts.set(n.type, (counts.get(n.type) || 0) + 1);
  const typeRows = TYPES.map((t) =>
    `| ${t} | ${CATEGORY_DIRS[t]}/ | ${TYPE_ROLE[t]} | ${counts.get(t) || 0} |`);
  const subIndexLines = subIndexIds.map((id) => `- [[${id}]]`);
  return [
    "### Node types", "",
    "| type | folder | role | count |",
    "|------|--------|------|-------|",
    ...typeRows, "",
    "### Sub-indexes (open only the one you need)", "",
    ...subIndexLines,
  ].join("\n");
}

export function renderSchemaMirror() {
  return [
    `- **type**: ${TYPES.join(" | ")}`,
    `- **doc_class**: ${DOC_CLASSES.join(" | ")}`,
    `- **status**: ${STATUSES.join(" | ")}`,
    `- **provenance**: ${PROVENANCES.join(" | ")}`,
    `- **relations (flat, quoted wikilinks)**: ${REL_KEYS.join(", ")}`,
    "",
    "Full contract: see [[schema-spec]].",
  ].join("\n");
}

function writeMarked(filePath, generated) {
  const content = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n");
  fs.writeFileSync(filePath, replaceMarkedRegion(content, generated), "utf-8");
}

const DOMAIN_TEMPLATE = (slug, vaultName) => `---
id: index-domain-${slug}
title: "${vaultName} Vault — ${slug} domain"
type: moc
doc_class: reference
summary: "Map of Content for the ${slug} domain. Curated anchors + generated coverage."
status: draft
provenance: extracted
tags: ["area/meta", "domain/${slug}", "class/reference"]
updated: ${new Date().toISOString().slice(0, 10)}
rel_part_of:
  - "[[index]]"
---
# ${slug} domain

## Canonical anchors
<!-- Hand-curated: the 3-5 entry nodes for this domain. Edit freely; not overwritten. -->

## Coverage
<!-- vault-map:begin -->
<!-- vault-map:end -->
`;

export function main() {
  const vault = resolveVault();
  if (!vault) return; // no vault configured -> no-op
  const meta = path.join(vault.vaultRoot, "_meta");

  // First scan: existing nodes.
  let nodes = buildVaultIndex(vault.vaultRoot).nodes.map((n) => n.data);

  // Create any missing per-domain sub-index files BEFORE rendering index-by-type,
  // so the new moc nodes are visible to the re-scan below (single-pass idempotency:
  // otherwise index-by-type omits them and /vault-lint reports index-drift).
  const initialDomains = new Set();
  for (const n of nodes) for (const d of domainsOf(n)) initialDomains.add(d);
  for (const slug of [...initialDomains].sort()) {
    const file = path.join(meta, `index-domain-${slug}.md`);
    if (!fs.existsSync(file)) fs.writeFileSync(file, DOMAIN_TEMPLATE(slug, vault.vaultName), "utf-8");
  }

  // Re-scan so freshly created index-domain-* moc nodes are part of the node set.
  nodes = buildVaultIndex(vault.vaultRoot).nodes.map((n) => n.data);

  // index-by-type (now includes the moc domain nodes)
  writeMarked(path.join(meta, "index-by-type.md"), renderByType(nodes));

  // per-domain sub-indexes: write coverage + collect ids
  const populated = new Set();
  for (const n of nodes) for (const d of domainsOf(n)) populated.add(d);
  const subIndexIds = ["index-by-type"];
  for (const slug of [...populated].sort()) {
    const file = path.join(meta, `index-domain-${slug}.md`);
    if (!fs.existsSync(file)) fs.writeFileSync(file, DOMAIN_TEMPLATE(slug, vault.vaultName), "utf-8");
    writeMarked(file, renderDomainCoverage(slug, nodes));
    subIndexIds.push(`index-domain-${slug}`);
  }

  // router + schema mirror
  writeMarked(path.join(meta, "index.md"), renderRouterCatalog(nodes, subIndexIds));
  writeMarked(path.join(meta, "schema.md"), renderSchemaMirror());

  process.stderr.write(`vault:map — ${nodes.length} nodes, ${populated.size} domains, ${subIndexIds.length} sub-indexes\n`);
}

// Windows-safe CLI guard: new URL(import.meta.url).pathname yields /C:/... on Windows,
// so path.resolve comparison may fail. Fall back to argv endsWith check.
const isMain = (() => {
  try {
    return path.resolve(process.argv[1] || "") === path.resolve(new URL(import.meta.url).pathname);
  } catch {
    return false;
  }
})() || (process.argv[1] != null &&
  (process.argv[1].endsWith("/index.mjs") || process.argv[1].endsWith(`${path.sep}index.mjs`)));

if (isMain) {
  main();
}
