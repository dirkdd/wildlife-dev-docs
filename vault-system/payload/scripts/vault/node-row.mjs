// scripts/vault/node-row.mjs
export function linkId(raw) {
  const m = String(raw).match(/\[\[([^\]]+)\]\]/);
  return m ? m[1].split("|")[0].trim() : String(raw).trim();
}

export function domainsOf(node) {
  return (node.tags || [])
    .filter((t) => String(t).startsWith("domain/"))
    .map((t) => String(t).slice("domain/".length));
}

function cell(v) {
  return String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function nodeRow(node) {
  const deps = (node.rel_depends_on || []).map(linkId).join(", ");
  const tags = (node.tags || []).join(" ");
  return `| [[${node.id}]] | ${cell(node.type)} | ${cell(node.doc_class)} | ${cell(node.status)} | ${cell(node.summary)} | ${cell(tags)} | ${cell(deps)} |`;
}

export const TABLE_HEADER =
  "| id | type | doc_class | status | summary | tags | rel_depends_on |\n" +
  "|----|------|-----------|--------|---------|------|----------------|";
