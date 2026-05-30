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

test("init.mjs scaffolds a vault, writes .vault.json, and lints clean", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-init-"));
  // init.mjs lives in SCRIPTS and reads skeleton/fragments relative to itself
  const r = run("init.mjs", dir, ["--name=Knowledge"]);
  assert.equal(r.code, 0, r.out);
  assert.ok(fs.existsSync(path.join(dir, "docs", "vault", ".vault.json")), ".vault.json written");
  assert.ok(fs.existsSync(path.join(dir, "docs", "vault", "Knowledge", "_meta", "index.md")), "router exists");
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, "docs", "vault", ".vault.json"), "utf8"));
  assert.equal(cfg.vaultName, "Knowledge");
  const lint = run("validate.mjs", dir, ["--all"]);
  assert.equal(lint.code, 0, lint.out);
});

test("init.mjs is idempotent and never clobbers existing vault content", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-init2-"));
  run("init.mjs", dir, ["--name=Knowledge"]);
  const marker = path.join(dir, "docs", "vault", "Knowledge", "concepts", "keep.md");
  fs.writeFileSync(marker, "preserve me");
  const r2 = run("init.mjs", dir, ["--name=Knowledge"]);
  assert.equal(r2.code, 0);
  assert.equal(fs.readFileSync(marker, "utf8"), "preserve me", "existing content preserved");
});

test("a learning node in _meta/learnings lints clean after a single map", () => {
  const dir = freshProjectWithVault();
  const learnDir = path.join(dir, "docs", "vault", "Knowledge", "_meta", "learnings");
  fs.mkdirSync(learnDir, { recursive: true });
  fs.writeFileSync(
    path.join(learnDir, "learning-prefer-stub-then-link.md"),
    [
      "---",
      "id: learning-prefer-stub-then-link",
      'title: "Stub relation targets before linking during bulk seeding"',
      "type: learning",
      "doc_class: learning",
      "learning_kind: strategy",
      'summary: "When seeding many related nodes, create stub targets first so rel_* links resolve on first write."',
      "status: draft",
      "learning_status: proposed",
      'adopted_in: ""',
      "provenance: inferred",
      'tags: ["area/meta", "class/learning"]',
      "updated: 2026-05-30",
      "rel_related: []",
      "---",
      "## Generalized insight",
      "",
      "Create relation targets as stubs before authoring nodes that link to them.",
      "",
      "## In-project evidence",
      "",
      "Seeding hit a missing-target error on rel_related.",
      "",
      "## Proposed plugin change",
      "",
      "A bulk-seed mode that two-passes: stubs then links.",
      "",
    ].join("\n")
  );
  assert.equal(run("index.mjs", dir).code, 0, "map should exit 0");
  const lint = run("validate.mjs", dir, ["--all"]);
  assert.equal(lint.code, 0, `lint should be clean:\n${lint.out}`);
  assert.match(lint.out, /0 hard/);
});

test("learn-sweep no-ops silently on a project with no vault", () => {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "sweep-bare-"));
  const r = run("learn-sweep.mjs", bare);
  assert.equal(r.code, 0);
  assert.equal(r.out.trim(), "");
});

test("learn-sweep emits a nudge when the vault has recent changes", () => {
  const dir = freshProjectWithVault(); // freshly copied skeleton -> recent mtimes, no git
  const r = run("learn-sweep.mjs", dir);
  assert.equal(r.code, 0);
  assert.match(r.out, /\/vault-learn/);
});

test("a single vault-map run leaves lint clean when a new domain is introduced", () => {
  const dir = freshProjectWithVault();
  // author one content node carrying a domain tag with no pre-existing sub-index
  fs.writeFileSync(
    path.join(dir, "docs", "vault", "Knowledge", "concepts", "c1.md"),
    [
      "---",
      "id: c1",
      "title: C1",
      "type: concept",
      "doc_class: knowledge",
      "summary: A node in the capture domain to exercise sub-index creation in one pass.",
      "status: draft",
      "provenance: inferred",
      'tags: ["domain/capture"]',
      "updated: 2026-05-30",
      "---",
      "# C1",
      "",
      "Body.",
      "",
    ].join("\n")
  );
  // ONE map run, then lint must be clean (no second map)
  assert.equal(run("index.mjs", dir).code, 0, "map should exit 0");
  const lint = run("validate.mjs", dir, ["--all"]);
  assert.equal(lint.code, 0, `lint should be clean after a single map:\n${lint.out}`);
  assert.match(lint.out, /0 hard/);
});

function writeLearning(dir, id, learning_status, evidence) {
  const ld = path.join(dir, "docs", "vault", "Knowledge", "_meta", "learnings");
  fs.mkdirSync(ld, { recursive: true });
  fs.writeFileSync(path.join(ld, `${id}.md`), [
    "---",
    `id: ${id}`,
    `title: "${id}"`,
    "type: learning",
    "doc_class: learning",
    "learning_kind: strategy",
    'summary: "A generalized, shareable claim."',
    "status: draft",
    `learning_status: ${learning_status}`,
    'adopted_in: ""',
    "provenance: inferred",
    'tags: ["area/meta", "class/learning"]',
    "updated: 2026-05-30",
    "rel_related: []",
    "---",
    "## Generalized insight",
    "",
    "Stub relation targets before linking.",
    "",
    "## In-project evidence",
    "",
    `${evidence}`,
    "",
    "## Proposed plugin change",
    "",
    "A two-pass bulk-seed mode.",
    "",
  ].join("\n"));
}

test("learnings export prints only proposed nodes, strips evidence, and stamps harvested", () => {
  const dir = freshProjectWithVault();
  writeLearning(dir, "learning-a", "proposed", "SECRET Acme evidence here.");
  writeLearning(dir, "learning-b", "harvested", "already harvested secret.");
  const r = run("learnings-export.mjs", dir);
  assert.equal(r.code, 0);
  assert.match(r.out, /learning-a/);            // proposed -> included
  assert.doesNotMatch(r.out, /learning-b/);     // already harvested -> excluded
  assert.doesNotMatch(r.out, /SECRET Acme/);    // evidence stripped
  // after a non-dry run, learning-a is now harvested
  const after = fs.readFileSync(path.join(dir, "docs", "vault", "Knowledge", "_meta", "learnings", "learning-a.md"), "utf8");
  assert.match(after, /learning_status: harvested/);
});

test("learnings export --dry-run does not stamp", () => {
  const dir = freshProjectWithVault();
  writeLearning(dir, "learning-c", "proposed", "evidence.");
  const r = run("learnings-export.mjs", dir, ["--dry-run"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /learning-c/);
  const after = fs.readFileSync(path.join(dir, "docs", "vault", "Knowledge", "_meta", "learnings", "learning-c.md"), "utf8");
  assert.match(after, /learning_status: proposed/); // unchanged
});

test("learnings export no-ops (prints nothing) when no vault", () => {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "learn-export-bare-"));
  const r = run("learnings-export.mjs", bare);
  assert.equal(r.code, 0);
  assert.equal(r.out.trim(), "");
});
