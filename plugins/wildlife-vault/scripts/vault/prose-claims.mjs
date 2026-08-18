// scripts/vault/prose-claims.mjs
//
// THE PROSE-VS-FILESYSTEM STATE-CLAIM PROBE.
//
// A node says "X does not exist yet" and names the path that disproves it. The
// file is well-formed, recently updated, and every existing gate is blind to
// it, because the defect is in the SENTENCE, not the frontmatter.
//
// THE ONE INVARIANT THAT MAKES THIS SHIPPABLE: the probe can only speak when
// the filesystem CONTRADICTS the sentence. `existsFn` returning falsy is
// silence, always — there is no code path from a true claim to a warning. A
// node legitimately saying "`packages/foo` does not exist yet" about something
// that genuinely does not exist produces nothing. Everything else below is
// about not mis-attributing a claim to the wrong path.
//
// The naive version — phrase vocabulary + any path in the sentence — measured
// 1 true / 5 false on a real 305-file docs tree. The controls are not optional:
//   1. SUBJECT-ADJACENCY  the path must be the span the phrase is attached to
//   2. FENCED CODE        a sample is not an assertion
//   3. STRIKETHROUGH      a struck row is already closed
//   4. PAST TENSE         a historical framing is a record, not a claim
//   5. LINE OPT-OUT       a doc quoting the vocabulary says so once
//   6. NODE EXEMPTIONS    decision/adr (dated context), learning (quotes the
//                         vocabulary by nature), deprecated
//
// Soft only, and never in the hook path: attribution is heuristic, and a hard
// rule on prose is the one that gets the whole gate switched off.
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveVault } from "./config.mjs";
import { buildVaultIndex } from "./vault-index.mjs";
import { parseFrontmatter } from "./parse-frontmatter.mjs";

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// Deliberately small. "has no caller" and "has no milestone home" are NOT here:
// neither is adjudicable by existsSync, and "has no caller" was the single
// largest false-positive source in the measurement.
const PHRASES = [
  "does not exist", "do not exist", "doesn't exist", "don't exist",
  "is unbuilt", "are unbuilt", "not yet in code", "not yet implemented",
  "is a scaffold", "are scaffolds", "is a stub", "are stubs",
  "is not built", "are not built",
];

// A path-shaped token: something/with/slashes, or a bare file.ext. Not a URL.
const PATHISH = /^(?!https?:)[\w.@~-]+(?:\/[\w.@~-]+)+\/?$|^[\w-]+\.[A-Za-z]{1,5}$/;

const CHAIN = "((?:\\s*(?:,|and|or|\\/)\\s*`[^`\\n]+`)*)";
const FILLER = "[*_)\\]\\s]*(?:\\w+\\s+){0,2}";
const SUBJECT = new RegExp("`([^`\\n]+)`" + CHAIN + FILLER + "(" + PHRASES.map(esc).join("|") + ")", "gi");

const OPT_OUT = /vault-ok:\s*prose-claim/;
const PAST = /\b(no longer|used to|previously|formerly|at the time|as of \d)\b/i;

// Pure. `existsFn(token)` -> a resolved repo-relative path (truthy) or falsy.
export function proseClaimIssues(body, existsFn) {
  const out = [];
  let inFence = false;
  const lines = String(body).split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^\s*(```|~~~)/.test(raw)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const line = raw.replace(/~~[^~]*~~/g, " "); // struck through == already closed
    if (OPT_OUT.test(line) || PAST.test(line)) continue;
    for (const m of line.matchAll(SUBJECT)) {
      const spans = [m[1], ...[...(m[2] || "").matchAll(/`([^`\n]+)`/g)].map((x) => x[1])];
      for (const span of spans) {
        const tok = span.trim().replace(/^\.\//, "").replace(/[.,;:)]+$/, "");
        if (tok.includes("*") || !PATHISH.test(tok)) continue;
        const resolved = existsFn(tok);
        if (!resolved) continue; // a TRUE claim. Silence. Always.
        out.push({
          line: i + 1,
          phrase: m[3].toLowerCase(),
          claimed: tok,
          resolved,
          sentence: line.trim().slice(0, 150),
        });
      }
    }
  }
  return out;
}

