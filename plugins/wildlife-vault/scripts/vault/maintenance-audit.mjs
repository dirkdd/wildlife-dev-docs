// Optional, read-only documentation audit. No dependency on the typed-vault schema.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseFrontmatter } from './parse-frontmatter.mjs';

const roles = new Set(['active', 'historical', 'generated', 'kickoff']);
const skip = new Set(['.git', 'node_modules', '.obsidian', '_raw', '.cache', 'dist', 'build']);
const debt = new Set(['BROKEN', 'AMBIGUOUS']);
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
const within = (file, root) => root === '.' || file === root || file.startsWith(root + '/');
const normalized = s => s.normalize('NFC').trim().toLowerCase();
const dateOK = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
function relativeName(s) {
  if (!nonempty(s) || s.includes('\\') || path.posix.isAbsolute(s) || s.split('/').includes('..'))
    throw new Error(`expected a project-relative path: ${s}`);
  return path.posix.normalize(s).replace(/\/$/, '') || '.';
}
function safePath(root, rel) {
  rel = relativeName(rel);
  let current = root;
  for (const part of rel.split('/')) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink())
      throw new Error(`symlink traversal is not allowed: ${rel}`);
    // existsSync is false for broken symlinks.
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`symlink traversal is not allowed: ${rel}`); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return path.resolve(root, rel);
}
function readJSON(root, rel) { return JSON.parse(fs.readFileSync(safePath(root, rel), 'utf8')); }
function onlyKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`unknown ${label} key: ${key}`);
}
export function validatePolicy(p) {
  onlyKeys(p, ['version', 'scopes', 'resolveRoots', 'exclude', 'externalAssets', 'exceptions', 'baseline'], 'policy');
  if (p.version !== 1 || !Array.isArray(p.scopes) || !p.scopes.length) throw new Error('policy requires version 1 and nonempty scopes');
  const seen = new Set();
  for (const scope of p.scopes) {
    onlyKeys(scope, ['path', 'role'], 'scope');
    scope.path = relativeName(scope.path);
    if (!roles.has(scope.role) || seen.has(scope.path)) throw new Error('scope role invalid or path duplicated');
    seen.add(scope.path);
  }
  for (const key of ['resolveRoots', 'exclude']) {
    if (p[key] !== undefined && !Array.isArray(p[key])) throw new Error(`${key} must be an array`);
    for (const name of p[key] || []) relativeName(name);
  }
  for (const key of ['externalAssets', 'exceptions'])
    if (p[key] !== undefined && !Array.isArray(p[key])) throw new Error(`${key} must be an array`);
  const ids = new Set();
  for (const asset of p.externalAssets || []) {
    onlyKeys(asset, ['id', 'path', 'owner', 'reason', 'sensitivity', 'commitPolicy'], 'external asset');
    asset.path = relativeName(asset.path);
    if (asset.path === '.' || !['id', 'owner', 'reason', 'sensitivity'].every(k => nonempty(asset[k])) ||
        asset.commitPolicy !== 'never' || ids.has(asset.id)) throw new Error('invalid external asset declaration');
    ids.add(asset.id);
  }
  const exceptionKeys = new Set();
  for (const rule of p.exceptions || []) {
    onlyKeys(rule, ['source', 'target', 'kind', 'verdict', 'owner', 'expires', 'reason'], 'exception');
    rule.source = relativeName(rule.source);
    const key = JSON.stringify([rule.source, rule.kind, rule.target]);
    if (exceptionKeys.has(key) || !['wiki', 'markdown'].includes(rule.kind) ||
        !['FORWARD', 'LITERAL'].includes(rule.verdict) || !nonempty(rule.target) || !nonempty(rule.reason))
      throw new Error('invalid or duplicate exception');
    exceptionKeys.add(key);
    if (rule.verdict === 'FORWARD' && (!nonempty(rule.owner) || !dateOK(rule.expires)))
      throw new Error('forward reference requires owner and valid expiry');
  }
  if (p.baseline !== undefined) relativeName(p.baseline);
  return p;
}

// Keep line offsets. This deliberately covers common Markdown, not a full renderer.
export function visibleProse(input) {
  let text = input.replace(/^\uFEFF/, ' ').replace(/\r\n/g, '\n');
  const blank = s => s.replace(/[^\n]/g, ' ');
  text = text.replace(/^ ?---\n[\s\S]*?\n---(?:\n|$)/, blank).replace(/<!--[\s\S]*?(?:-->|$)/g, blank);
  let fence = null;
  text = text.split('\n').map(line => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      return blank(line);
    }
    if (marker) { fence = marker[1]; return blank(line); }
    if (/^(?: {4}|\t)/.test(line)) return blank(line);
    return line;
  }).join('\n');
  return text.replace(/(`+)([\s\S]*?)\1(?!`)/g, blank).replace(/\\([\[\]])/g, '  ');
}

