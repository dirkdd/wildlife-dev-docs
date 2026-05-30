// scripts/vault/session-context.mjs
// Emits a compact L0 vault map for the SessionStart hook.
import * as path from "node:path";
import { resolveVault } from "./config.mjs";
import { domainsOf } from "./node-row.mjs";
import { buildVaultIndex } from "./vault-index.mjs";

export function renderL0(nodes, vaultRootRel, vaultName) {
  const counts = new Map();
  for (const n of nodes) for (const d of domainsOf(n)) counts.set(d, (counts.get(d) || 0) + 1);
  const domains = [...counts.entries()].sort().map(([d, c]) => `${d} (${c})`).join(", ");
  return [
    `${vaultName} vault (agent knowledge base) is at ${vaultRootRel}/.`,
    `Before working on a domain, read ${vaultRootRel}/_meta/index.md FIRST (the router), then open only the sub-index and node bodies you need.`,
    domains ? `Domains: ${domains}.` : "Vault is scaffolded but has no domain content yet.",
    "When you learn something durable about the codebase, capture it as a node via the vault-author skill (every task = the work + a vault update).",
  ].join(" ");
}

export function main() {
  const vault = resolveVault();
  if (!vault) return; // no vault in this project -> stay silent
  const { nodes } = buildVaultIndex(vault.vaultRoot);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: renderL0(nodes.map((n) => n.data), vault.vaultRootRel, vault.vaultName),
    },
  }));
}

// Windows-safe CLI guard: new URL(import.meta.url).pathname yields /C:/... on Windows,
// so path.resolve comparison may fail. Fall back to argv endsWith check.
const isMain = (() => {
  try {
    return path.resolve(process.argv[1] || "") === path.resolve(new URL(import.meta.url).pathname);
  } catch {
    return false;
  }
})() || (process.argv[1] != null &&
  (process.argv[1].endsWith("/session-context.mjs") || process.argv[1].endsWith(`${path.sep}session-context.mjs`)));

if (isMain) {
  main();
}
