// scripts/vault/link-scan.mjs
import * as fs from "node:fs";
import * as path from "node:path";
import { buildVaultIndex } from "./vault-index.mjs";
import { resolveVault } from "./config.mjs";
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

// ---------------------------------------------------------------------------
// DANGLING-WIKILINK AUDIT
//
// A different scan from findUnlinkedMentions above, and the difference is the
// whole point. findUnlinkedMentions looks for a mention that SHOULD be a link
// (O(nodes x nodes) regex — expensive, noisy, deliberately kept vault-only).
// This looks for a link that IS broken: one regex pass per file, cheap enough
// to point at a whole docs tree. The close gate writes most of its links
// OUTSIDE the vault — sprint docs, ADRs, retros — so that is where the broken
// ones live.
// ---------------------------------------------------------------------------

// Only a vault-id shape counts. No spaces, no slashes, no colons: Obsidian
// path links and [[Human Readable Title]] links are not vault ids and are not
// this check's business. (Measured: this filter drops ~8% of all matches.)
const ID_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const WIKILINK_G = /\[\[([^\]\n]+)\]\]/g;

const SKIP_DIRS = new Set([
  ".git", "node_modules", "dist", "build", ".next", ".venv", "venv",
  "__pycache__", ".turbo", ".cache", "coverage", "_raw", ".obsidian",
]);
const MAX_FILE_BYTES = 512 * 1024;

// Every id-shaped link target in a document, one entry per occurrence.
// Split out from danglingLinks so the driver can extract targets in the SAME
// pass that harvests aliases, and resolve them once at the end.
export function linkTargets(text, ignorePrefixes = []) {
  // Strip fenced and inline code FIRST: `[[ -z "$X" ]]` in a shell snippet
  // matches the wikilink regex exactly. Without this, every doc containing
  // bash reports dangling links.
  const stripped = String(text)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`\n]*`/g, " ");
  const out = [];
  for (const m of stripped.matchAll(WIKILINK_G)) {
    const target = m[1].split("|")[0].split("#")[0].trim();
    if (!ID_SHAPE.test(target)) continue;
    if (ignorePrefixes.some((p) => p && target.startsWith(p))) continue;
    out.push(target);
  }
  return out;
}

// Pure. `resolvable` is a Set of every name a link may legitimately point at.
// Returns one entry PER OCCURRENCE so the caller can count references.
export function danglingLinks(text, resolvable, ignorePrefixes = []) {
  return linkTargets(text, ignorePrefixes).filter((t) => !resolvable.has(t));
}

function idTokens(s) {
  return new Set(String(s).toLowerCase().split(/[-._]+/).filter((t) => t.length >= 3));
}

// "did you mean" by hyphen-token overlap. Finds the real observed bug: a retro
// linked [[learning-a-test-double-is-a-claim-about-...]] against a node id of
// learning-test-double-is-a-constraint-claim.
export function suggestClosest(target, knownIds, minOverlap = 3) {
  const want = idTokens(target);
  if (want.size < minOverlap) return null;
  let best = null;
  let bestScore = minOverlap - 1;
  for (const id of knownIds) {
    if (id === target) continue;
    const have = idTokens(id);
    let score = 0;
    for (const t of want) if (have.has(t)) score++;
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return best;
}

// Read the two audit knobs. They live in docs/vault/.vault.json beside
// `domains`; kept local to this module so config.mjs stays untouched.
// Default linkRoots = the vault root, so an existing install sees ZERO
// behaviour change until it opts in by adding one line.
export function readLinkAuditConfig(projectDir, vault = resolveVault(projectDir)) {
  if (!vault) return null;
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(path.join(projectDir, "docs", "vault", ".vault.json"), "utf-8"));
  } catch { /* resolveVault already succeeded; treat as no extras */ }
  return {
    linkRoots: Array.isArray(cfg.linkRoots) && cfg.linkRoots.length ? cfg.linkRoots : [vault.vaultRootRel],
    linkIgnorePrefixes: Array.isArray(cfg.linkIgnorePrefixes) ? cfg.linkIgnorePrefixes : [],
    // WIDE by default, and deliberately not the same default as linkRoots. See
    // the asymmetry argument in the report below: narrow the scan, widen the
    // resolution. SKIP_DIRS keeps this off node_modules/.git/dist.
    linkResolveRoots: Array.isArray(cfg.linkResolveRoots) && cfg.linkResolveRoots.length
      ? cfg.linkResolveRoots : ["."],
  };
}

function walkMarkdown(root, out = []) {
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const abs = path.join(root, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walkMarkdown(abs, out);
    } else if (e.isFile() && e.name.endsWith(".md")) {
      out.push(abs);
    }
  }
  return out;
}