export function extractLinks(text) {
  let visible = visibleProse(text);
  const found = [];
  const add = (kind, target, offset) => found.push({ kind, target, line: visible.slice(0, offset).split('\n').length });
  // Definitions are resolved per source; duplicate labels are reported, not guessed.
  const definitions = new Map();
  const labelKey = s => normalized(s).replace(/\s+/g, ' ');
  const dest = '(?:<[^>\\n]*>|(?:\\\\.|[^\\s()\\\\]|\\([^()\\n]*\\))+)';
  const defRE = new RegExp('^ {0,3}\\[([^\\]\\n]+)\\]:[ \\t]*(' + dest + ')(?:[ \\t]+["\\\'][^\\n]*["\\\'])?[ \\t]*$', 'gm');
  visible = visible.replace(defRE, (all, label, target) => {
    const key = labelKey(label);
    definitions.set(key, [...(definitions.get(key) || []), target.replace(/^<|>$/g, '')]);
    return all.replace(/[^\n]/g, ' ');
  });
  const wikiRE = /!?\[\[([^\]\n]+)\]\]/g;
  visible = visible.replace(wikiRE, (all, target, offset) => {
    add('wiki', target.split('|')[0].trim(), offset);
    return ' '.repeat(all.length);
  });
  const mdRE = new RegExp('!?\\[[^\\]\\n]*\\]\\([ \\t]*(' + dest + ')(?:[ \\t]+["\\\'][^\\n]*["\\\'])?[ \\t]*\\)', 'g');
  visible = visible.replace(mdRE, (all, target, offset) => {
    add('markdown', target.replace(/^<|>$/g, '').replace(/\\([() ])/g, '$1'), offset);
    return ' '.repeat(all.length);
  });
  const refRE = /!?\[([^\]\n]+)\](?:\[([^\]\n]*)\])?/g;
  for (const m of visible.matchAll(refRE)) {
    const label = labelKey(m[2] || m[1]);
    const targets = definitions.get(label);
    if (targets?.length === 1) add('markdown', targets[0], m.index);
    else if (targets?.length > 1 || m[2] !== undefined) {
      add('markdown', `reference:${label}`, m.index);
      found[found.length - 1].referenceError = targets ? 'AMBIGUOUS' : 'BROKEN';
    }
    // An undefined shortcut [label] can be ordinary prose; do not invent a link.
  }
  return found.sort((a, b) => a.line - b.line);
}
function assetFor(p, rel) { return (p.externalAssets || []).find(a => within(rel, a.path)); }
function excluded(p, rel) { return rel.split('/').some(s => skip.has(s)) || (p.exclude || []).some(s => within(rel, relativeName(s))) || assetFor(p, rel); }
function walk(root, rel, p, out, omitted) {
  if (excluded(p, rel)) { omitted.add(rel); return; }
  const abs = safePath(root, rel);
  const stat = fs.statSync(abs);
  if (stat.isFile()) { if (/\.md$/i.test(rel)) out.add(rel); return; }
  for (const item of fs.readdirSync(abs, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
    const child = path.posix.join(rel, item.name);
    if (item.isSymbolicLink()) { omitted.add(child); continue; }
    walk(root, child, p, out, omitted);
  }
}
function documentNames(rel, text) {
  const parsed = parseFrontmatter(text);
  const names = [rel.replace(/\.md$/i, ''), path.posix.basename(rel).replace(/\.md$/i, '')];
  if (parsed.ok) {
    if (nonempty(parsed.data.id)) names.push(parsed.data.id);
    if (Array.isArray(parsed.data.aliases)) names.push(...parsed.data.aliases.filter(nonempty));
  }
  return names;
}
function targetPath(source, target) {
  const rel = path.posix.normalize(path.posix.join(path.posix.dirname(source), target));
  return rel.startsWith('../') || path.posix.isAbsolute(target) ? null : rel;
}
export const findingKey = f => JSON.stringify([f.source, f.kind, f.target, f.verdict]);
export function validateBaseline(b) {
  onlyKeys(b, ['version', 'entries', 'retirements'], 'baseline');
  if (b.version !== 1 || !Array.isArray(b.entries)) throw new Error('baseline requires version 1 and entries');
  const keys = new Set();
  for (const e of b.entries) {
    onlyKeys(e, ['source', 'kind', 'target', 'verdict', 'count', 'owner', 'reason', 'disposition'], 'baseline entry');
    relativeName(e.source);
    if (!debt.has(e.verdict) || !['wiki', 'markdown'].includes(e.kind) || !nonempty(e.target) ||
        !Number.isSafeInteger(e.count) || e.count < 1 || e.disposition !== 'accepted-debt' ||
        !nonempty(e.owner) || !nonempty(e.reason) || keys.has(findingKey(e))) throw new Error('invalid baseline entry');
    keys.add(findingKey(e));
  }
  if (b.retirements !== undefined && !Array.isArray(b.retirements)) throw new Error('retirements must be an array');
  for (const r of b.retirements || []) {
    onlyKeys(r, ['key', 'count', 'disposition', 'reason', 'evidence'], 'retirement');
    if (!nonempty(r.key) || !Number.isSafeInteger(r.count) || r.count < 1 ||
        !['resolved', 'reclassified', 'consolidated', 'superseded', 'authorized-removal'].includes(r.disposition) ||
        !nonempty(r.reason) || !nonempty(r.evidence)) throw new Error('retirement requires disposition, reason and evidence');
  }
  return b;
}
export function compareDebt(findings, baseline, before) {
  validateBaseline(baseline);
  const counts = new Map();
  for (const f of findings.filter(f => debt.has(f.verdict))) counts.set(findingKey(f), (counts.get(findingKey(f)) || 0) + 1);
  const allowed = new Map(baseline.entries.map(e => [findingKey(e), e.count]));
  const regressions = [...counts].filter(([k, n]) => n > (allowed.get(k) || 0)).map(([key, n]) => ({ key, added: n - (allowed.get(key) || 0) }));
  const retire = [...allowed].filter(([k, n]) => n > (counts.get(k) || 0)).map(([key, n]) => ({ key, count: n - (counts.get(key) || 0) }));
  const missingDispositions = [];
  if (before) {
    validateBaseline(before);
    // Existing records cannot be recycled as proof for a new reduction.
    const newRecords = (baseline.retirements || []).filter(r => !(before.retirements || []).some(old => JSON.stringify(old) === JSON.stringify(r)));
    for (const old of before.entries) {
      const key = findingKey(old), reduced = old.count - (allowed.get(key) || 0);
      if (reduced > 0 && newRecords.filter(r => r.key === key).reduce((n, r) => n + r.count, 0) !== reduced)
        missingDispositions.push({ key, count: reduced });
    }
    // Adding accepted debt in the same change must never make a regression green.
    const oldAllowed = new Map(before.entries.map(e => [findingKey(e), e.count]));
    for (const [key, n] of allowed) if (n > (oldAllowed.get(key) || 0)) missingDispositions.push({ key, error: 'baseline growth requires separate owner review; cannot pass a ratchet' });
  }
  return { regressions, retire, missingDispositions };
}
export function audit(projectDir, policyFile, options = {}) {
  const root = fs.realpathSync(projectDir), p = validatePolicy(readJSON(root, policyFile));
  const today = options.today || new Date().toISOString().slice(0, 10);
  if (!dateOK(today)) throw new Error('invalid audit date');
  // Verify intent against Git without reading any asset content or running hooks.
  for (const a of p.externalAssets || []) {
    const ignored = [a.path, a.path + '/'].some(candidate => {
      try { execFileSync('git', ['-C', root, 'check-ignore', '-q', '--', candidate], { stdio: 'ignore' }); return true; }
      catch { return false; }
    });
    if (!ignored) throw new Error(`external asset ${a.id} must be gitignored (including when absent)`);
    const tracked = execFileSync('git', ['-C', root, 'ls-files', '--', a.path], { encoding: 'utf8' }).trim();
    if (tracked) throw new Error(`external asset ${a.id} contains tracked files`);
  }
  const files = new Set(), resolution = new Set(), omitted = new Set();
  for (const s of p.scopes) walk(root, s.path, p, files, omitted);
  for (const rel of p.resolveRoots || p.scopes.map(s => s.path)) walk(root, relativeName(rel), p, resolution, omitted);
  for (const rel of files) resolution.add(rel);
  if (!files.size) throw new Error('audit measured zero Markdown files');
  const contents = new Map(), names = new Map();
  for (const rel of resolution) {
    const text = fs.readFileSync(safePath(root, rel), 'utf8');
    contents.set(rel, text);
    for (const name of documentNames(rel, text)) {
      const key = normalized(name), paths = names.get(key) || new Set();
      paths.add(rel); names.set(key, paths);
    }
  }
  const orderedScopes = [...p.scopes].sort((a,b) => b.path.length - a.path.length);
  const findings = [];
  for (const source of [...files].sort()) {
    const role = orderedScopes.find(s => within(source, s.path)).role;
    for (const link of extractLinks(contents.get(source))) {
      const f = { source, role, ...link };
      let target;
      try { target = decodeURIComponent(link.target); } catch { target = link.target; }
      const hash = target.indexOf('#');
      if (hash !== -1) { f.fragment = target.slice(hash + 1); f.fragmentStatus = 'NOT_VALIDATED'; target = target.slice(0, hash); }
      target = target.split('?')[0];
      const exception = (p.exceptions || []).find(e => e.source === source && e.kind === link.kind && e.target === link.target);
      const possiblePaths = link.kind === 'wiki' ? [targetPath(source, target), target] : [targetPath(source, target)];
      const external = possiblePaths.filter(Boolean).map(r => assetFor(p, r)).find(Boolean);
      if (link.referenceError) f.verdict = link.referenceError;
      else if (/^(?:https?:|mailto:|tel:|data:)/i.test(target) || target.startsWith('//')) f.verdict = 'REMOTE_UNCHECKED';
      else if (external) { f.verdict = 'EXTERNAL_LOCAL'; f.asset = external.id; }
      else if (exception?.verdict === 'LITERAL') { f.verdict = 'LITERAL'; f.reason = exception.reason; }
      else {
        const candidates = new Set();
        let blocked = false;
        if (!target) candidates.add(source);
        else {
          for (const rel of possiblePaths.filter(Boolean)) {
            try {
              if (excluded(p, rel)) continue;
              const abs = safePath(root, rel);
              if (fs.existsSync(abs)) candidates.add(rel);
              if (link.kind === 'wiki' && !/\.md$/i.test(rel) && fs.existsSync(safePath(root, rel + '.md'))) candidates.add(rel + '.md');
            } catch { blocked = true; }
          }
          if (link.kind === 'wiki') for (const rel of names.get(normalized(target.replace(/\.md$/i, ''))) || []) candidates.add(rel);
        }
        f.candidates = [...candidates].sort();
        f.verdict = candidates.size > 1 ? 'AMBIGUOUS' : candidates.size === 1 ? 'RESOLVED' : blocked || possiblePaths.every(r => !r) ? 'BLOCKED_PATH' : 'BROKEN';
        if (f.verdict === 'BROKEN' && exception?.verdict === 'FORWARD') {
          f.owner = exception.owner; f.expires = exception.expires;
          if (today <= exception.expires) f.verdict = 'FORWARD';
          else f.reason = 'forward reference expired';
        }
      }
      if (debt.has(f.verdict) && role !== 'active') {
        f.underlyingVerdict = f.verdict;
        f.verdict = role === 'generated' ? 'GENERATED_WARNING' : 'HISTORICAL_WARNING';
      }
      findings.push(f);
    }
  }
  const baseline = p.baseline ? readJSON(root, p.baseline) : { version: 1, entries: [] };
  const comparison = compareDebt(findings, baseline, options.before);
  const failed = comparison.regressions.length || comparison.retire.length || comparison.missingDispositions.length ||
    findings.some(f => f.verdict === 'BLOCKED_PATH' || (options.strict && debt.has(f.verdict)));
  return { version: 1, files: files.size, resolveFiles: resolution.size, scopes: p.scopes, omitted: [...omitted].sort(),
    limitations: ['Document targets only: heading and block fragments are NOT validated.',
      'Common Markdown inline/reference links and wikilinks; no full Markdown renderer, HTML/MDX links, or URL reachability.',
      'Names resolve by path, basename, id, and flat frontmatter aliases; case-folded wiki collisions are ambiguous.',
      'Frontmatter relations remain the typed-vault validator’s responsibility. No staleness or claim-veracity proof.'],
    findings, ...comparison, exitCode: failed ? 1 : 0 };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), values = {};
    for (const a of args) {
      if (a === '--strict') { values.strict = true; continue; }
      const m = a.match(/^--(project-dir|policy|baseline-before)=(.+)$/);
      if (!m) throw new Error(`unknown argument: ${a}`);
      values[m[1]] = m[2];
    }
    if (!values['project-dir'] || !values.policy) throw new Error('required: --project-dir=<root> --policy=<relative.json>');
    const before = values['baseline-before'] ? readJSON(fs.realpathSync(values['project-dir']), values['baseline-before']) : undefined;
    const result = audit(values['project-dir'], values.policy, { strict: values.strict, before });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.exitCode;
  } catch (e) { process.stderr.write(`maintenance audit failed: ${e.message}\n`); process.exitCode = 2; }
}
