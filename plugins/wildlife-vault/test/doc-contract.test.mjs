// test/doc-contract.test.mjs
//
// The shipped documents are a contract, not decoration. skeleton/_meta/schema-spec.md
// is copied verbatim into every consuming project and calls itself "the human-readable
// contract"; the skills and docs/ files are what an agent reads before authoring.
//
// These tests keep those documents TRUE against the code that ships alongside them:
//   - the enums and folder table cannot drift from schema.mjs;
//   - a rule listed as "enforced today" must actually fire when probed;
//   - a rule listed as "not yet enforced" must actually be absent from the code;
//   - the guidance sentences that carry a rule cannot be silently deleted.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TYPES, DOC_CLASSES, CATEGORY_DIRS, STALE_AFTER_DAYS,
} from "../scripts/vault/schema.mjs";
import { pass3Graph } from "../scripts/vault/passes.mjs";

const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(PLUGIN, rel), "utf-8");

const SPEC = read("skeleton/Knowledge/_meta/schema-spec.md");
const PASSES_SRC = read("scripts/vault/passes.mjs");
const VALIDATE_SRC = read("scripts/vault/validate.mjs");
const STATUS_SRC = read("scripts/vault/status.mjs");
const SCRIPTS_SRC = fs
  .readdirSync(path.join(PLUGIN, "scripts/vault"))
  .filter((f) => f.endsWith(".mjs"))
  .map((f) => read(path.join("scripts/vault", f)))
  .join("\n");

// --- helpers ---------------------------------------------------------------

