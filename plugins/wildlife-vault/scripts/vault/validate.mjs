// scripts/vault/validate.mjs
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveVault, resolveProjectDir } from "./config.mjs";
import { parseFrontmatter } from "./parse-frontmatter.mjs";
import { buildVaultIndex, listVaultMarkdown } from "./vault-index.mjs";
import { pass1Schema, pass2Structural, pass3Graph } from "./passes.mjs";
import { coverageGaps, orphanedDomainIndexes, missingDomainIndexes } from "./index-drift.mjs";
// The code_refs liveness probe. Importing status.mjs is safe: its CLI guard keys
// off process.argv[1], so main() does not run on import (test: "importing
// status.mjs does not run its main()").
import { codeRefIssues } from "./status.mjs";
import { danglingLinkReport } from "./link-scan.mjs";
import { proseClaimReport } from "./prose-claims.mjs";

// Pure: validate one file's content. Exported for tests.
// ctx.knownIds represents OTHER nodes only; callers (the CLI) exclude the
// current file when building it, so pass2's duplicate-id check fires correctly.
export function validateContent(filePath, content, ctx = {}) {
  const parsed = parseFrontmatter(content);
  if (!parsed.ok) return { hard: [parsed.error], soft: [] };
  const c = { body: parsed.body, ...ctx };
  const results = [
    pass1Schema(filePath, parsed, c),
    pass2Structural(filePath, parsed, c),
    pass3Graph(filePath, parsed, c),
  ];
  return {
    hard: results.flatMap((r) => r.hard),
    soft: results.flatMap((r) => r.soft),
  };
}

export function isVaultFile(absVaultRoot, p) {
  if (!absVaultRoot || !p || !p.endsWith(".md")) return false;
  const norm = path.resolve(p).replace(/\\/g, "/");
  const root = path.resolve(absVaultRoot).replace(/\\/g, "/").replace(/\/+$/, "");
  if (norm !== root && !norm.startsWith(root + "/")) return false;
  return !norm.slice(root.length).split("/").includes("_raw");
}

function readStdin() {
  try {
    return fs.readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(hit.indexOf("=") + 1) : null;
}

function emitHard(mode, errors) {
  const reason = errors.join("; ");
  process.stderr.write(`VAULT HARD BLOCK: ${reason}\n`);
  if (mode === "pre") {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }));
  }
  process.exit(2);
}

function emitSoft(warnings) {
  if (warnings.length) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { additionalContext: `Vault warnings:\n- ${warnings.join("\n- ")}` },
    }));
  }
  process.exit(0);
}

