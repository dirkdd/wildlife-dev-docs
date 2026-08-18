import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  proseClaimIssues,
  makeExistsFn,
  proseClaimReport,
} from "../scripts/vault/prose-claims.mjs";

// A filesystem stand-in: only these paths exist.
const existing = (...paths) => {
  const set = new Set(paths);
  return (tok) => (set.has(tok) ? tok : null);
};
const nothingExists = () => null;

// ---------------------------------------------------------------------------
// TRUE POSITIVES — the sentence names a path and the filesystem contradicts it.
// ---------------------------------------------------------------------------

test("a false 'does not exist yet' claim about a real path fires", () => {
  const hits = proseClaimIssues(
    "The generated `packages/wire/dist/wire.ts` does not exist yet.",
    existing("packages/wire/dist/wire.ts"),
  );
  assert.equal(hits.length, 1);
  assert.equal(hits[0].claimed, "packages/wire/dist/wire.ts");
  assert.equal(hits[0].phrase, "does not exist");
  assert.equal(hits[0].line, 1);
});

test("'is a scaffold today' about a real directory fires through one filler word", () => {
  const hits = proseClaimIssues("The `apps/api` surface is a scaffold today.", existing("apps/api"));
  assert.equal(hits.length, 1);
  assert.equal(hits[0].claimed, "apps/api");
});

test("a chained subject reports every span in the chain", () => {
  const hits = proseClaimIssues(
    "`packages/a/b.ts` and `packages/c/d.ts` do not exist.",
    existing("packages/a/b.ts", "packages/c/d.ts"),
  );
  assert.deepEqual(hits.map((h) => h.claimed), ["packages/a/b.ts", "packages/c/d.ts"]);
});

test("'not yet in code' fires and reports its line number", () => {
  const hits = proseClaimIssues(
    "intro\n\nThe adapter `packages/core/src/harness/adapters/base.py` is not yet in code.",
    existing("packages/core/src/harness/adapters/base.py"),
  );
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 3);
});

test("a shorthand path resolved by suffix reports BOTH the claim and the resolution", () => {
  const hits = proseClaimIssues(
    "`dist/wire.ts` does not exist.",
    (tok) => (tok === "dist/wire.ts" ? "packages/wire/dist/wire.ts" : null),
  );
  assert.equal(hits.length, 1);
  assert.equal(hits[0].claimed, "dist/wire.ts");
  assert.equal(hits[0].resolved, "packages/wire/dist/wire.ts");
});

// ---------------------------------------------------------------------------
// TRUE NEGATIVES — each one is a measured false-positive class. The first is
// the one that decides whether this rule survives contact.
// ---------------------------------------------------------------------------

test("THE LOAD-BEARING NEGATIVE: a true claim about a path that really is absent is silent", () => {
  assert.deepEqual(
    proseClaimIssues("`packages/multiworker` does not exist yet — it is Sprint 12 work.", nothingExists),
    [],
  );
});

test("a claim whose subject is a bare symbol is silent even with a real path nearby", () => {
  assert.deepEqual(
    proseClaimIssues("`derive_bundle` does not exist in `apps/api`.", existing("apps/api", "derive_bundle")),
    [],
  );
});

test("a path in a different clause from the phrase is not the claim's subject", () => {
  assert.deepEqual(
    proseClaimIssues(
      "Nothing in `apps/api` drives the bundle, so multi-worker enforcement does not exist yet.",
      existing("apps/api"),
    ),
    [],
  );
});

test("a claim inside a fenced code block is a sample, not an assertion", () => {
  const body = ["```md", "`apps/api` does not exist yet", "```"].join("\n");
  assert.deepEqual(proseClaimIssues(body, existing("apps/api")), []);
});

test("an inline opt-out comment silences the line", () => {
  assert.deepEqual(
    proseClaimIssues(
      "`apps/api` does not exist yet. <!-- vault-ok: prose-claim -->",
      existing("apps/api"),
    ),
    [],
  );
});

test("a past-tense framing is a historical record, not a live claim", () => {
  assert.deepEqual(
    proseClaimIssues("Previously `apps/api` did not exist; it landed in Sprint 8.", existing("apps/api")),
    [],
  );
  assert.deepEqual(
    proseClaimIssues("`apps/api` no longer does not exist.", existing("apps/api")),
    [],
  );
});

test("struck-through text is an already-closed row", () => {
  assert.deepEqual(
    proseClaimIssues("~~`apps/api` does not exist yet~~ **CLOSED** in Sprint 9.", existing("apps/api")),
    [],
  );
});

test("a glob is not a path claim", () => {
  assert.deepEqual(proseClaimIssues("`apps/*/api` does not exist.", () => "apps/*/api"), []);
});

