// scripts/vault/learnings-export.mjs
// Export captured learning nodes (learning_status: proposed) as a sanitized,
// copy-paste Markdown digest, and stamp them harvested. The harvestable payload
// is everything EXCEPT the "In-project evidence" section. Fail-safe no-op when
// no vault is configured. Pure helpers are exported for unit testing.
import * as fs from "node:fs";
import { resolveVault, resolveProjectDir } from "./config.mjs";
import { buildVaultIndex } from "./vault-index.mjs";
import { parseFrontmatter } from "./parse-frontmatter.mjs";

// Remove the "## In-project evidence" section (heading through the next "## " or EOF).
export function stripEvidence(body) {
  const lines = String(body).split("\n");
  const out = [];
  let skipping = false;
  for (const line of lines) {
    const isH2 = /^##\s+/.test(line);
    if (isH2 && /^##\s+In-project evidence\s*$/.test(line)) { skipping = true; continue; }
    if (isH2 && skipping) skipping = false; // next section ends the skip
    if (!skipping) out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// Heuristic: return flagged snippets that look proprietary (warn-only).
export function proprietarySignals(text) {
  const t = String(text);
  const hits = [];
  const email = t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  const url = t.match(/https?:\/\/[^\s)]+/g) || [];
  const pathish = t.match(/(?:^|\s)(\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+)/g) || [];
  const proper = t.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g) || [];
  for (const a of [email, url, pathish, proper]) for (const s of a) hits.push(s.trim());
  return [...new Set(hits)];
}

// Section helper: extract a "## <name>" section body (text up to next ## or EOF), or "".
function section(body, name) {
  const re = new RegExp(`^##\\s+${name}\\s*$([\\s\\S]*?)(?=^##\\s+|$(?![\\r\\n]))`, "m");
  const m = re.exec(String(body));
  return m ? m[1].trim() : "";
}

// Compose the full digest from selected nodes: [{ data, body }].
export function composeDigest(nodes) {
  const blocks = [];
  const allSignals = new Set();
  for (const n of nodes) {
    const clean = stripEvidence(n.body || "");
    const insight = section(clean, "Generalized insight") || "(none)";
    const change = section(clean, "Proposed plugin change") || "(none)";
    const scanText = `${n.data.summary || ""}\n${insight}\n${change}`;
    const sig = proprietarySignals(scanText);
    sig.forEach((s) => allSignals.add(s));
    blocks.push([
      `## ${n.data.id} — ${n.data.title || ""}`,
      `- kind: ${n.data.learning_kind || "(unspecified)"}`,
      `- summary: ${n.data.summary || ""}`,
      "",
      "### Generalized insight",
      insight,
      "",
      "### Proposed plugin change",
      change,
      sig.length ? `\n> ⚠ Possible proprietary signals to review before sharing: ${sig.join(", ")}` : "",
      "---",
    ].join("\n"));
  }
  const header = `# Vault learnings digest (${nodes.length})`;
  const banner = allSignals.size
    ? `\n> ⚠ Possible proprietary signals detected (${allSignals.size}); review each flagged learning before pasting.\n`
    : "";
  return `${header}\n${banner}\n${blocks.join("\n")}\n`;
}

// Flip the first inline `learning_status: proposed` to `harvested`. Idempotent.
export function stampHarvested(raw) {
  return String(raw).replace(/^(learning_status:\s*)proposed\s*$/m, "$1harvested");
}

function hasFlag(name) { return process.argv.includes(`--${name}`); }

function main() {
  const projectDir = resolveProjectDir();
  const vault = resolveVault(projectDir);
  if (!vault) process.exit(0); // no vault -> print nothing
  const dryRun = hasFlag("dry-run");

  const selected = [];
  for (const { filePath, data } of buildVaultIndex(vault.vaultRoot).nodes) {
    if (data.type !== "learning") continue;
    if (data.learning_status !== "proposed") continue;
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = parseFrontmatter(raw);
    selected.push({ filePath, raw, data, body: parsed.ok ? parsed.body : "" });
  }

  process.stdout.write(composeDigest(selected));

  if (!dryRun) {
    for (const n of selected) {
      const stamped = stampHarvested(n.raw);
      if (stamped !== n.raw) fs.writeFileSync(n.filePath, stamped);
    }
    process.stderr.write(`vault:learnings — exported ${selected.length}, stamped harvested${selected.length ? "" : " (none)"}\n`);
  } else {
    process.stderr.write(`vault:learnings — dry-run, ${selected.length} would be exported (not stamped)\n`);
  }
  process.exit(0);
}

const isMain = (() => {
  try {
    return process.argv[1] && (process.argv[1].endsWith("learnings-export.mjs"));
  } catch { return false; }
})();

if (isMain) {
  try { main(); } catch (e) { process.stderr.write(`learnings-export failed (no-op): ${e && e.message}\n`); process.exit(0); }
}
