// scripts/vault/colorize.mjs
import * as fs from "node:fs";
import * as path from "node:path";
import { DOC_CLASSES } from "./schema.mjs";
import { resolveVault } from "./config.mjs";

export function hexToDecimal(hex) {
  return parseInt(hex.replace(/^#/, ""), 16);
}

// Stable palette; cycles if doc_class count exceeds entries.
const PALETTE = [
  "#2E86C1", "#8A45E2", "#1B9E46", "#CD5C1C", "#F1C40F", "#808080",
  "#C0392B", "#16A085", "#2C3E50", "#D35400", "#7F8C8D", "#9B59B6",
];

export function buildColorGroups() {
  return DOC_CLASSES.map((dc, i) => ({
    query: `doc_class:"${dc}"`,
    color: { a: 1, rgb: hexToDecimal(PALETTE[i % PALETTE.length]) },
  }));
}

export function main() {
  const vault = resolveVault();
  if (!vault) return; // no vault configured -> no-op
  const file = path.join(vault.vaultRoot, ".obsidian", "graph.json");
  const cfg = JSON.parse(fs.readFileSync(file, "utf-8"));
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
