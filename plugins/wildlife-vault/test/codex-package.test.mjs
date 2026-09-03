import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
const repo=process.cwd();
const run=(file,args=[])=>spawnSync(process.execPath,[file,...args],{encoding:'utf8'});
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function tree(dir,result={}) {
  for(const e of fs.readdirSync(dir,{withFileTypes:true})) {
    const p=path.join(dir,e.name); if(e.isDirectory()) tree(p,result); else result[p]=[digest(p),fs.statSync(p).mtimeMs];
  } return result;
}
test('relocated Codex package is complete, excludes hooks and preserves existing setup',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vault-package-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const out=path.join(root,'marketplace'), result=run('scripts/build-codex.mjs',[`--out=${out}`,'--allow-dirty']);
  assert.equal(result.status,0,result.stderr);
  const plugin=path.join(out,'plugins/wildlife-vault');
  assert.equal(fs.existsSync(path.join(plugin,'hooks')),false);
  assert.equal(fs.existsSync(path.join(plugin,'.claude-plugin')),false);
  assert.equal(fs.existsSync(path.join(out,'plugins/usage-guard')),false);
  const manifest=JSON.parse(fs.readFileSync(path.join(plugin,'.codex-plugin/plugin.json')));
  assert.equal(manifest.name,'wildlife-vault'); assert.equal(manifest.hooks,undefined);
  const receipt=JSON.parse(fs.readFileSync(path.join(plugin,'SOURCE.json')));
  assert.match(receipt.revision,/^[a-f0-9]{40}$/);
  for(const [rel,hash] of Object.entries(receipt.hashes)) assert.equal(digest(path.join(plugin,rel)),hash,rel);
  for(const name of fs.readdirSync(path.join(plugin,'skills'))) {
    const skill=fs.readFileSync(path.join(plugin,'skills',name,'SKILL.md'),'utf8');
    assert.doesNotMatch(skill.split('---')[1],/^(paths|arguments|allowed-tools):/m);
    assert.ok(fs.existsSync(path.join(plugin,'references/runtime.md')));
  }
  const before=tree(out); assert.notEqual(run('scripts/build-codex.mjs',[`--out=${out}`,'--allow-dirty']).status,0);
  assert.deepEqual(tree(out),before,'existing package must not be overwritten');
  const consumer=path.join(root,'consumer');fs.mkdirSync(consumer);
  fs.writeFileSync(path.join(consumer,'CLAUDE.md'),'Existing Claude instructions\n');
  fs.writeFileSync(path.join(consumer,'AGENTS.md'),'Existing project instructions\n');
  const script=name=>path.join(plugin,'scripts/vault',name);
  const args=[`--project-dir=${consumer}`];
  const init=run(script('init.mjs'),[...args,'--client=codex']);assert.equal(init.status,0,init.stderr);
  assert.equal(fs.readFileSync(path.join(consumer,'CLAUDE.md'),'utf8'),'Existing Claude instructions\n');
  assert.match(fs.readFileSync(path.join(consumer,'AGENTS.md'),'utf8'),/^Existing project instructions/);
  assert.equal(run(script('validate.mjs'),[...args,'--all']).status,0);
  const snapshot=tree(consumer);
  for(const [name,extra] of [['validate.mjs',['--all']],['status.mjs',[]],['link-scan.mjs',['--dangling']],['learnings-export.mjs',['--dry-run']]]) {
    const r=run(script(name),[...args,...extra]);assert.equal(r.status,0,r.stderr);
  }
  assert.deepEqual(tree(consumer),snapshot,'read-only commands must not rewrite consumer files');
});
test('Codex init rejects invalid destinations before writes and respects an existing custom root',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vault-init-guard-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const script=path.join(repo,'plugins/wildlife-vault/scripts/vault/init.mjs');
  for(const name of ['../outside','a/b','..']) {
    const r=run(script,[`--project-dir=${root}`,'--client=codex',`--name=${name}`]);assert.notEqual(r.status,0);assert.deepEqual(fs.readdirSync(root),[]);
  }
  fs.mkdirSync(path.join(root,'docs/vault'),{recursive:true});
  fs.writeFileSync(path.join(root,'docs/vault/.vault.json'),JSON.stringify({vaultRoot:'knowledge',vaultName:'Knowledge'}));
  const before=tree(root); assert.notEqual(run(script,[`--project-dir=${root}`,'--client=codex']).status,0);assert.deepEqual(tree(root),before);
});
