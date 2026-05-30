import { test } from "node:test";
import assert from "node:assert/strict";
import { nudgeMessage } from "../scripts/vault/learn-sweep.mjs";

test("no nudge when nothing changed", () => {
  assert.equal(nudgeMessage([]), null);
});

test("nudge names the count and points at /vault-learn", () => {
  const msg = nudgeMessage(["a.md", "b.md"]);
  assert.match(msg, /2 vault nodes/);
  assert.match(msg, /\/vault-learn/);
});

test("singular phrasing for one file", () => {
  assert.match(nudgeMessage(["a.md"]), /1 vault node\b/);
});
