#!/usr/bin/env node
// Generate a self-contained Codex marketplace from the shared Claude-compatible source.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(repo, 'plugins/wildlife-vault');
const argv = process.argv.slice(2);
const outArg = argv.find(a => a.startsWith('--out='));
if (!outArg || argv.some(a => a !== '--allow-dirty' && !a.startsWith('--out='))) {
  throw new Error('Usage: node scripts/build-codex.mjs --out=<new-directory> [--allow-dirty]');
}
const out = path.resolve(outArg.slice(6));
if (fs.existsSync(out)) throw new Error('Output exists; choose a new directory. Nothing was overwritten.');
if (out === repo || out.startsWith(repo + path.sep)) throw new Error('Build outside the source checkout.');
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
const revision = git('rev-parse', 'HEAD');
const dirty = !!git('status', '--porcelain', '--untracked-files=all');
if (dirty && !argv.includes('--allow-dirty')) throw new Error('Commit the tested source first; --allow-dirty is for isolated development tests only.');
const target = path.join(out, 'plugins/wildlife-vault');
fs.mkdirSync(target, { recursive: true });
function copy(dir, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Packaging refuses symlinks');
    const from = path.join(dir, entry.name), to = path.join(dest, entry.name);
    if (entry.isDirectory()) copy(from, to);
    else {
      let bytes = fs.readFileSync(from);
      if (entry.name === 'SKILL.md') {
        // Claude-only frontmatter remains in the sole authoring source.
        const text = bytes.toString('utf8');
        const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (!m) throw new Error(`invalid skill frontmatter: ${from}`);
        const metadata = m[1].split('\n').filter(line => !/^(?:paths|allowed-tools|arguments):/.test(line)).join('\n');
        bytes = Buffer.from(`---\n${metadata}\n---\n${m[2]}`);
      }
      fs.writeFileSync(to, bytes, { flag: 'wx' });
    }
  }
}
for (const name of ['skills', 'scripts', 'references', 'skeleton', 'docs', '.codex-plugin']) copy(path.join(source, name), path.join(target, name));
fs.copyFileSync(path.join(source, 'README.md'), path.join(target, 'README.md'));
const manifestPath = path.join(target, '.codex-plugin/plugin.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.version = manifest.version.split('+')[0] + '+codex.' + revision.slice(0, 12) + (dirty ? '.dirty' : '');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
// Hook directories, .claude-plugin, usage-guard, and consumer data are not copied.
fs.mkdirSync(path.join(out, '.agents/plugins'), { recursive: true });
fs.writeFileSync(path.join(out, '.agents/plugins/marketplace.json'), JSON.stringify({
  name: 'wildlife-ai', interface: { displayName: 'Wildlife AI' },
  plugins: [{ name: 'wildlife-vault', source: { source: 'local', path: './plugins/wildlife-vault' },
    policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Productivity' }]
}, null, 2) + '\n');
const hashes = {};
function inventory(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) inventory(abs);
    else hashes[path.relative(target, abs).split(path.sep).join('/')] = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
  }
}
inventory(target);
fs.writeFileSync(path.join(target, 'SOURCE.json'), JSON.stringify({ repository: 'https://github.com/dirkdd/wildlife-dev-docs', revision, dirty, hashes }, null, 2) + '\n');
console.log(JSON.stringify({ marketplace: out, plugin: target, revision, dirty, files: Object.keys(hashes).length }));