// Soft warnings, grouped BY TARGET rather than by occurrence: 20 lines instead
// of 83 on the measured corpus, each adjudicable at a glance.
export function danglingLinkReport(projectDir, vault = resolveVault(projectDir)) {
  if (!vault) return [];
  const cfg = readLinkAuditConfig(projectDir, vault);
  if (!cfg) return [];

  const files = new Set();
  for (const rel of cfg.linkRoots) {
    for (const f of walkMarkdown(path.resolve(projectDir, rel))) files.add(path.resolve(f));
  }

  // The resolution universe is how OBSIDIAN resolves: every .md basename under
  // the RESOLVE roots, plus their frontmatter aliases, plus every vault node id
  // and alias. Reading aliases only from vault nodes was measured at 25 false
  // positives out of 45 targets on a real docs tree — ADRs and trackers declare
  // `aliases: [ADR-0004, Tracker]` in their own frontmatter and the whole repo
  // links them by that alias.
  //
  // THE RESOLVE ROOTS ARE NOT THE SCAN ROOTS, and the split is the difference
  // between a gate people keep and a gate people switch off. Bounding
  // resolution by the scan root reported 15 targets on the real 152-node vault
  // of which 14 were ADRs living in docs/ADR/ — outside the default scan root,
  // every one of them resolving correctly in Obsidian. The two errors are not
  // symmetric: under-resolving ACCUSES a healthy link, over-resolving is merely
  // SILENT. On a soft advisory, silence is the safe failure.
  const resolveFiles = new Set();
  for (const rel of cfg.linkResolveRoots) {
    for (const f of walkMarkdown(path.resolve(projectDir, rel))) resolveFiles.add(path.resolve(f));
  }
  const resolvable = new Set();
  const vaultIds = [];
  for (const f of resolveFiles) {
    resolvable.add(path.basename(f, ".md"));
    let stat;
    try { stat = fs.statSync(f); } catch { continue; }
    if (stat.size > MAX_FILE_BYTES) continue;
    let text;
    try { text = fs.readFileSync(f, "utf-8"); } catch { continue; }
    const parsed = parseFrontmatter(text);
    if (!parsed.ok) continue;
    for (const a of parsed.data.aliases || []) if (a) resolvable.add(String(a));
    if (parsed.data.id) resolvable.add(String(parsed.data.id));
  }
  try {
    for (const { data } of buildVaultIndex(vault.vaultRoot).nodes) {
      if (data.id) { resolvable.add(data.id); vaultIds.push(data.id); }
      for (const a of data.aliases || []) if (a) resolvable.add(String(a));
    }
  } catch { /* no vault on disk yet */ }

  // One read per file: harvest aliases and collect candidate targets together,
  // then resolve at the end (an alias may be declared after the link is read).
  const found = [];
  for (const f of files) {
    let stat;
    try { stat = fs.statSync(f); } catch { continue; }
    if (stat.size > MAX_FILE_BYTES) continue;
    let text;
    try { text = fs.readFileSync(f, "utf-8"); } catch { continue; }
    const parsed = parseFrontmatter(text);
    if (parsed.ok) {
      for (const a of parsed.data.aliases || []) if (a) resolvable.add(String(a));
      if (parsed.data.id) resolvable.add(String(parsed.data.id));
    }
    const rel = path.relative(projectDir, f).replace(/\\/g, "/");
    for (const target of linkTargets(text, cfg.linkIgnorePrefixes)) found.push({ target, rel });
  }

  const byTarget = new Map();
  for (const { target, rel } of found) {
    if (resolvable.has(target)) continue;
    if (!byTarget.has(target)) byTarget.set(target, { count: 0, files: new Set() });
    const g = byTarget.get(target);
    g.count++;
    g.files.add(rel);
  }

  const out = [];
  for (const [target, g] of [...byTarget.entries()].sort((a, b) => b[1].count - a[1].count)) {
    const names = [...g.files].sort();
    const shown = names.slice(0, 3).join(", ") + (names.length > 3 ? `, +${names.length - 3} more` : "");
    const refs = `${g.count} reference${g.count === 1 ? "" : "s"} across ${names.length} file${names.length === 1 ? "" : "s"}`;
    const near = suggestClosest(target, vaultIds);
    let msg = `dangling wikilink [[${target}]] — ${refs}, resolves to no node, alias, or file (${shown})`;
    if (near) msg += ` — did you mean [[${near}]]?`;
    else if (g.count >= 10) msg += ` — one alias on the intended target fixes all ${g.count}`;
    out.push(msg);
  }
  return out;
}

export function main() {
  if (process.argv.includes("--dangling")) {
    const projectDir = process.env.CLAUDE_PROJECT_DIR ? path.resolve(process.env.CLAUDE_PROJECT_DIR) : process.cwd();
    const argHit = process.argv.find((a) => a.startsWith("--project-dir="));
    const dir = argHit ? path.resolve(argHit.slice(argHit.indexOf("=") + 1)) : projectDir;
    const report = danglingLinkReport(dir);
    for (const line of report) process.stdout.write(`${line}\n`);
    process.stderr.write(`vault:link-scan — ${report.length} dangling target${report.length === 1 ? "" : "s"}\n`);
    return;
  }
  const vault = resolveVault();
  if (!vault) return; // no vault configured -> no-op
  // buildVaultIndex returns { byId, nodes: [{ filePath, data }] }; map to bare data objects.
  const { nodes: rawNodes } = buildVaultIndex(vault.vaultRoot);
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
