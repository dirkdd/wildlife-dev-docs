import { test } from "node:test";
import assert from "node:assert/strict";
import { stripEvidence, proprietarySignals, composeDigest, stampHarvested } from "../scripts/vault/learnings-export.mjs";

const BODY = [
  "## Generalized insight",
  "",
  "Stub relation targets before linking.",
  "",
  "## In-project evidence",
  "",
  "Acme Corp seeding hit an error on rel_related at /Users/dirk/proj.",
  "",
  "## Proposed plugin change",
  "",
  "A two-pass bulk-seed mode.",
  "",
].join("\n");

test("stripEvidence removes exactly the In-project evidence section", () => {
  const out = stripEvidence(BODY);
  assert.match(out, /Generalized insight/);
  assert.match(out, /Proposed plugin change/);
  assert.doesNotMatch(out, /In-project evidence/);
  assert.doesNotMatch(out, /Acme Corp/);
  assert.doesNotMatch(out, /\/Users\/dirk/);
});

test("stripEvidence handles evidence as the last section", () => {
  const b = "## Generalized insight\n\nX.\n\n## In-project evidence\n\nsecret.\n";
  const out = stripEvidence(b);
  assert.match(out, /Generalized insight/);
  assert.doesNotMatch(out, /secret/);
});

test("proprietarySignals flags emails, urls, paths, proper nouns", () => {
  assert.ok(proprietarySignals("contact a@b.com").length > 0);
  assert.ok(proprietarySignals("see https://x.io/y").length > 0);
  assert.ok(proprietarySignals("at /Users/dirk/proj").length > 0);
  assert.ok(proprietarySignals("Acme Breeding Corp did it").length > 0);
});

test("proprietarySignals ignores clean generalized text", () => {
  assert.deepEqual(proprietarySignals("stub relation targets before linking them"), []);
});

test("composeDigest includes generalized payload and excludes evidence", () => {
  const nodes = [{
    data: { id: "learning-x", title: "X", learning_kind: "strategy", summary: "Generalized claim." },
    body: BODY,
  }];
  const out = composeDigest(nodes);
  assert.match(out, /learning-x/);
  assert.match(out, /strategy/);
  assert.match(out, /Generalized claim\./);
  assert.match(out, /A two-pass bulk-seed mode\./);
  assert.doesNotMatch(out, /Acme Corp/);   // evidence (the only proprietary text) is excluded
});

test("composeDigest warns when the harvestable text itself carries a signal", () => {
  const nodes = [{
    data: { id: "learning-y", title: "Y", learning_kind: "strategy", summary: "Claim referencing Acme Corp." },
    body: "## Generalized insight\n\nClean insight.\n\n## In-project evidence\n\nsecret.\n",
  }];
  const out = composeDigest(nodes);
  assert.match(out, /Possible proprietary signals/); // signal is in the summary, not the stripped evidence
});

test("stampHarvested flips proposed to harvested once, idempotent", () => {
  const raw = "---\nid: learning-x\ntype: learning\nlearning_status: proposed\n---\nbody\n";
  const once = stampHarvested(raw);
  assert.match(once, /learning_status: harvested/);
  assert.doesNotMatch(once, /learning_status: proposed/);
  assert.equal(stampHarvested(once), once); // idempotent: already harvested -> unchanged
});