// Narrower than the markdown-scan skiplist ON PURPOSE. `dist/` and `build/`
// are generated, but docs cite them constantly ("regenerate and commit
// dist/wire.ts"), and a path missing from this index reads as "the claim is
// true" — i.e. skipping a directory here creates FALSE NEGATIVES, never false
// positives, but it silently blinds the probe to a whole class of real claims.
const SKIP_DIRS = new Set([
  ".git", "node_modules", ".venv", "venv", "__pycache__",
  ".turbo", ".cache", ".obsidian",
]);
const MAX_INDEXED = 60000;

function walkPaths(root, base, out) {
  if (out.length >= MAX_INDEXED) return out;
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (out.length >= MAX_INDEXED) break;
    const abs = path.join(root, e.name);
    const rel = path.relative(base, abs).replace(/\\/g, "/");
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      out.push(rel);
      walkPaths(abs, base, out);
    } else if (e.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

// Exact first, then suffix — because docs write shorthand: `dist/wire.ts`
// really means `packages/wire/dist/wire.ts`. Exact-only recall on the
// historical corpus was 1 of 6 known-false claims; with suffix it is 4 of 6.
// The caller prints BOTH paths so a human adjudicates in one line.
export function makeExistsFn(projectDir) {
  const root = path.resolve(projectDir);
  let index = null;
  return (tok) => {
    const abs = path.resolve(root, tok);
    // never escape the project
    if (abs === root || abs.startsWith(root + path.sep)) {
      if (fs.existsSync(abs)) return path.relative(root, abs).replace(/\\/g, "/");
    }
    if (index === null) index = walkPaths(root, root, []);
    const needle = "/" + tok.replace(/\/$/, "");
    for (const p of index) if (p.endsWith(needle)) return p;
    return null;
  };
}

// Node-level exemptions, each earned from a measured false positive.
export function isExemptNode(data = {}) {
  if (data.type === "decision" || data.doc_class === "adr") return true; // dated context
  if (data.type === "learning" || data.doc_class === "learning") return true; // quotes the vocabulary
  if (data.status === "deprecated") return true;
  return false;
}

// Soft warning strings for validate.mjs's --all branch. Never a pass in
// passes.mjs: the passes take (filePath, parsed, ctx), have no project root and
// no filesystem I/O, and they run on every hook write.
export function proseClaimReport(projectDir, vault = resolveVault(projectDir)) {
  if (!vault) return [];
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(path.join(projectDir, "docs", "vault", ".vault.json"), "utf-8"));
  } catch { /* resolveVault already succeeded */ }
  if (cfg.proseClaims === false) return []; // kill switch, one line, no argument

  const existsFn = makeExistsFn(projectDir);
  const out = [];
  for (const { filePath, data } of buildVaultIndex(vault.vaultRoot).nodes) {
    if (isExemptNode(data)) continue;
    let content;
    try { content = fs.readFileSync(filePath, "utf-8"); } catch { continue; }
    const parsed = parseFrontmatter(content);
    if (!parsed.ok) continue;
    // report FILE line numbers, not body-relative ones
    const offset = content.split("\n").length - parsed.body.split("\n").length;
    const rel = path.relative(projectDir, filePath).replace(/\\/g, "/");
    for (const h of proseClaimIssues(parsed.body, existsFn)) {
      const where = h.resolved === h.claimed
        ? `\`${h.claimed}\` exists`
        : `\`${h.claimed}\` resolves to ${h.resolved}`;
      out.push(`${rel}:${offset + h.line} prose claim "${h.phrase}" but ${where} — "${h.sentence}"`);
    }
  }
  return out;
}
