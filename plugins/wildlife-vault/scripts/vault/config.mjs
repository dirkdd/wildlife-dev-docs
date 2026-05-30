// scripts/vault/config.mjs
// Per-project vault configuration loader. Replaces the hardcoded VAULT_ROOT
// constant now that scripts are shared across projects via the plugin.
import * as fs from "node:fs";
import * as path from "node:path";

const DEFAULT_VAULT_ROOT = "docs/vault/Knowledge";

// Resolve which repo we are operating on: explicit --project-dir=, then the
// CLAUDE_PROJECT_DIR env the hooks/commands run under, then cwd.
export function resolveProjectDir(argv = process.argv) {
  const hit = argv.find((a) => a.startsWith("--project-dir="));
  if (hit) return path.resolve(hit.slice(hit.indexOf("=") + 1));
  if (process.env.CLAUDE_PROJECT_DIR) return path.resolve(process.env.CLAUDE_PROJECT_DIR);
  return process.cwd();
}

// Load docs/vault/.vault.json for a project. Returns null when the project has
// no vault configured — every CLI/hook treats null as "not my project, no-op".
export function resolveVault(projectDir = resolveProjectDir()) {
  const configPath = path.join(projectDir, "docs", "vault", ".vault.json");
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
  const vaultRootRel = (cfg.vaultRoot || DEFAULT_VAULT_ROOT).replace(/\\/g, "/");
  return {
    projectDir,
    vaultRootRel,
    vaultRoot: path.join(projectDir, vaultRootRel),
    vaultName: cfg.vaultName || path.basename(vaultRootRel),
    domains: Array.isArray(cfg.domains) ? cfg.domains : [],
  };
}