function sectionBody(doc, heading) {
  const lines = doc.split("\n");
  const start = lines.findIndex((l) => l.trim() === heading);
  assert.notEqual(start, -1, `schema-spec.md is missing the heading: ${heading}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##\s/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

// Rule bullets are `- \`rule-id\` — prose`.
function ruleIds(body) {
  return [...body.matchAll(/^-\s+`([a-z0-9-]+)`/gm)].map((m) => m[1]);
}

function fenceAfter(doc, heading) {
  const body = sectionBody(doc, heading);
  const m = body.match(/```\n([\s\S]*?)\n```/);
  assert.ok(m, `no code fence under ${heading}`);
  return m[1];
}

const ENFORCED_HEADING = "## Soft Warnings — Enforced Today (Exit 0)";
const ROADMAP_HEADING = "## Not Yet Enforced (Roadmap)";

// --- 1. enums and folders cannot drift from schema.mjs ---------------------

test("schema-spec type enum matches schema.mjs TYPES exactly", () => {
  const listed = fenceAfter(SPEC, "## Type Enum").split("|").map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(listed, TYPES);
});

test("schema-spec folder table matches CATEGORY_DIRS for every type", () => {
  const body = sectionBody(SPEC, "## Type Enum");
  const rows = new Map(
    [...body.matchAll(/^\|\s*([a-z]+)\s*\|\s*`([^`]+)`\s*\|/gm)].map((m) => [m[1], m[2]]),
  );
  for (const t of TYPES) {
    assert.equal(rows.get(t), `${CATEGORY_DIRS[t]}/`, `folder row wrong or missing for type ${t}`);
  }
});

test("schema-spec doc_class enum matches schema.mjs DOC_CLASSES exactly", () => {
  const listed = fenceAfter(SPEC, "## Doc Class Enum").split("|").map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(listed, DOC_CLASSES);
});

test("schema-spec quotes the live staleness threshold", () => {
  assert.match(SPEC, new RegExp(`${STALE_AFTER_DAYS} days`));
});

test("schema-spec describes graph colors as tag-based, matching colorize.mjs", () => {
  assert.ok(SPEC.includes("tag:#class/"), "schema-spec must describe tag-based graph color groups");
  assert.ok(!/doc_class:"/.test(SPEC), "schema-spec still claims property-based graph queries");
  assert.ok(read("scripts/vault/colorize.mjs").includes("tag:#class/"), "colorize.mjs no longer emits tag queries");
});

test("schema-spec lists the learning-only field enums iff schema.mjs declares them", async () => {
  const schema = await import("../scripts/vault/schema.mjs");
  const declared = ["LEARNING_KINDS", "LEARNING_STATUSES"].filter((k) => Array.isArray(schema[k]));
  for (const key of declared) {
    for (const value of schema[key]) {
      assert.ok(SPEC.includes(value), `schema.mjs declares ${key} value "${value}"; schema-spec.md does not list it`);
    }
  }
});

// --- 2. every "enforced today" rule actually fires -------------------------

// Whole-vault rules are not passes: they are wired by hand into validate.mjs's
// --all branch. A rule is enforced iff its entry point is imported there.
const WHOLE_VAULT_RULES = {
  "code-ref": "codeRefIssues",
  "prose-claim": "proseClaimReport",
  "dangling-link": "danglingLinkReport",
};
const wired = (id) => VALIDATE_SRC.includes(WHOLE_VAULT_RULES[id]);

// Each probe returns a non-empty array iff the rule is really implemented.
const ENFORCED_PROBES = {
  "tag-namespace": () => pass3Graph("n.md", { data: { tags: ["nope/x"] } }, {}).soft,
  "stale-updated": () => pass3Graph("n.md", { data: { updated: "2000-01-01" } }, { now: Date.now() }).soft,
  "diataxis-mismatch": () => pass3Graph("n.md", { data: { type: "runbook", diataxis: "tutorial" } }, {}).soft,
  ...Object.fromEntries(Object.keys(WHOLE_VAULT_RULES).map((id) => [id, () => (wired(id) ? ["wired into --all"] : [])])),
};

test("every rule listed as enforced today actually fires when probed", () => {
  const ids = ruleIds(sectionBody(SPEC, ENFORCED_HEADING));
  assert.ok(ids.length > 0, "the enforced-today section lists no rules");
  for (const id of ids) {
    const probe = ENFORCED_PROBES[id];
    assert.ok(probe, `schema-spec claims rule "${id}" is enforced but this test has no probe for it`);
    assert.ok(probe().length > 0, `schema-spec claims "${id}" is enforced, but nothing in the code implements it`);
  }
});

// --- 3. every "roadmap" rule really is absent from the code ---------------

// Each probe returns true iff the rule is genuinely NOT implemented.
const ROADMAP_ABSENT = {
  "orphan-node": () => !/orphanNodes|no inbound or outbound/.test(PASSES_SRC + VALIDATE_SRC),
  "stored-inverse-edge": () => !/INVERSE_RELS/.test(PASSES_SRC + VALIDATE_SRC),
  "provenance-mix": () => !/provenance[- ]mix/i.test(PASSES_SRC + VALIDATE_SRC),
  "relations-drift": () => !/##\s*Relations/.test(PASSES_SRC + VALIDATE_SRC),
  "vault-lint-disable": () => !SCRIPTS_SRC.includes("vault_lint_disable"),
  ...Object.fromEntries(Object.keys(WHOLE_VAULT_RULES).map((id) => [id, () => !wired(id)])),
};

test("every rule listed as not-yet-enforced really is absent from the code", () => {
  const ids = ruleIds(sectionBody(SPEC, ROADMAP_HEADING));
  assert.ok(ids.length > 0, "the roadmap section lists no rules");
  for (const id of ids) {
    const probe = ROADMAP_ABSENT[id];
    assert.ok(probe, `schema-spec defers rule "${id}" but this test has no absence probe for it`);
    assert.ok(probe(), `schema-spec calls "${id}" unimplemented, but the code now implements it — promote the bullet`);
  }
});

test("no rule is listed in both the enforced and the roadmap section", () => {
  const enforced = new Set(ruleIds(sectionBody(SPEC, ENFORCED_HEADING)));
  for (const id of ruleIds(sectionBody(SPEC, ROADMAP_HEADING))) {
    assert.ok(!enforced.has(id), `rule "${id}" is listed as both enforced and unenforced`);
  }
});

// This is what keeps the soft-warning list EXHAUSTIVE as rules land: a whole-vault
// rule wired into --all must be listed as enforced, and one that is not wired must
// be listed as roadmap. Neither section can quietly fall behind the code.
for (const id of Object.keys(WHOLE_VAULT_RULES)) {
  test(`the ${id} rule is filed under whichever section the code makes true`, () => {
    const on = wired(id);
    const inEnforced = ruleIds(sectionBody(SPEC, ENFORCED_HEADING)).includes(id);
    const inRoadmap = ruleIds(sectionBody(SPEC, ROADMAP_HEADING)).includes(id);
    assert.equal(inEnforced, on, on
      ? `lint now runs ${WHOLE_VAULT_RULES[id]} — schema-spec must list ${id} as enforced`
      : `lint does not run ${WHOLE_VAULT_RULES[id]} — schema-spec must not claim ${id} is enforced`);
    assert.equal(inRoadmap, !on, `${id} must appear in exactly one of the two sections`);
  });
}

test("vault_lint_disable is not advertised as a working escape hatch", () => {
  if (SCRIPTS_SRC.includes("vault_lint_disable")) return; // implemented -> document it freely
  const inSpec = (SPEC.match(/vault_lint_disable/g) || []).length;
  if (inSpec === 0) return; // cut entirely is also fine
  const inRoadmap = (sectionBody(SPEC, ROADMAP_HEADING).match(/vault_lint_disable/g) || []).length;
  assert.equal(inRoadmap, inSpec,
    "schema-spec mentions vault_lint_disable outside the roadmap section, but no script reads it");
});

// --- 4. /vault-lint's own advertising matches the contract ----------------

test("the vault-lint skill advertises exactly the enforced soft warnings", () => {
  const skill = read("skills/vault-lint/SKILL.md");
  const bullet = skill.split("\n").find((l) => l.startsWith("- Soft warnings"));
  assert.ok(bullet, "vault-lint SKILL.md has no soft-warnings bullet");

  for (const id of ruleIds(sectionBody(SPEC, ENFORCED_HEADING))) {
    assert.ok(bullet.includes(id), `vault-lint SKILL.md omits the enforced rule "${id}"`);
  }
  for (const id of ruleIds(sectionBody(SPEC, ROADMAP_HEADING))) {
    assert.ok(!bullet.includes(id), `vault-lint SKILL.md advertises "${id}", which lint does not check`);
  }
  for (const fiction of ["orphans", "provenance-mix"]) {
    assert.ok(!bullet.includes(fiction), `vault-lint SKILL.md still advertises "${fiction}"`);
  }
});

test("the vault-link skill documents the dangling-link audit iff link-scan supports it", () => {
  const supported = read("scripts/vault/link-scan.mjs").includes('"--dangling"');
  const skill = read("skills/vault-link/SKILL.md");
  assert.equal(skill.includes("--dangling"), supported,
    supported
      ? "link-scan.mjs has a --dangling mode that /vault-link never mentions"
      : "the vault-link skill documents a --dangling mode link-scan.mjs does not have");
});

// --- 5. the guidance sentences that carry a rule --------------------------

const GUIDANCE = [
  ["skills/vault-author/SKILL.md", "A green test suite is not verification."],
  ["skills/vault-author/SKILL.md", "did its test actually execute rather than skip or sit outside CI"],
  ["skills/vault-author/SKILL.md", 'NOT BUILT — nothing calls this today'],
  ["skills/vault-author/SKILL.md", "homes preserve the idea, only a row carries the date"],
  ["skills/vault-author/SKILL.md", 'tags: ["domain/x", "audience/y", "class/knowledge"]'],
  ["skills/vault-author/templates/decision.md", "NOT YET BUILT"],
  ["skills/vault-author/templates/decision.md", "this record cannot make anything come due"],
  ["docs/seed-from-prd.md", "## Seeding in parallel"],
  ["docs/seed-from-prd.md", "Publish the registry before anyone writes"],
  ["docs/seed-from-prd.md", "Backfill **one edit at a time**"],
  ["docs/seed-from-prd.md", "A `proposed` node preserves the question; it does not schedule it."],
  ["docs/STANDARD.md", "`verified` means someone opened the code and saw it, not that a test was green"],
  ["skills/vault-evolve/SKILL.md", "Tier 1 — per-file rules"],
  ["skills/vault-evolve/SKILL.md", "Tier 2 — whole-vault rules"],
  ["skills/vault-evolve/SKILL.md", "A rule that throws is a rule that silently does not exist."],
  ["skills/vault-evolve/SKILL.md", "the biggest proposals are the ones that vanish"],
];

for (const [file, sentence] of GUIDANCE) {
  test(`${file} still carries: ${sentence.slice(0, 48)}`, () => {
    assert.ok(read(file).includes(sentence), `${file} lost the guidance sentence: ${sentence}`);
  });
}

// --- 6. cohort staleness: the doc states the truth about the code ---------

test("the cohort-staleness note matches whether the cohort report exists", () => {
  const std = read("docs/STANDARD.md");
  assert.ok(std.includes("Staleness: the threshold and the cohort"),
    "docs/STANDARD.md does not document the cohort approach to staleness");
  const implemented = /export function stalestCohort/.test(STATUS_SRC);
  const claimsImplemented = std.includes("`/vault-status` prints this cohort");
  const claimsPending = std.includes("Not yet mechanised");
  assert.equal(claimsImplemented, implemented,
    implemented
      ? "stalestCohort now exists — STANDARD.md must say /vault-status prints the cohort"
      : "stalestCohort does not exist — STANDARD.md must not claim /vault-status prints the cohort");
  assert.equal(claimsPending, !implemented, "the cohort note must state exactly one status");
});

test("the cohort note explains why the absolute threshold cannot fire", () => {
  const std = read("docs/STANDARD.md");
  assert.ok(std.includes("a coherent cohort seeded on one day sits far inside the threshold"),
    "STANDARD.md does not explain the failure mode the threshold cannot catch");
});

// --- 7. the release is versioned and changelogged -------------------------

test("plugin.json version has a matching changelog entry", () => {
  const version = JSON.parse(read(".claude-plugin/plugin.json")).version;
  const changelog = read("docs/CHANGELOG.md");
  assert.ok(changelog.includes(`## ${version}`), `docs/CHANGELOG.md has no entry for version ${version}`);
});

test("the changelog only cites script files that exist", () => {
  const cited = new Set([...read("docs/CHANGELOG.md").matchAll(/scripts\/vault\/[\w-]+\.mjs/g)].map((m) => m[0]));
  for (const rel of cited) {
    assert.ok(fs.existsSync(path.join(PLUGIN, rel)), `docs/CHANGELOG.md cites ${rel}, which does not exist`);
  }
});

test("the README points at the changelog", () => {
  assert.ok(read("README.md").includes("docs/CHANGELOG.md"), "README.md does not link the changelog");
});
