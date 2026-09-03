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
test('legacy identity fields are opt-in and preserve default id, alias and path resolution', t => {
  const f = fixture(t, {
    'docs/index.md': '[[typed-id]] [[Friendly name]] [[guide]] [[docs/guide]] [[legacy-id]] [guide](guide.md)',
    'docs/guide.md': '---\nid: typed-id\naliases: [Friendly name]\ndocument_id: legacy-id\n---\n# Guide\n'
  });
  const expected = ['RESOLVED', 'RESOLVED', 'RESOLVED', 'RESOLVED', 'BROKEN', 'RESOLVED'];
  assert.deepEqual(f.run().findings.map(x => x.verdict), expected);
  f.write('policy.json', JSON.stringify({ version: 1, scopes: [{ path: 'docs', role: 'active' }], documentIdFields: [] }));
  assert.deepEqual(f.run().findings.map(x => x.verdict), expected);
});

test('configured flat identity fields add wiki names without becoming Markdown paths', t => {
  const f = fixture(t, {
    'docs/index.md': '[[legacy-id]] [[artifact-7#Missing heading]] [[typed-id]] [[Friendly name]] [[guide]] [[docs/guide]] [id](legacy-id) [guide](guide.md)',
    'docs/guide.md': '---\nid: typed-id\naliases: [Friendly name]\ndocument_id: " legacy-id "\nartifact_id: artifact-7\n---\n# Guide\n'
  }, { documentIdFields: ['document_id', 'artifact_id'] });
  const r = f.run();
  assert.deepEqual(r.findings.map(x => x.verdict), ['RESOLVED', 'RESOLVED', 'RESOLVED', 'RESOLVED', 'RESOLVED', 'RESOLVED', 'BROKEN', 'RESOLVED']);
  assert.ok(r.findings.filter(x => x.verdict === 'RESOLVED').every(x => x.candidates.length === 1 && x.candidates[0] === 'docs/guide.md'));
  assert.equal(r.findings[1].fragmentStatus, 'NOT_VALIDATED');
});

test('configured identities use only own nonempty string scalars, never lists or nested YAML', t => {
  const f = fixture(t, {
    'docs/index.md': '[[inline-list-id]] [[block-list-id]] [[nested-id]] [[{key: flow-id}]] [[inherited-id]] [[own-id]] [[{literal}]] [[%5Bliteral%5D]] [[>]] [[&anchor tagged-id]] [[*anchor]] [[!!str tagged-id]]',
    'docs/inline-list.md': '---\ndocument_id: [inline-list-id]\n---\n',
    'docs/block-list.md': '---\ndocument_id:\n  - block-list-id\n---\n',
    'docs/nested.md': '---\ndocument_id:\n  key: nested-id\n---\n',
    'docs/flow.md': '---\ndocument_id: {key: flow-id}\n---\n',
    'docs/inherited.md': '---\n__proto__: [inherited-id]\n---\n',
    'docs/own.md': '---\nconstructor: own-id\n---\n',
    'docs/empty.md': '---\ndocument_id: "   "\nartifact_id: ""\n---\n',
    'docs/quoted-object.md': '---\ndocument_id: "{literal}"\n---\n',
    'docs/quoted-list.md': '---\ndocument_id: "[literal]"\n---\n',
    'docs/block-scalar.md': '---\ndocument_id: >\n  folded-id\n---\n',
    'docs/anchor.md': '---\ndocument_id: &anchor tagged-id\n---\n',
    'docs/alias.md': '---\ndocument_id: *anchor\n---\n',
    'docs/tag.md': '---\ndocument_id: !!str tagged-id\n---\n'
  }, { documentIdFields: ['document_id', 'artifact_id', '0', 'constructor'] });
  const r = f.run();
  assert.deepEqual(r.findings.map(x => x.verdict), ['BROKEN', 'BROKEN', 'BROKEN', 'BROKEN', 'BROKEN', 'RESOLVED', 'RESOLVED', 'RESOLVED', 'BROKEN', 'BROKEN', 'BROKEN', 'BROKEN']);
  assert.deepEqual(r.findings[5].candidates, ['docs/own.md']);
});

