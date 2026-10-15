// Build the game and take screenshots in headless Chrome, without a server.
// Usage: npm run shot -- "view=raw" "q=low&t=3"   (each argument is a query string; default: Concierge view)
// Screenshots land in shots/<query>.png. Loads dist/ from file://, so Chrome runs with file access enabled.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const queries = process.argv.slice(2).length ? process.argv.slice(2) : ['t=3'];
const profile = resolve(root, 'node_modules/.cache/shot-chrome');

execFileSync('npx', ['vite', 'build', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
mkdirSync(resolve(root, 'shots'), { recursive: true });
const page = 'file://' + resolve(root, 'dist/index.html');
const flags = ['--headless=new', '--hide-scrollbars', '--allow-file-access-from-files', `--user-data-dir=${profile}`, '--window-size=960,540', '--virtual-time-budget=8000'];

for (const q of queries) {
  const name = q.replace(/[^a-z0-9]+/gi, '_') || 'default';
  const out = resolve(root, 'shots', `${name}.png`);
  execFileSync(chrome, [...flags, `--screenshot=${out}`, `${page}?${q}`], { stdio: 'ignore' });
  console.log(`${name}.png`, existsSync(out) ? `${(statSync(out).size / 1024).toFixed(0)} KB` : 'missing');
}
const dom = execFileSync(chrome, ['--headless=new', '--allow-file-access-from-files', `--user-data-dir=${profile}`, '--virtual-time-budget=8000', '--dump-dom', `${page}?${queries[0]}`], { encoding: 'utf8', maxBuffer: 64 << 20 });
const err = /data-err="([^"]*)"/.exec(dom);
const ready = /data-ready="1"/.test(dom);
console.log(err ? `error: ${err[1]}` : ready ? 'ready' : 'not ready (no error reported)');
