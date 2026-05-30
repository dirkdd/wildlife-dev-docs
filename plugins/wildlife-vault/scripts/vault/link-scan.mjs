// scripts/vault/link-scan.mjs
import * as fs from "node:fs";
import * as path from "node:path";
import { buildVaultIndex } from "./vault-index.mjs";
import { parseFrontmatter } from "./parse-frontmatter.mjs";

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export function findUnlinkedMentions(body, knownNodes, selfId) {
  const hits = [];
  for (const node of knownNodes) {
    if (node.id === selfId) continue;
    const names = [node.title, ...(node.aliases || [])].filter(Boolean);
    for (const name of names) {
      const mention = new RegExp(`(?<!\\[\\[)\\b${escapeRe(name)}\\b(?!\\]\\])`, "i");
      const alreadyLinked = new RegExp(`\\[\\[${escapeRe(node.id)}(\\|[^\\]]*)?\\]\\]`);
      if (mention.test(body) && !alreadyLinked.test(body)) {
        hits.push({ id: node.id, matched: name });
        break;
      }
    }
  }
  return hits;
}

export function main() {
  // buildVaultIndex returns { byId, nodes: [{ filePath, data }] }; map to bare data objects.
  const { nodes: rawNodes } = buildVaultIndex();
  const knownNodes = rawNodes.map((n) => n.data).filter((d) => d.id && d.title);
  let totalHits = 0;
  for (const { filePath, data } of rawNodes) {
    if (!data.id) continue;
    let content;
    try { content = fs.readFileSync(filePath, "utf-8"); } catch { continue; }
    const parsed = parseFrontmatter(content);
    const body = parsed.ok ? parsed.body : content;
    const hits = findUnlinkedMentions(body, knownNodes, data.id);
    if (hits.length) {
      totalHits += hits.length;
      for (const h of hits) {
        process.stdout.write(`${data.id} -> [[${h.id}]] (matched: "${h.matched}")\n`);
      }
    }
  }
  process.stderr.write(`vault:link-scan — ${totalHits} unlinked mention${totalHits === 1 ? "" : "s"} found across ${rawNodes.length} nodes\n`);
}

// Windows-safe CLI guard.
const isMain = (() => {
  try {
    return path.resolve(process.argv[1] || "") === path.resolve(new URL(import.meta.url).pathname);
  } catch {
    return false;
  }
})() || (process.argv[1] != null &&
  (process.argv[1].endsWith("/link-scan.mjs") || process.argv[1].endsWith(`${path.sep}link-scan.mjs`)));

if (isMain) {
  main();
}
