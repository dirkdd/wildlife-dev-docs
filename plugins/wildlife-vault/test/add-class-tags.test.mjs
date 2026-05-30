import { test } from "node:test";
import assert from "node:assert/strict";
import { addClassTag } from "../scripts/vault/add-class-tags.mjs";

const node = (tagsLine) => `---
id: x
title: X
type: concept
doc_class: knowledge
summary: A node.
status: draft
provenance: inferred
${tagsLine}
updated: 2026-05-30
---
# X
`;

test("adds class/<doc_class> to an inline tags array", () => {
  const r = addClassTag(node('tags: ["domain/capture"]'));
  assert.equal(r.changed, true);
  assert.match(r.content, /tags: \["domain\/capture", "class\/knowledge"\]/);
});

test("is idempotent when the class tag already present", () => {
  const r = addClassTag(node('tags: ["domain/capture", "class/knowledge"]'));
  assert.equal(r.changed, false);
});

test("seeds an empty tags array", () => {
  const r = addClassTag(node("tags: []"));
  assert.equal(r.changed, true);
  assert.match(r.content, /tags: \["class\/knowledge"\]/);
});

test("skips when doc_class is absent", () => {
  const raw = "---\nid: y\ntitle: Y\ntype: concept\ntags: [\"domain/x\"]\n---\n# Y\n";
  assert.equal(addClassTag(raw).changed, false);
});
