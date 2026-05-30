// scripts/vault/passes.mjs
import * as path from "node:path";
import {
  TYPES, DOC_CLASSES, STATUSES, PROVENANCES, DIATAXIS,
  REQUIRED_FIELDS, TYPE_DOC_CLASS, DECISION_REQUIRED_SECTIONS,
  REL_KEYS, DECISION_ONLY_RELS,
  TAG_NAMESPACES, DIATAXIS_BY_TYPE, STALE_AFTER_DAYS,
} from "./schema.mjs";

function basenameId(filePath) {
  return path.basename(filePath, ".md");
}

export function pass1Schema(filePath, parsed, ctx = {}) {
  const hard = [];
  const soft = [];
  const d = parsed.data || {};

  for (const field of REQUIRED_FIELDS) {
    const v = d[field];
    const empty = v === undefined || v === null || v === "" ||
      (Array.isArray(v) && v.length === 0);
    if (empty) hard.push(`missing required field: ${field}`);
  }

  if (d.id && d.id !== basenameId(filePath)) {
    hard.push(`id "${d.id}" does not match filename "${basenameId(filePath)}"`);
  }
  if (d.type && !TYPES.includes(d.type)) hard.push(`unknown type: ${d.type}`);
  if (d.doc_class && !DOC_CLASSES.includes(d.doc_class)) hard.push(`unknown doc_class: ${d.doc_class}`);
  if (d.status && !STATUSES.includes(d.status)) hard.push(`unknown status: ${d.status}`);
  if (d.provenance && !PROVENANCES.includes(d.provenance)) hard.push(`unknown provenance: ${d.provenance}`);
  if (d.diataxis && !DIATAXIS.includes(d.diataxis)) hard.push(`unknown diataxis: ${d.diataxis}`);

  // forced type -> doc_class consistency
  if (d.type && TYPE_DOC_CLASS[d.type] && d.doc_class && d.doc_class !== TYPE_DOC_CLASS[d.type]) {
    hard.push(`type:${d.type} requires doc_class:${TYPE_DOC_CLASS[d.type]} (got ${d.doc_class})`);
  }

  // MADR required sections on decision nodes
  if (d.type === "decision") {
    const body = ctx.body || "";
    for (const section of DECISION_REQUIRED_SECTIONS) {
      const re = new RegExp(`^##\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
      if (!re.test(body)) hard.push(`decision node missing required MADR section: ${section}`);
    }
  }

  return { hard, soft };
}

const WIKILINK = /\[\[([^\]]+)\]\]/;

export function pass2Structural(filePath, parsed, ctx = {}) {
  const hard = [];
  const soft = [];
  const d = parsed.data || {};
  const knownIds = ctx.knownIds || new Set();

  // nested mapping (e.g. a `relations:` object) is illegal
  if (Array.isArray(d.__nested__) && d.__nested__.length) {
    hard.push(`nested mapping not allowed in frontmatter: ${d.__nested__.join(", ")} (relations must be flat rel_* lists)`);
  }

  // unquoted wikilinks: scan raw frontmatter for `- [[...]]` without surrounding quotes
  const raw = parsed.raw || "";
  for (const line of raw.split("\n")) {
    const item = line.match(/^\s*-\s*(.*)$/);
    if (!item) continue;
    const val = item[1].trim();
    if (val.includes("[[") && !(val.startsWith('"') || val.startsWith("'"))) {
      hard.push(`unquoted wikilink in a list item: ${val} (must be - "[[id]]")`);
    }
  }

  const isDecision = d.type === "decision";
  for (const key of Object.keys(d)) {
    if (!key.startsWith("rel_")) continue;
    if (!REL_KEYS.includes(key)) {
      hard.push(`unknown rel_* key: ${key}`);
      continue;
    }
    if (DECISION_ONLY_RELS.includes(key) && !isDecision) {
      hard.push(`${key} is only allowed on decision nodes`);
    }
    const targets = Array.isArray(d[key]) ? d[key] : [d[key]];
    for (const t of targets) {
      const m = String(t).match(WIKILINK);
      if (!m) {
        hard.push(`relation ${key} value must be "[[id]]" format, got: ${t}`);
        continue;
      }
      const targetId = m[1].split("|")[0].trim();
      if (!knownIds.has(targetId)) {
        hard.push(`relation ${key} -> [[${targetId}]] resolves to no existing node`);
      }
    }
  }

  if (d.id && knownIds.has(d.id)) {
    hard.push(`duplicate id "${d.id}" (already used by another node)`);
  }

  return { hard, soft };
}

export function pass3Graph(filePath, parsed, ctx = {}) {
  const hard = [];
  const soft = [];
  const d = parsed.data || {};

  for (const tag of d.tags || []) {
    const ns = String(tag).split("/")[0];
    if (!TAG_NAMESPACES.includes(ns)) {
      soft.push(`unknown tag namespace: ${tag} (expected ${TAG_NAMESPACES.map((n) => n + "/*").join(", ")})`);
    }
  }

  if (d.updated && ctx.now) {
    const updated = Date.parse(d.updated);
    if (!Number.isNaN(updated)) {
      const days = (ctx.now - updated) / 86400000;
      if (days > STALE_AFTER_DAYS) soft.push(`updated is ${Math.floor(days)} days old (stale threshold ${STALE_AFTER_DAYS})`);
    }
  }

  if (d.diataxis && d.type && DIATAXIS_BY_TYPE[d.type] && !DIATAXIS_BY_TYPE[d.type].includes(d.diataxis)) {
    soft.push(`diataxis:${d.diataxis} is unusual for type:${d.type} (expected ${DIATAXIS_BY_TYPE[d.type].join(" or ")})`);
  }

  return { hard, soft };
}
