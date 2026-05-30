// scripts/vault/vault-index.mjs
import * as fs from "node:fs";
import * as path from "node:path";
import { VAULT_ROOT } from "./schema.mjs";
import { parseFrontmatter } from "./parse-frontmatter.mjs";

export function listVaultMarkdown(root = VAULT_ROOT) {
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { recursive: true });
  return entries
    .map((e) => path.join(root, e.toString()))
    .filter((p) => p.endsWith(".md"))
    // skip the staging area
    .filter((p) => !p.split(path.sep).includes("_raw"));
}

// Returns { byId: Map<id, filePath>, nodes: [{ filePath, data }] }
export function buildVaultIndex(root = VAULT_ROOT, exceptFile = null) {
  const byId = new Map();
  const nodes = [];
  for (const filePath of listVaultMarkdown(root)) {
    if (exceptFile && path.resolve(filePath) === path.resolve(exceptFile)) continue;
    let content;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }
    const parsed = parseFrontmatter(content);
    if (!parsed.ok) continue;
    const id = parsed.data.id;
    if (id) byId.set(id, filePath);
    nodes.push({ filePath, data: parsed.data });
  }
  return { byId, nodes };
}
