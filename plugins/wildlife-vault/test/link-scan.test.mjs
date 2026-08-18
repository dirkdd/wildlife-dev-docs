import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  danglingLinks,
  suggestClosest,
  readLinkAuditConfig,
  danglingLinkReport,
} from "../scripts/vault/link-scan.mjs";

const R = (...names) => new Set(names);

// ---------------------------------------------------------------------------
// danglingLinks — the pure pass. Every negative here is a measured
// false-positive class; each must stay silent.
// ---------------------------------------------------------------------------

test("a link that resolves is silent", () => {
  assert.deepEqual(danglingLinks("see [[ADR-0018]] for the schema", R("ADR-0018")), []);
});

test("an id-shaped link that resolves to nothing is reported", () => {
  assert.deepEqual(
    danglingLinks("linked [[learning-a-very-wrong-id]] here", R("learning-test-double")),
    ["learning-a-very-wrong-id"],
  );
});

test("a bash test expression is not a wikilink", () => {
  // FP guard 1+2: `[[ -z "$X" ]]` matches the wikilink regex exactly.
  const body = 'run `[[ -z "$X" ]] && echo empty` before the sweep';
  assert.deepEqual(danglingLinks(body, R()), []);
});

test("a bash test expression outside code fences is still not a wikilink", () => {
  assert.deepEqual(danglingLinks('if [[ -z "$X" ]]; then', R()), []);
});

test("a wikilink inside a fenced code block is silent", () => {
  const body = ["prose", "```md", "[[not-a-real-node]]", "```", "more prose"].join("\n");
  assert.deepEqual(danglingLinks(body, R()), []);
});

test("a human-readable title link is not a vault id and is skipped", () => {
  assert.deepEqual(danglingLinks("[[Some Readable Title]]", R()), []);
});

test("a path-shaped Obsidian link is skipped (slashes are not ids)", () => {
  assert.deepEqual(danglingLinks("[[docs/ADR/0001-foo]]", R()), []);
});

test("display text and heading anchors resolve against the id", () => {
  assert.deepEqual(danglingLinks("[[node-a|Node A]] and [[node-a#Section]]", R("node-a")), []);
});

test("an alias-only target resolves", () => {
  assert.deepEqual(danglingLinks("cite [[PRD]] here", R("PRD")), []);
});

test("an ignored prefix is silent", () => {
  assert.deepEqual(danglingLinks("[[cite.foo]] [[chart.bar]]", R(), ["cite.", "chart."]), []);
});

test("colon-bearing marker syntax never looked like an id", () => {
  assert.deepEqual(danglingLinks("[[cite:abc]] [[chart:xyz]]", R()), []);
});

test("every occurrence is returned so the caller can count references", () => {
  assert.deepEqual(danglingLinks("[[PRD]] then [[PRD]]", R()), ["PRD", "PRD"]);
});

// ---------------------------------------------------------------------------
// suggestClosest — the "did you mean" that finds the real observed bug.
// ---------------------------------------------------------------------------

test("suggests the closest known id by hyphen-token overlap", () => {
  const known = ["learning-test-double-is-a-constraint-claim", "web-topology-surface"];
  assert.equal(
    suggestClosest("learning-a-test-double-is-a-claim-about-the-real-systems-constraints", known),
    "learning-test-double-is-a-constraint-claim",
  );
});

test("suggests nothing when overlap is below the threshold", () => {
  assert.equal(suggestClosest("PRD", ["web-topology-surface", "vault-sync-one-way"]), null);
});

// ---------------------------------------------------------------------------
// config + driver
// ---------------------------------------------------------------------------

