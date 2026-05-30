import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const SCRIPTS = path.resolve("plugins/wildlife-vault/scripts/vault");
const SKELETON = path.resolve("plugins/wildlife-vault/skeleton/Knowledge");

function run(script, projectDir, extra = []) {
  const r = spawnSync(process.execPath,
    [path.join(SCRIPTS, script), `--project-dir=${projectDir}`, ...extra],
    { encoding: "utf8" });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
}

function freshProjectWithVault() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-e2e-"));
  fs.cpSync(SKELETON, path.join(dir, "docs", "vault", "Knowledge"), { recursive: true });
  fs.mkdirSync(path.join(dir, "docs", "vault"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs", "vault", ".vault.json"),
    JSON.stringify({ vaultRoot: "docs/vault/Knowledge", vaultName: "Knowledge", domains: [] }));
  return dir;
}

test("map + colorize + lint run clean on a fresh scaffolded vault", () => {
  const dir = freshProjectWithVault();
  assert.equal(run("index.mjs", dir).code, 0, "vault:map should exit 0");
  assert.equal(run("colorize.mjs", dir).code, 0, "vault:colorize should exit 0");
  const lint = run("validate.mjs", dir, ["--all"]);
  assert.equal(lint.code, 0, `vault:lint should be clean:\n${lint.out}`);
  assert.match(lint.out, /0 hard/);
});

test("scripts no-op (exit 0, no throw) on a project with no .vault.json", () => {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "vault-bare-"));
  assert.equal(run("index.mjs", bare).code, 0);
  assert.equal(run("colorize.mjs", bare).code, 0);
  assert.equal(run("validate.mjs", bare, ["--all"]).code, 0);
  assert.equal(run("session-context.mjs", bare).code, 0);
});

test("session-context emits a pointer when a vault exists", () => {
  const dir = freshProjectWithVault();
  const r = run("session-context.mjs", dir);
  assert.equal(r.code, 0);
  assert.match(r.out, /Knowledge vault/);
});