test("a URL is not a path claim", () => {
  assert.deepEqual(proseClaimIssues("`https://example.com/x` does not exist.", () => "x"), []);
});

test("prose with no code span cannot fire", () => {
  assert.deepEqual(proseClaimIssues("SCIM is unbuilt and the outbox does not exist yet.", () => "anything"), []);
});

// ---------------------------------------------------------------------------
// makeExistsFn — exact first, then suffix, because docs write shorthand.
// ---------------------------------------------------------------------------

function tmpRepo(files, cfg) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-prose-"));
  fs.mkdirSync(path.join(dir, "docs", "vault"), { recursive: true });
  if (cfg !== null) {
    fs.writeFileSync(path.join(dir, "docs", "vault", ".vault.json"),
      JSON.stringify(cfg ?? { vaultRoot: "docs/vault/Knowledge", vaultName: "Knowledge" }));
  }
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

test("makeExistsFn resolves an exact path, a directory, and a suffix shorthand", () => {
  const dir = tmpRepo({ "packages/wire/dist/wire.ts": "x" });
  const ex = makeExistsFn(dir);
  assert.equal(ex("packages/wire/dist/wire.ts"), "packages/wire/dist/wire.ts");
  assert.equal(ex("packages/wire"), "packages/wire");
  assert.equal(ex("dist/wire.ts"), "packages/wire/dist/wire.ts");
  assert.equal(ex("packages/nope/gone.ts"), null);
});

// ---------------------------------------------------------------------------
// proseClaimReport — node-level exemptions and the kill switch.
// ---------------------------------------------------------------------------

function node(id, over = {}, body = "") {
  const f = {
    id, title: id, type: "concept", doc_class: "knowledge", summary: "s",
    status: "draft", provenance: "inferred", tags: "[domain/x]", updated: "2026-08-16",
    ...over,
  };
  const fm = Object.entries(f).map(([k, v]) => `${k}: ${v}`).join("\n");
  return `---\n${fm}\n---\n\n${body}\n`;
}

const CLAIM = "The `apps/api` surface does not exist yet.";

test("a normal node with a contradicted claim is reported with its id and line", () => {
  const dir = tmpRepo({
    "apps/api/main.py": "x",
    "docs/vault/Knowledge/concepts/a.md": node("a", {}, CLAIM),
  });
  const out = proseClaimReport(dir);
  assert.equal(out.length, 1, out.join("\n"));
  // the reported line must point at the claim in the FILE, not in the body
  const content = fs.readFileSync(path.join(dir, "docs/vault/Knowledge/concepts/a.md"), "utf8");
  const claimLine = content.split("\n").findIndex((l) => l.includes("does not exist")) + 1;
  assert.ok(claimLine > 1);
  assert.match(out[0], new RegExp(`concepts/a\\.md:${claimLine}\\b`));
  assert.match(out[0], /does not exist/);
  assert.match(out[0], /apps\/api/);
});

test("a decision node is exempt — an ADR's Context is a dated record of its world", () => {
  const dir = tmpRepo({
    "apps/api/main.py": "x",
    "docs/vault/Knowledge/decisions/d.md": node("d", { type: "decision", doc_class: "adr" }, CLAIM),
  });
  assert.deepEqual(proseClaimReport(dir), []);
});

test("a learning node is exempt — meta-nodes quote the claim vocabulary", () => {
  const dir = tmpRepo({
    "apps/api/main.py": "x",
    "docs/vault/Knowledge/_meta/learnings/l.md": node("l", { type: "learning", doc_class: "learning" }, CLAIM),
  });
  assert.deepEqual(proseClaimReport(dir), []);
});

test("a deprecated node is exempt", () => {
  const dir = tmpRepo({
    "apps/api/main.py": "x",
    "docs/vault/Knowledge/concepts/a.md": node("a", { status: "deprecated" }, CLAIM),
  });
  assert.deepEqual(proseClaimReport(dir), []);
});

test("proseClaims: false in .vault.json switches the probe off entirely", () => {
  const dir = tmpRepo({
    "apps/api/main.py": "x",
    "docs/vault/Knowledge/concepts/a.md": node("a", {}, CLAIM),
  }, { vaultRoot: "docs/vault/Knowledge", vaultName: "Knowledge", proseClaims: false });
  assert.deepEqual(proseClaimReport(dir), []);
});

test("no vault configured is a silent no-op", () => {
  const dir = tmpRepo({}, null);
  assert.deepEqual(proseClaimReport(dir), []);
});

test("a vault whose claims are all true stays completely quiet", () => {
  const dir = tmpRepo({
    "docs/vault/Knowledge/concepts/a.md": node("a", {},
      "The `packages/multiworker` package does not exist yet.\nSCIM is unbuilt.\n"),
  });
  assert.deepEqual(proseClaimReport(dir), []);
});
