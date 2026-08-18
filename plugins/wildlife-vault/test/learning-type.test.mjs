import { test } from "node:test";
import assert from "node:assert/strict";
import { TYPES, DOC_CLASSES, CATEGORY_DIRS, CATEGORY_ORDER, TYPE_DOC_CLASS } from "../scripts/vault/schema.mjs";
import { buildColorGroups, hexToDecimal } from "../scripts/vault/colorize.mjs";
import { renderRouterCatalog } from "../scripts/vault/index.mjs";

test("learning is a registered type with forced doc_class, in _meta/learnings", () => {
  assert.ok(TYPES.includes("learning"));
  assert.ok(DOC_CLASSES.includes("learning"));
  // vault-learn writes to `<vaultRoot>/_meta/learnings/`; the router must say so.
  assert.equal(CATEGORY_DIRS.learning, "_meta/learnings");
  assert.ok(CATEGORY_ORDER.includes("learning"));
  assert.equal(TYPE_DOC_CLASS.learning, "learning");
});

test("learning has a magenta color group", () => {
  const g = buildColorGroups().find((x) => x.query === "tag:#class/learning");
  assert.ok(g, "learning color group exists");
  assert.equal(g.color.rgb, hexToDecimal("#E91E63"));
  assert.equal(g.color.rgb, 15277667);
});

test("router catalog points learning at the folder learning nodes are written to", () => {
  const rendered = renderRouterCatalog([{ type: "learning" }], ["index-by-type"]);
  assert.match(rendered, /^\| learning \| _meta\/learnings\/ \| .+ \| 1 \|$/m);
});

// The generalized guard: this is what protects the NEXT type someone adds.
// `learning` shipped in TYPES + CATEGORY_DIRS but never got a TYPE_ROLE entry,
// so the router printed `| learning | _meta/ | undefined |` to every fresh session.
test("rendered router catalog contains no undefined for ANY registered type", () => {
  const rendered = renderRouterCatalog([], []);
  assert.doesNotMatch(rendered, /undefined/,
    "every type in TYPES needs a CATEGORY_DIRS folder AND a TYPE_ROLE role");
});

test("every registered type renders a complete router row (folder + role + count)", () => {
  const rendered = renderRouterCatalog([], []);
  for (const t of TYPES) {
    const row = rendered.split("\n").find((l) => l.startsWith(`| ${t} |`));
    assert.ok(row, `no router row rendered for type "${t}"`);
    const cells = row.split("|").slice(1, -1).map((c) => c.trim());
    assert.equal(cells.length, 4, `router row for "${t}" has ${cells.length} cells: ${row}`);
    const [type, folder, role, count] = cells;
    assert.equal(type, t);
    assert.ok(folder.length > 1 && folder.endsWith("/") && folder !== "undefined/",
      `type "${t}" has no CATEGORY_DIRS folder (rendered: ${folder})`);
    assert.ok(role.length > 0 && role !== "undefined",
      `type "${t}" has no TYPE_ROLE entry (rendered: ${role})`);
    assert.equal(count, "0");
  }
});
