import { test } from "node:test";
import assert from "node:assert/strict";
import { buildColorGroups, hexToDecimal } from "../scripts/vault/colorize.mjs";

test("color groups query by class tag, not by frontmatter property", () => {
  const groups = buildColorGroups();
  for (const g of groups) {
    assert.match(g.query, /^tag:#class\//, `query should be tag-based: ${g.query}`);
    assert.equal(typeof g.color.rgb, "number");
    assert.equal(g.color.a, 1);
  }
  // adr is red #E74C3C -> 15158332 decimal
  const adr = groups.find((g) => g.query === "tag:#class/adr");
  assert.ok(adr, "adr group exists");
  assert.equal(adr.color.rgb, hexToDecimal("#E74C3C"));
  assert.equal(adr.color.rgb, 15158332);
});
