import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { isVaultFile } from "../scripts/vault/validate.mjs";
import { codeRefIssues } from "../scripts/vault/status.mjs";

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

// --- codeRefIssues: the liveness probe lint now imports ---
// Exercised through the fsImpl seam status.mjs already exposes, so no disk is touched.

function fakeFs(files) {
  return {
    existsSync: (p) => Object.prototype.hasOwnProperty.call(files, p),
    readFileSync: (p) => files[p],
  };
}

test("a missing code_ref path is hard (status stays the strict gate)", () => {
  const r = codeRefIssues([{ id: "n1", code_refs: ["src/gone.ts"] }], fakeFs({}));
  assert.equal(r.hard.length, 1);
  assert.match(r.hard[0], /code_ref path missing: src\/gone\.ts \(in n1\)/);
  assert.equal(r.soft.length, 0);
});

test("a single-segment symbol that is absent still warns", () => {
  const r = codeRefIssues(
    [{ id: "n1", code_refs: ["src/a.ts#missingSym"] }],
    fakeFs({ "src/a.ts": "export function other() {}\n" })
  );
  assert.equal(r.hard.length, 0);
  assert.equal(r.soft.length, 1);
  assert.match(r.soft[0], /code_ref symbol drifted/);
});

test("a single-segment symbol that is present does not warn", () => {
  const r = codeRefIssues(
    [{ id: "n1", code_refs: ["src/a.ts#buildGraph"] }],
    fakeFs({ "src/a.ts": "export function buildGraph() {}\n" })
  );
  assert.deepEqual(r, { hard: [], soft: [] });
});

test("a dotted Class.method resolves part-wise, not as a literal string", () => {
  const py = "class MCPClient:\n    async def connect(self):\n        pass\n";
  const r = codeRefIssues(
    [{ id: "mcp-client-authorization", code_refs: ["src/mcp/client.py#MCPClient.connect"] }],
    fakeFs({ "src/mcp/client.py": py })
  );
  assert.deepEqual(r, { hard: [], soft: [] },
    "the literal 'MCPClient.connect' never appears at a Python definition site");
});

test("a dotted ref whose final segment is gone still warns", () => {
  const py = "class MCPClient:\n    async def connect(self):\n        pass\n";
  const r = codeRefIssues(
    [{ id: "n1", code_refs: ["src/mcp/client.py#MCPClient.disconnect"] }],
    fakeFs({ "src/mcp/client.py": py })
  );
  assert.equal(r.soft.length, 1);
  assert.match(r.soft[0], /MCPClient\.disconnect/);
});

test("a dotted TypeScript member resolves too", () => {
  const ts = "export class Profile {\n  declaredRoles() { return []; }\n}\n";
  const r = codeRefIssues(
    [{ id: "n1", code_refs: ["src/profile.ts#Profile.declaredRoles"] }],
    fakeFs({ "src/profile.ts": ts })
  );
  assert.deepEqual(r, { hard: [], soft: [] });
});

test("a symbol with regex metacharacters is matched literally, not as a pattern", () => {
  // Unescaped, `get*` is the pattern "ge" + zero-or-more "t", which matches `ge`.
  const r = codeRefIssues(
    [{ id: "n1", code_refs: ["src/a.ts#Cache.get*"] }],
    fakeFs({ "src/a.ts": "class Cache { ge = 1; }\n" })
  );
  assert.equal(r.soft.length, 1, "`get*` must not match the substring `ge`");
});

test("a symbol containing an unbalanced bracket does not crash the probe", () => {
  // Unescaped, `on(` is an invalid regex and throws. In validate.mjs --all a throw
  // is swallowed by the fail-safe catch and the lint exits 0 — the rule silently
  // ceases to exist, which is the exact vacuity this track is closing.
  const r = codeRefIssues(
    [{ id: "n1", code_refs: ["src/a.ts#Handler.on("] }],
    fakeFs({ "src/a.ts": "class Handler { on(evt) {} }\n" })
  );
  assert.deepEqual(r, { hard: [], soft: [] });
});

test("relative code_ref paths resolve against baseDir when one is given", () => {
  const r = codeRefIssues(
    [{ id: "n1", code_refs: ["src/a.ts"] }],
    fakeFs({ "/proj/src/a.ts": "x" }),
    { baseDir: "/proj" }
  );
  assert.deepEqual(r, { hard: [], soft: [] });
});

test("an absolute code_ref path ignores baseDir", () => {
  const r = codeRefIssues(
    [{ id: "n1", code_refs: ["/elsewhere/a.ts"] }],
    fakeFs({ "/elsewhere/a.ts": "x" }),
    { baseDir: "/proj" }
  );
  assert.deepEqual(r, { hard: [], soft: [] });
});

test("importing status.mjs does not run its main()", () => {
  // validate.mjs imports codeRefIssues; if the CLI guard were loose, that import
  // would run a whole /vault-status pass (and could exit 1) on every lint.
  const statusPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "vault", "status.mjs");
  const r = spawnSync(process.execPath,
    ["-e", `import(${JSON.stringify(statusPath)}).then((m) => console.log("imported:" + typeof m.codeRefIssues))`],
    { encoding: "utf8" });
  assert.equal(r.status, 0, `${r.stdout || ""}${r.stderr || ""}`);
  assert.match(r.stdout, /imported:function/);
  assert.doesNotMatch(`${r.stdout}${r.stderr}`, /vault:status/, "main() must not have run");
});