function tmpProject(cfg, files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-links-"));
  fs.mkdirSync(path.join(dir, "docs", "vault"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs", "vault", ".vault.json"), JSON.stringify(cfg));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

function node(id, extra = "", body = "") {
  return `---\nid: ${id}\ntitle: ${id}\ntype: concept\ndoc_class: knowledge\nsummary: s\nstatus: draft\nprovenance: inferred\ntags: [domain/x]\nupdated: 2026-08-16\n${extra}---\n\n${body}\n`;
}

const VAULT_CFG = { vaultRoot: "docs/vault/Knowledge", vaultName: "Knowledge" };

test("linkRoots defaults to the vault root only — an existing install sees no change", () => {
  const dir = tmpProject(VAULT_CFG);
  const cfg = readLinkAuditConfig(dir);
  assert.deepEqual(cfg.linkRoots, ["docs/vault/Knowledge"]);
  assert.deepEqual(cfg.linkIgnorePrefixes, []);
});

test("linkRoots and linkIgnorePrefixes are read from .vault.json", () => {
  const dir = tmpProject({ ...VAULT_CFG, linkRoots: ["docs"], linkIgnorePrefixes: ["cite."] });
  const cfg = readLinkAuditConfig(dir);
  assert.deepEqual(cfg.linkRoots, ["docs"]);
  assert.deepEqual(cfg.linkIgnorePrefixes, ["cite."]);
});

test("with the default roots, a broken link in a sprint doc outside the vault is invisible", () => {
  const dir = tmpProject(VAULT_CFG, {
    "docs/vault/Knowledge/concepts/a.md": node("a"),
    "docs/retro-sprint-10.md": "# Retro\n\nlinked [[learning-that-does-not-exist]]\n",
  });
  assert.deepEqual(danglingLinkReport(dir), []);
});

test("with linkRoots: [docs], the broken link outside the vault is caught and named", () => {
  const dir = tmpProject({ ...VAULT_CFG, linkRoots: ["docs"] }, {
    "docs/vault/Knowledge/concepts/learning-test-double-is-a-constraint-claim.md":
      node("learning-test-double-is-a-constraint-claim"),
    "docs/retro-sprint-10.md":
      "# Retro\n\nlinked [[learning-a-test-double-is-a-claim-about-the-real-systems-constraints]]\n",
  });
  const out = danglingLinkReport(dir);
  assert.equal(out.length, 1, out.join("\n"));
  assert.match(out[0], /dangling wikilink \[\[learning-a-test-double-is-a-claim-about-the-real-systems-constraints\]\]/);
  assert.match(out[0], /docs\/retro-sprint-10\.md/);
  assert.match(out[0], /did you mean \[\[learning-test-double-is-a-constraint-claim\]\]/);
});

test("a doc-to-doc link resolves by .md basename, like Obsidian itself", () => {
  const dir = tmpProject({ ...VAULT_CFG, linkRoots: ["docs"] }, {
    "docs/ADR/0001-foo.md": "# ADR\n\nsee [[kickoff-plan]]\n",
    "docs/kickoff-plan.md": "# Kickoff\n",
  });
  assert.deepEqual(danglingLinkReport(dir), []);
});

test("an alias declared in vault frontmatter resolves links written anywhere", () => {
  const dir = tmpProject({ ...VAULT_CFG, linkRoots: ["docs"] }, {
    "docs/vault/Knowledge/concepts/a.md": node("a", 'aliases: ["PRD", "The PRD"]\n'),
    "docs/notes.md": "see [[PRD]]\n",
  });
  assert.deepEqual(danglingLinkReport(dir), []);
});

test("an alias declared on a doc OUTSIDE the vault resolves (measured: 25 of 45 targets)", () => {
  // ADRs and trackers carry `aliases: [ADR-0004, ...]` in their own frontmatter
  // and every doc links them by alias. Reading aliases only from vault nodes
  // made 25 of 45 reported targets false positives on the real corpus.
  const dir = tmpProject({ ...VAULT_CFG, linkRoots: ["docs"] }, {
    "docs/ADR/0004-policy-file-schema.md":
      "---\naliases: [ADR-0004, Policy File Schema]\ntags: [adr]\n---\n\n# ADR-0004\n",
    "docs/tracker.md": "---\naliases: [Tracker]\n---\n\nscope: [[ADR-0004]]\n",
    "docs/notes.md": "see [[ADR-0004]] and [[Tracker]]\n",
  });
  assert.deepEqual(danglingLinkReport(dir), []);
});

test("occurrences are grouped by target, not listed one per reference", () => {
  const dir = tmpProject({ ...VAULT_CFG, linkRoots: ["docs"] }, {
    "docs/a.md": "[[missing-thing]] [[missing-thing]]\n",
    "docs/b.md": "[[missing-thing]]\n",
  });
  const out = danglingLinkReport(dir);
  assert.equal(out.length, 1);
  assert.match(out[0], /3 references across 2 files/);
});

test("skiplisted directories and non-markdown are not scanned", () => {
  const dir = tmpProject({ ...VAULT_CFG, linkRoots: ["."] }, {
    "node_modules/pkg/readme.md": "[[definitely-missing]]\n",
    "docs/vault/Knowledge/_raw/dump.md": "[[definitely-missing]]\n",
    "docs/script.sh": "[[definitely-missing]]\n",
  });
  assert.deepEqual(danglingLinkReport(dir), []);
});

test("no vault configured is a silent no-op", () => {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "vault-none-"));
  assert.deepEqual(danglingLinkReport(bare), []);
});

// THE SCAN ROOT AND THE RESOLUTION ROOT ARE NOT THE SAME QUESTION.
// "Which files do I check links in" is narrow by default (no churn for an
// existing install). "What counts as resolving" must be WIDE, because the two
// failure modes are not symmetric: under-resolving accuses a healthy link,
// over-resolving is merely silent. On a soft advisory gate, silence is the safe
// failure -- a gate that cries wolf gets switched off, and then it catches
// nothing at all. Measured on the real 152-node vault: 14 of 15 reported
// targets were ADRs declaring `aliases: [ADR-0018]` in docs/ADR/, outside the
// default scan root, and every one of them resolves in Obsidian.
test("an alias declared OUTSIDE the scan root still resolves the link", () => {
  const dir = tmpProject(VAULT_CFG, {
    "docs/vault/Knowledge/concepts/a.md": node("a", "", "See [[ADR-0018]]."),
    "docs/ADR/0018-workflow-json.md": "---\naliases: [ADR-0018, Workflow Schema]\n---\n\n# ADR-0018\n",
  });
  assert.deepEqual(danglingLinkReport(dir), []);
});

test("a link resolving to a file basename outside the scan root is not dangling", () => {
  const dir = tmpProject(VAULT_CFG, {
    "docs/vault/Knowledge/concepts/a.md": node("a", "", "See [[memory-architecture]]."),
    "docs/memory-architecture.md": "# Memory architecture\n",
  });
  assert.deepEqual(danglingLinkReport(dir), []);
});

test("widening resolution does NOT silence a link that resolves nowhere", () => {
  const dir = tmpProject(VAULT_CFG, {
    "docs/vault/Knowledge/concepts/a.md": node("a", "", "See [[PRD]]."),
    "docs/WA-PRD-001 the actual prd.md": "# The PRD\n\nNo aliases declared.\n",
  });
  const out = danglingLinkReport(dir);
  assert.equal(out.length, 1, `expected the true positive to survive:\n${out.join("\n")}`);
  assert.match(out[0], /\[\[PRD\]\]/);
});

test("linkResolveRoots is configurable and narrows resolution when set", () => {
  const files = {
    "docs/vault/Knowledge/concepts/a.md": node("a", "", "See [[ADR-0018]]."),
    "docs/ADR/0018-workflow-json.md": "---\naliases: [ADR-0018]\n---\n\n# ADR-0018\n",
  };
  assert.deepEqual(danglingLinkReport(tmpProject(VAULT_CFG, files)), [], "wide by default");
  const narrowed = tmpProject({ ...VAULT_CFG, linkResolveRoots: ["docs/vault/Knowledge"] }, files);
  assert.equal(danglingLinkReport(narrowed).length, 1, "an explicit narrow root is honoured");
});
