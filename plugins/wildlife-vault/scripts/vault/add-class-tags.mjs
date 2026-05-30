// scripts/vault/add-class-tags.mjs
// Backfill the class/<doc_class> mirror tag on every vault node so the Obsidian
// graph's tag-based color groups have something to match. Idempotent: re-running
// is a no-op once tags are present. Operates on the resolved project vault, or a
// directory passed via --vault-root= (used to backfill the plugin's own skeleton).
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveVault, resolveProjectDir } from "./config.mjs";
import { listVaultMarkdown } from "./vault-index.mjs";
import { parseFrontmatter } from "./parse-frontmatter.mjs";

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(hit.indexOf("=") + 1) : null;
}

export function addClassTag(raw) {
  // Returns { changed, content }. Adds class/<doc_class> to the inline tags array
  // if absent. Skips (changed:false) when no doc_class, already tagged, or tags
  // are not an inline [ ... ] array.
  const parsed = parseFrontmatter(raw);
  if (!parsed.ok) return { changed: false, content: raw };
  const dc = parsed.data.doc_class;
  if (!dc) return { changed: false, content: raw };
  const classTag = `class/${dc}`;
  const tags = parsed.data.tags;
  if (Array.isArray(tags) && tags.includes(classTag)) return { changed: false, content: raw };
  const m = raw.match(/^tags:\s*\[(.*)\]\s*$/m);
  if (!m) return { changed: false, content: raw, nonInline: true };
  const inner = m[1].trim();
  const newInner = inner ? `${inner}, "${classTag}"` : `"${classTag}"`;
  return { changed: true, content: raw.replace(m[0], `tags: [${newInner}]`) };
}

function main() {
  const override = arg("vault-root");
  let vaultRoot;
  if (override) {
    vaultRoot = path.resolve(override);
  } else {
    const v = resolveVault(resolveProjectDir());
    if (!v) return; // no vault configured -> no-op
    vaultRoot = v.vaultRoot;
  }
  let tagged = 0, already = 0, skipped = 0, nonInline = 0;
  for (const file of listVaultMarkdown(vaultRoot)) {
    const raw = fs.readFileSync(file, "utf-8");
    const r = addClassTag(raw);
    if (r.changed) { fs.writeFileSync(file, r.content); tagged++; }
    else if (r.nonInline) { nonInline++; process.stderr.write(`[skip non-inline tags] ${file}\n`); }
    else {
      const p = parseFrontmatter(raw);
      if (p.ok && p.data.doc_class && Array.isArray(p.data.tags) && p.data.tags.includes(`class/${p.data.doc_class}`)) already++;
      else skipped++;
    }
  }
  process.stderr.write(`add-class-tags — ${tagged} tagged, ${already} already, ${skipped} skipped, ${nonInline} non-inline\n`);
}

const isMain = (() => {
  try { return path.resolve(process.argv[1] || "") === path.resolve(new URL(import.meta.url).pathname); }
  catch { return false; }
})() || (process.argv[1] != null && (process.argv[1].endsWith("/add-class-tags.mjs") || process.argv[1].endsWith(`${path.sep}add-class-tags.mjs`)));

if (isMain) main();
