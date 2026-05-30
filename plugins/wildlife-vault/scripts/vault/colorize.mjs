// scripts/vault/colorize.mjs
import * as fs from "node:fs";
import * as path from "node:path";
import { DOC_CLASSES } from "./schema.mjs";
import { resolveVault } from "./config.mjs";

export function hexToDecimal(hex) {
  return parseInt(hex.replace(/^#/, ""), 16);
}

// doc_class -> hex. knowledge/reference stay neutral gray so special classes pop.
const COLORS = {
  prd: "#2E86C1",
  design: "#8E44AD",
  spec: "#16A085",
  plan: "#E67E22",
  kickoff: "#F1C40F",
  adr: "#E74C3C",
  analysis: "#D35400",
  "user-journey": "#1ABC9C",
  runbook: "#27AE60",
  guide: "#3498DB",
  knowledge: "#95A5A6",
  reference: "#C8CDD0",
  learning: "#E91E63",
};

export function buildColorGroups() {
  return DOC_CLASSES.map((dc) => ({
    query: `tag:#class/${dc}`,
    color: { a: 1, rgb: hexToDecimal(COLORS[dc] || "#808080") },
  }));
}

export function main() {
  const vault = resolveVault();
  if (!vault) return; // no vault configured -> no-op
  const file = path.join(vault.vaultRoot, ".obsidian", "graph.json");
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    // No Obsidian config in this vault (non-Obsidian / CI). Nothing to color.
    process.stderr.write(`vault:colorize — no ${file}; skipping (vault is not Obsidian-configured)\n`);
    return;
  }
  cfg.colorGroups = buildColorGroups();
  cfg.showTags = false;
  cfg.showArrow = true;
  cfg.hideUnresolved = false;
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
  process.stderr.write(`vault:colorize — ${cfg.colorGroups.length} doc_class color groups written\n`);
}

// Windows-safe CLI guard.
const isMain = (() => {
  try {
    return path.resolve(process.argv[1] || "") === path.resolve(new URL(import.meta.url).pathname);
  } catch {
    return false;
  }
})() || (process.argv[1] != null &&
  (process.argv[1].endsWith("/colorize.mjs") || process.argv[1].endsWith(`${path.sep}colorize.mjs`)));

if (isMain) {
  main();
}