test('custom identities share collision detection with ids, aliases and basenames after Unicode case normalization', t => {
  const f = fixture(t, {
    'docs/index.md': '[[CAFE\u0301]] [[same-note]]',
    'docs/custom.md': '---\ndocument_id: Café\nartifact_id: CAFÉ\n---\n',
    'docs/another-custom.md': '---\nartifact_id: " CAFE\u0301 "\n---\n',
    'docs/typed.md': '---\nid: café\n---\n',
    'docs/aliased.md': '---\naliases: [CAFÉ]\n---\n',
    'docs/Café.md': '# Basename\n',
    'docs/one.md': '---\nid: same-note\naliases: [same-note]\ndocument_id: same-note\nartifact_id: same-note\n---\n'
  }, { documentIdFields: ['document_id', 'artifact_id'] });
  const r = f.run();
  assert.equal(r.findings[0].verdict, 'AMBIGUOUS');
  assert.deepEqual(r.findings[0].candidates, ['docs/Café.md', 'docs/aliased.md', 'docs/another-custom.md', 'docs/custom.md', 'docs/typed.md']);
  assert.equal(r.findings[1].verdict, 'RESOLVED');
  assert.deepEqual(r.findings[1].candidates, ['docs/one.md']);
});

test('case and Unicode spellings of one file remain one resolved wiki target', t => {
  const f = fixture(t, {
    'docs/index.md': '[[GUIDE]] [[CAFE\u0301]] [[legacy-id]]',
    'docs/guide.md': '# Guide\n',
    'docs/Café.md': '---\ndocument_id: legacy-id\n---\n# Café\n'
  }, { documentIdFields: ['document_id'] });
  const before = snapshot(f.root), result = f.run();
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.findings.map(finding => finding.verdict), ['RESOLVED', 'RESOLVED', 'RESOLVED']);
  assert.deepEqual(result.findings.map(finding => finding.candidates), [['docs/guide.md'], ['docs/Café.md'], ['docs/Café.md']]);
  assert.deepEqual(snapshot(f.root), before);
});

test('distinct files remain ambiguous even when their contents and normalized names match', t => {
  const f = fixture(t, {
    'docs/index.md': '[[GUIDE]]',
    'docs/a/guide.md': '# Same content\n',
    'docs/b/guide.md': '# Same content\n'
  });
  const finding = f.run().findings[0];
  assert.equal(finding.verdict, 'AMBIGUOUS');
  assert.deepEqual(finding.candidates, ['docs/a/guide.md', 'docs/b/guide.md']);
});

test('configured identities resolve through the CLI without changing file bytes, modes or mtimes', t => {
  const f = fixture(t, {
    'docs/index.md': '[[legacy-id]] [[artifact-id]]',
    'docs/guide.md': '---\ndocument_id: legacy-id\nartifact_id: artifact-id\n---\n# Legacy guide\n'
  }, { documentIdFields: ['document_id', 'artifact_id'] });
  const before = snapshot(f.root);
  const cli = spawnSync(process.execPath, [script, `--project-dir=${f.root}`, '--policy=policy.json', '--strict'], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  const r = JSON.parse(cli.stdout);
  assert.equal(r.exitCode, 0);
  assert.equal(r.findings.length, 2);
  assert.ok(r.findings.every(x => x.verdict === 'RESOLVED'));
  assert.deepEqual(snapshot(f.root), before);
});

test('identity field policy rejects malformed lists, non-flat names and duplicate fields', t => {
  const policy = documentIdFields => ({ version: 1, scopes: [{ path: 'docs', role: 'active' }], documentIdFields });
  for (const value of [null, false, 7, 'document_id', {}, [null], [7], [true], [{}], [[]], [''], [' '], [' document_id'], ['document_id '], ['document.id'], ['document/id'], ['document:id'], ['document_id', 'document_id']])
    assert.throws(() => validatePolicy(policy(value)), /documentIdFields/);
  assert.deepEqual(validatePolicy(policy(['document_id', 'DOCUMENT_ID', 'artifact-id'])).documentIdFields, ['document_id', 'DOCUMENT_ID', 'artifact-id']);
  const f = fixture(t, {}, { documentIdFields: ['document_id', 'document_id'] });
  const before = snapshot(f.root);
  const cli = spawnSync(process.execPath, [script, `--project-dir=${f.root}`, '--policy=policy.json'], { encoding: 'utf8' });
  assert.equal(cli.status, 2);
  assert.match(cli.stderr, /documentIdFields/);
  assert.deepEqual(snapshot(f.root), before);
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
