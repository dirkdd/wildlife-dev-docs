// scripts/vault/parse-frontmatter.mjs
// Zero-dependency frontmatter extractor + flat-YAML parser for the vault contract.

function stripScalar(v) {
  let s = v.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s;
}

function parseInlineArray(v) {
  // v looks like: [a, "b", 'c']
  const inner = v.trim().slice(1, -1).trim();
  if (!inner) return [];
  const tokens = inner.match(/(?:[^,"']+|"[^"]*"|'[^']*')+/g) ?? [];
  return tokens.map((x) => stripScalar(x)).filter((x) => x.length > 0);
}

export function parseFrontmatter(input) {
  let text = String(input).replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) {
    return { ok: false, error: "missing YAML frontmatter (--- ... ---)" };
  }
  const fenceRe = /\n---(?:\n|$)/;
  const m = fenceRe.exec(text.slice(3));
  const end = m ? (3 + m.index) : -1;
  if (end === -1) {
    return { ok: false, error: "unterminated YAML frontmatter" };
  }
  const raw = text.slice(4, end + 1); // text between the fences (without the opening ---\n)
  const body = text.slice(end + 4).replace(/^\n/, "");

  const data = {};
  const nested = [];
  const lines = raw.split("\n");
  let currentListKey = null;

  for (const line of lines) {
    if (line.trim() === "") continue;

    const listItem = line.match(/^(\s+)-\s+(.*)$/);
    if (listItem && currentListKey) {
      data[currentListKey].push(stripScalar(listItem[2]));
      continue;
    }

    const indentedKey = line.match(/^\s+([A-Za-z0-9_-]+):/);
    if (indentedKey && currentListKey) {
      // an indented mapping under the current key == a nested object
      if (!nested.includes(currentListKey)) nested.push(currentListKey);
      continue;
    }

    const topKey = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (topKey) {
      const key = topKey[1];
      const rest = topKey[2];
      if (rest === "") {
        // block list (or, if followed by indented keys, a nested object)
        data[key] = [];
        currentListKey = key;
      } else if (rest.startsWith("[") && rest.endsWith("]")) {
        data[key] = parseInlineArray(rest);
        currentListKey = null;
      } else {
        data[key] = stripScalar(rest);
        currentListKey = null;
      }
      continue;
    }
    // unrecognized line shape; ignore (pass1 will catch missing fields)
  }

  if (nested.length) data.__nested__ = nested;
  return { ok: true, data, raw, body };
}