function main() {
  const mode = arg("mode") || "post";
  const all = process.argv.includes("--all");
  const now = Date.now();

  const projectDir = resolveProjectDir();
  const vault = resolveVault(projectDir);
  if (!vault) process.exit(0); // no vault configured in this project -> no-op

  if (all) {
    // COVERAGE ASSERTION, tier 1 — a lint that measured nothing must never
    // report a pass. A typo in .vault.json's vaultRoot, or a renamed folder,
    // silently turns every gate below into a no-op that certifies the vault.
    // --all only: a single-file write must never be blocked by this.
    if (!fs.existsSync(vault.vaultRoot) || !fs.statSync(vault.vaultRoot).isDirectory()) {
      process.stderr.write(
        `[HARD] vault root not found: ${vault.vaultRootRel} `
        + `(check vaultRoot in docs/vault/.vault.json)\n`);
      process.exit(1);
    }

    const { byId, nodes: rawNodes } = buildVaultIndex(vault.vaultRoot);
    const files = listVaultMarkdown(vault.vaultRoot);

    // COVERAGE ASSERTION, tier 2 — self-arming on the artifact's own presence.
    // A brand-new vault legitimately has zero files; a vault with files but zero
    // parseable nodes measured nothing, whatever the per-file loop goes on to say.
    if (files.length && rawNodes.length === 0) {
      process.stderr.write(
        `[HARD] ${files.length} markdown files under ${vault.vaultRootRel} but 0 parsed nodes `
        + `— the lint measured nothing\n`);
      process.exit(1);
    }

    let hardCount = 0;
    let softCount = 0;
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf-8");
      // exclude self from the known-id set so duplicate-id only fires on real dupes
      const knownIds = new Set([...byId.keys()].filter((id) => path.resolve(byId.get(id)) !== path.resolve(filePath)));
      const r = validateContent(filePath, content, { knownIds, now });
      if (r.hard.length) { hardCount += r.hard.length; process.stderr.write(`[HARD] ${filePath}\n  - ${r.hard.join("\n  - ")}\n`); }
      if (r.soft.length) { softCount += r.soft.length; process.stderr.write(`[soft] ${filePath}\n  - ${r.soft.join("\n  - ")}\n`); }
    }

    // Index-drift gates: run after per-file loop.
    // buildVaultIndex returns { nodes: [{ filePath, data }] }; map to bare data objects.
    const nodes = rawNodes.map((n) => n.data);
    const byTypeFile = path.join(vault.vaultRoot, "_meta", "index-by-type.md");
    let byTypeBody = "";
    try { byTypeBody = fs.readFileSync(byTypeFile, "utf-8"); } catch { /* file may not exist yet */ }

    // Derive existing domain-index ids by listing index-domain-*.md filenames.
    const metaDir = path.join(vault.vaultRoot, "_meta");
    let domainIndexIds = [];
    try {
      domainIndexIds = fs.readdirSync(metaDir)
        .filter((f) => f.startsWith("index-domain-") && f.endsWith(".md"))
        .map((f) => f.slice(0, -3)); // strip .md
    } catch { /* _meta may not exist */ }

    const gaps = coverageGaps(nodes, byTypeBody);
    const orphans = orphanedDomainIndexes(nodes, domainIndexIds);
    const missing = missingDomainIndexes(nodes, domainIndexIds);

    const driftHard = [...gaps, ...orphans.map((id) => `${id}.md exists but its domain has no nodes (run /vault-map to clean up)`), ...missing];
    if (driftHard.length) {
      hardCount += driftHard.length;
      process.stderr.write(`[HARD] index-drift\n  - ${driftHard.join("\n  - ")}\n`);
    }

    // code_refs liveness, as SOFT warnings. status.mjs treats a missing path as
    // hard because /vault-status is a deliberate audit; in lint a code path
    // deleted in the same commit as the doc update must not block vault writes.
    // --all only — a filesystem probe over every node's code_refs is the wrong
    // budget for a per-write hook, and a missing path must never deny a write.
    const refs = codeRefIssues(nodes, fs, { baseDir: vault.projectDir });
    const refSoft = [...refs.hard, ...refs.soft];
    if (refSoft.length) {
      softCount += refSoft.length;
      process.stderr.write(`[soft] code_refs\n  - ${refSoft.join("\n  - ")}\n`);
    }

    // Soft, --all only: links whose target no longer resolves, and prose claims
    // the filesystem contradicts. Neither runs in the hook path -- attribution
    // is heuristic, and a hard rule on prose is the one that gets the whole
    // gate switched off. Reachability from HERE is asserted in e2e-scripts.
    for (const [label, lines] of [
      ["dangling-wikilinks", danglingLinkReport(projectDir, vault)],
      ["prose-claims", proseClaimReport(projectDir, vault)],
    ]) {
      if (lines.length) {
        softCount += lines.length;
        process.stderr.write(`[soft] ${label}\n  - ${lines.join("\n  - ")}\n`);
      }
    }

    // Report the denominator, so a vacuous run can never read as a clean one.
    process.stderr.write(
      `vault:lint complete — ${hardCount} hard, ${softCount} soft `
      + `(${rawNodes.length} nodes, ${files.length} files)\n`);
    process.exit(hardCount ? 1 : 0);
  }

  // hook mode
  let hookInput = {};
  const raw = readStdin();
  if (raw.trim()) { try { hookInput = JSON.parse(raw); } catch { /* fall through */ } }

  const filePath = hookInput?.tool_input?.file_path || arg("file");
  if (!isVaultFile(vault.vaultRoot, filePath)) process.exit(0); // PATH GUARD

  let content;
  if (mode === "pre") {
    // Write exposes full content as tool_input.content; Edit does not expose the result.
    content = hookInput?.tool_input?.content;
    if (content === undefined) process.exit(0); // Edit (or no content) -> defer to post
  } else {
    try { content = fs.readFileSync(filePath, "utf-8"); }
    catch { emitHard(mode, [`file unreadable after write: ${filePath}`]); return; }
  }

  const { byId } = buildVaultIndex(vault.vaultRoot, filePath);
  const r = validateContent(filePath, content, { knownIds: new Set(byId.keys()), now });
  if (r.hard.length) emitHard(mode, r.hard);
  emitSoft(r.soft);
}

// Only run as CLI entry point — not when imported by tests or other modules.
const thisFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entryFile && path.resolve(thisFile) === entryFile) {
  // Fail-safe: an unexpected crash must not wedge writes and must not silently allow a known-bad write.
  try {
    main();
  } catch (err) {
    process.stderr.write(`vault validator crashed (failing safe, allowing write): ${err && err.message}\n`);
    process.exit(0);
  }
}
