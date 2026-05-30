// scripts/vault/learn-sweep.mjs
// SessionEnd sweep: a non-blocking nudge to capture learnings when the session
// touched vault nodes. Authors nothing; never blocks. Fail-safe no-op when the
// project has no vault configured.
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { resolveVault, resolveProjectDir } from "./config.mjs";
import { listVaultMarkdown } from "./vault-index.mjs";

// Pure: turn a list of changed vault node paths into a nudge string (or null).
export function nudgeMessage(changed) {
  const n = changed.length;
  if (n === 0) return null;
  return `This session touched ${n} vault node${n === 1 ? "" : "s"}. Before you finish, consider whether any durable technique, recurring shape, or taxonomy gap is worth capturing with /vault-learn — a generalizable insight left uncaptured is lost.`;
}

// Which vault .md files changed: prefer git (uncommitted changes under the vault),
// fall back to mtime within the last 2 hours when git is unavailable.
export function changedVaultFiles(projectDir, vaultRoot, now = Date.now(), windowMs = 2 * 60 * 60 * 1000) {
  try {
    const out = execFileSync("git", ["-C", projectDir, "status", "--porcelain", "--", vaultRoot],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.split("\n")
      .map((l) => l.slice(3).trim())
      .filter((f) => f.endsWith(".md") && !f.replace(/\\/g, "/").split("/").includes("_raw"));
  } catch {
    return listVaultMarkdown(vaultRoot).filter((f) => {
      try { return now - fs.statSync(f).mtimeMs <= windowMs; } catch { return false; }
    });
  }
}

function main() {
  const projectDir = resolveProjectDir();
  const vault = resolveVault(projectDir);
  if (!vault) process.exit(0); // no vault -> stay silent
  const msg = nudgeMessage(changedVaultFiles(projectDir, vault.vaultRoot));
  if (msg) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionEnd", additionalContext: msg },
    }));
  }
  process.exit(0);
}

const isMain = (() => {
  try { return path.resolve(process.argv[1] || "") === path.resolve(new URL(import.meta.url).pathname); }
  catch { return false; }
})() || (process.argv[1] != null &&
  (process.argv[1].endsWith("/learn-sweep.mjs") || process.argv[1].endsWith(`${path.sep}learn-sweep.mjs`)));

if (isMain) {
  try { main(); } catch { process.exit(0); } // fail-safe: a sweep crash must never disrupt session end
}
