import { test } from "node:test";
import assert from "node:assert/strict";
import { isVaultFile } from "../scripts/vault/validate.mjs";

const ROOT = "/repo/docs/vault/Knowledge";

test("file under the vault root is a vault file", () => {
  assert.equal(isVaultFile(ROOT, "/repo/docs/vault/Knowledge/concepts/foo.md"), true);
});

test("file outside the vault root is not", () => {
  assert.equal(isVaultFile(ROOT, "/repo/src/index.md"), false);
});

test("_raw staging files are excluded", () => {
  assert.equal(isVaultFile(ROOT, "/repo/docs/vault/Knowledge/_raw/draft.md"), false);
});

test("non-markdown is excluded", () => {
  assert.equal(isVaultFile(ROOT, "/repo/docs/vault/Knowledge/concepts/foo.txt"), false);
});

test("null vault root (no config) excludes everything", () => {
  assert.equal(isVaultFile(null, "/repo/docs/vault/Knowledge/concepts/foo.md"), false);
});
