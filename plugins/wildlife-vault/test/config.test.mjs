import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveVault, resolveProjectDir } from "../scripts/vault/config.mjs";

function tmpProject(config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-cfg-"));
  if (config !== undefined) {
    fs.mkdirSync(path.join(dir, "docs", "vault"), { recursive: true });
    fs.writeFileSync(path.join(dir, "docs", "vault", ".vault.json"), JSON.stringify(config));
  }
  return dir;
}

test("returns null when no .vault.json exists (fail-safe no-op)", () => {
  const dir = tmpProject(undefined);
  assert.equal(resolveVault(dir), null);
});

test("resolves vaultRoot to an absolute path under the project", () => {
  const dir = tmpProject({ vaultRoot: "docs/vault/Knowledge", vaultName: "Knowledge" });
  const v = resolveVault(dir);
  assert.equal(v.vaultRootRel, "docs/vault/Knowledge");
  assert.equal(v.vaultRoot, path.join(dir, "docs", "vault", "Knowledge"));
  assert.equal(v.vaultName, "Knowledge");
  assert.deepEqual(v.domains, []);
});

test("derives vaultName from the path when omitted, and reads domains", () => {
  const dir = tmpProject({ vaultRoot: "docs/vault/Acme", domains: ["billing", "auth"] });
  const v = resolveVault(dir);
  assert.equal(v.vaultName, "Acme");
  assert.deepEqual(v.domains, ["billing", "auth"]);
});

test("resolveProjectDir honors --project-dir then CLAUDE_PROJECT_DIR", () => {
  assert.equal(resolveProjectDir(["node", "x", "--project-dir=/tmp/foo"]), path.resolve("/tmp/foo"));
});

test("resolveProjectDir falls back to CLAUDE_PROJECT_DIR env when no arg", () => {
  const prev = process.env.CLAUDE_PROJECT_DIR;
  process.env.CLAUDE_PROJECT_DIR = path.join(os.tmpdir(), "env-proj");
  try {
    assert.equal(resolveProjectDir(["node", "x"]), path.resolve(path.join(os.tmpdir(), "env-proj")));
  } finally {
    if (prev === undefined) delete process.env.CLAUDE_PROJECT_DIR; else process.env.CLAUDE_PROJECT_DIR = prev;
  }
});

test("vaultRoot with backslashes normalizes and derives vaultName", () => {
  const dir = tmpProject({ vaultRoot: "docs\\vault\\Acme" });
  const v = resolveVault(dir);
  assert.equal(v.vaultRootRel, "docs/vault/Acme");
  assert.equal(v.vaultName, "Acme");
});
