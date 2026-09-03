import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { audit, extractLinks, findingKey, compareDebt, validatePolicy } from '../scripts/vault/maintenance-audit.mjs';
const script = path.resolve('plugins/wildlife-vault/scripts/vault/maintenance-audit.mjs');
function fixture(t, files = {}, extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-audit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', root]);
  const policy = { version: 1, scopes: [{ path: 'docs', role: 'active' }], ...extra };
  const write = (name, value) => { const abs = path.join(root, name); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, value); };
  write('policy.json', JSON.stringify(policy)); write('docs/index.md', '# Docs\n');
  for (const [name, value] of Object.entries(files)) write(name, value);
  return { root, write, run: options => audit(root, 'policy.json', options) };
}
function snapshot(root) {
  const result = {};
  function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir,e.name);
    if (e.isDirectory()) walk(abs);
    else { const st=fs.lstatSync(abs); result[path.relative(root, abs)] = [e.isSymbolicLink() ? fs.readlinkSync(abs) : fs.readFileSync(abs).toString('base64'), st.mtimeMs, st.mode]; }
  }}
  walk(root); return result;
}
test('aliases, paths, Markdown reference labels and fragments are resolved without inventing headings', t => {
  const f = fixture(t, {
    'docs/index.md': '[[Friendly name|label]] [[guide#No such heading]] [alias label](guide.md#missing) [ref][g] [g][] [g]\n\n[g]: <guide.md> "Title"\n[space](<a b.md>) [parens](a(b).md) [encoded](a%20b.md)\n',
    'docs/guide.md': '---\naliases:\n  - "Friendly name"\n---\n# Guide\n',
    'docs/a b.md': '# Space', 'docs/a(b).md': '# Parenthesis'
  });
  const r=f.run(); assert.equal(r.exitCode,0); assert.equal(r.findings.length,9);
  assert.ok(r.findings.every(x=>x.verdict==='RESOLVED'));
  assert.equal(r.findings.filter(x=>x.fragmentStatus==='NOT_VALIDATED').length,2);
});
test('duplicate aliases, basename collisions, duplicate reference definitions and unknown labels remain debt', t => {
  const f = fixture(t, { 'docs/index.md':'[[Shared]] [[guide]] [x][dupe] [x][missing]',
    'docs/a/guide.md':'---\naliases: [Shared]\n---\n', 'docs/b/guide.md':'---\naliases: [Shared]\n---\n',
    'docs/labels.md':'[x][d]\n\n[d]: a/guide.md\n[d]: b/guide.md\n' });
  const r=f.run(); assert.equal(r.exitCode,1);
  assert.equal(r.findings.filter(x=>x.verdict==='AMBIGUOUS').length,3);
  assert.equal(r.findings.filter(x=>x.verdict==='BROKEN').length,2);
});
test('literal examples are masked while a real link survives with its original line', () => {
  const text='---\naliases: ["[[metadata]]"]\n---\n```md\n[[fenced]]\n````\n    [[indented]]\n`[[inline]]` ``[[double]]``\n<!-- [[comment]] -->\n\\[\\[escaped]]\n[[actual]]';
  assert.deepEqual(extractLinks(text).map(x=>[x.target,x.line]), [['actual',11]]);
});
test('absent restricted asset, historical missing artifact, generated evidence and kickoff are distinct and read-only', t => {
  const f=fixture(t, {'.gitignore':'local-input\n','docs/index.md':'[source](../local-input/missing.csv) [[broken]]',
    'docs/history/old.md':'[unavailable](missing-report.pdf)', 'docs/evidence/run.md':'[[not-a-note]]', 'notes/start.md':'[[old-plan]]',
    'docs/_raw/capture.md':'[[do-not-read]]'}, {
      scopes:[{path:'docs',role:'active'},{path:'docs/history',role:'historical'},{path:'docs/evidence',role:'generated'},{path:'notes',role:'kickoff'}],
      externalAssets:[{id:'input',path:'local-input',owner:'data-owner',reason:'restricted evidence',sensitivity:'restricted',commitPolicy:'never'}]
    });
  const before=snapshot(f.root), r=f.run();
  assert.deepEqual(snapshot(f.root),before);
  assert.deepEqual(r.findings.map(x=>x.verdict).sort(),['BROKEN','EXTERNAL_LOCAL','GENERATED_WARNING','HISTORICAL_WARNING','HISTORICAL_WARNING']);
  assert.equal(fs.existsSync(path.join(f.root,'local-input')),false);
  const cli=spawnSync(process.execPath,[script,`--project-dir=${f.root}`,'--policy=policy.json'],{encoding:'utf8'});
  assert.equal(cli.status,1,cli.stderr); assert.deepEqual(snapshot(f.root),before);
});
test('external declarations fail closed unless gitignored and never committed', t => {
  const asset={id:'input',path:'input',owner:'owner',reason:'source',sensitivity:'restricted',commitPolicy:'never'};
  const f=fixture(t,{}, {externalAssets:[asset]});
  assert.throws(()=>f.run(),/gitignored/);
  f.write('.gitignore','input/\n'); assert.equal(f.run().exitCode,0);
  f.write('input/data.csv','synthetic'); execFileSync('git',['-C',f.root,'add','-f','input/data.csv']);
  assert.throws(()=>f.run(),/tracked|gitignored/);
  assert.throws(()=>validatePolicy({version:1,scopes:[{path:'docs',role:'active'}],externalAssets:[{...asset,commitPolicy:'allow'}]}),/invalid external/);
});
test('forward refs require owner/expiry, expire on a fixed date, and cannot silence ambiguity', t => {
  const rule={source:'docs/index.md',kind:'wiki',target:'future',verdict:'FORWARD',owner:'owner',expires:'2030-02-01',reason:'planned'};
  const f=fixture(t,{'docs/index.md':'[[future]]'}, {exceptions:[rule]});
  assert.equal(f.run({today:'2030-02-01'}).findings[0].verdict,'FORWARD');
  assert.equal(f.run({today:'2030-02-02'}).findings[0].verdict,'BROKEN');
  f.write('docs/a.md','---\naliases: [future]\n---\n'); f.write('docs/b.md','---\naliases: [future]\n---\n');
  assert.equal(f.run({today:'2030-01-01'}).findings[0].verdict,'AMBIGUOUS');
  assert.throws(()=>validatePolicy({version:1,scopes:[{path:'docs',role:'active'}],exceptions:[{...rule,owner:''}]}),/owner/);
  assert.throws(()=>validatePolicy({version:1,scopes:[{path:'docs',role:'active'}],exceptions:[{...rule,expires:'2030-02-30'}]}),/expiry/);
});
test('literal rules are source and kind specific; ignored but unregistered missing paths remain broken', t=>{
  const f=fixture(t,{'docs/index.md':'[[tool:slot]] [slot](tool:slot) [missing](../ignored/file.csv)','docs/other.md':'[[tool:slot]]','.gitignore':'ignored\n'},
    {exceptions:[{source:'docs/index.md',target:'tool:slot',kind:'wiki',verdict:'LITERAL',reason:'syntax'}]});
  const r=f.run(); assert.equal(r.findings.filter(x=>x.verdict==='LITERAL').length,1); assert.equal(r.findings.filter(x=>x.verdict==='BROKEN').length,3);
});
test('ratchet is occurrence-sensitive and line-insensitive, requires explicit retirement and rejects baseline growth', t=>{
  const e={source:'docs/index.md',kind:'wiki',target:'gone',verdict:'BROKEN',count:1,disposition:'accepted-debt',owner:'docs-owner',reason:'known debt'};
  const baseline={version:1,entries:[e]};
  const f=fixture(t,{'docs/index.md':'\n\n[[gone]]','debt.json':JSON.stringify(baseline)}, {baseline:'debt.json'});
  assert.equal(f.run().exitCode,0); assert.equal(f.run({strict:true}).exitCode,1);
  f.write('docs/index.md','[[gone]] [[gone]]'); assert.equal(f.run().regressions[0].added,1);
  f.write('docs/index.md','No broken links.'); assert.equal(f.run().retire[0].count,1);
  const reduced={version:1,entries:[]}; assert.equal(compareDebt([],reduced,baseline).missingDispositions.length,1);
  reduced.retirements=[{key:findingKey(e),count:1,disposition:'resolved',reason:'corrected link',evidence:'PR #1'}];
  assert.equal(compareDebt([],reduced,baseline).missingDispositions.length,0);
  assert.equal(compareDebt([],baseline,{version:1,entries:[]}).missingDispositions.length,1);
});
test('missing policy/root, zero coverage, unknown options and unsafe paths fail without modifying files', t=>{
  const f=fixture(t,{'docs/index.md':'[escape](../../outside.md)'});
  assert.equal(f.run().findings[0].verdict,'BLOCKED_PATH');
  fs.symlinkSync(os.tmpdir(),path.join(f.root,'linked'));
  f.write('docs/index.md','[link](../linked/private.md)'); assert.equal(f.run().findings[0].verdict,'BLOCKED_PATH');
  f.write('policy.json',JSON.stringify({version:1,scopes:[{path:'missing',role:'active'}]})); assert.throws(()=>f.run(),/ENOENT/);
  f.write('policy.json',JSON.stringify({version:1,scopes:[{path:'docs',role:'active'}],scpoes:[]})); assert.throws(()=>f.run(),/unknown/);
  const before=snapshot(f.root);
  for(const args of [['--fix'],['--policy=missing.json']]) {
    const result=spawnSync(process.execPath,[script,`--project-dir=${f.root}`,...args],{encoding:'utf8'}); assert.equal(result.status,2);
  }
  assert.deepEqual(snapshot(f.root),before);
});

test('zero Markdown coverage is an error rather than a vacuous pass', t => {
  const f=fixture(t); fs.unlinkSync(path.join(f.root,'docs/index.md'));
  assert.throws(()=>f.run(),/zero Markdown/);
});
