import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { staleSources } from '../scripts/vault/status.mjs';
test('source hashes resolve against the selected project, and absence is reported as unavailable',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vault-provenance-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'docs/vault/Knowledge/_meta'),{recursive:true});
  fs.writeFileSync(path.join(root,'docs/vault/.vault.json'),JSON.stringify({vaultRoot:'docs/vault/Knowledge'}));
  fs.writeFileSync(path.join(root,'source.txt'),'changed source');
  fs.writeFileSync(path.join(root,'docs/vault/Knowledge/_meta/.manifest.json'),JSON.stringify({sources:[
    {path:'source.txt',hash:'old',produced:['guide']},{path:'missing.txt',hash:'old',produced:['historical-guide']}
  ]}));
  const result=spawnSync(process.execPath,[path.resolve('plugins/wildlife-vault/scripts/vault/status.mjs'),`--project-dir=${root}`],{encoding:'utf8',cwd:os.tmpdir()});
  assert.equal(result.status,0,result.stderr);assert.match(result.stderr,/stale source.*source.txt/);assert.match(result.stderr,/unavailable source.*missing.txt/);
  assert.deepEqual(staleSources({sources:[{path:'source',hash:'same',updated:'2000-01-01'}]},{source:'same'}),[],'age is not evidence of changed source');
});
