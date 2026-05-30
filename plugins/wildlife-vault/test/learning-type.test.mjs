import { test } from "node:test";
import assert from "node:assert/strict";
import { TYPES, DOC_CLASSES, CATEGORY_DIRS, CATEGORY_ORDER, TYPE_DOC_CLASS } from "../scripts/vault/schema.mjs";
import { buildColorGroups, hexToDecimal } from "../scripts/vault/colorize.mjs";

test("learning is a registered type with forced doc_class, in _meta", () => {
  assert.ok(TYPES.includes("learning"));
  assert.ok(DOC_CLASSES.includes("learning"));
  assert.equal(CATEGORY_DIRS.learning, "_meta");
  assert.ok(CATEGORY_ORDER.includes("learning"));
  assert.equal(TYPE_DOC_CLASS.learning, "learning");
});

test("learning has a magenta color group", () => {
  const g = buildColorGroups().find((x) => x.query === "tag:#class/learning");
  assert.ok(g, "learning color group exists");
  assert.equal(g.color.rgb, hexToDecimal("#E91E63"));
  assert.equal(g.color.rgb, 15277667);
});
