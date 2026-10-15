// Build the game and take screenshots in headless Chrome, without a server.
// Usage: npm run shot -- "view=raw" "q=low&t=3" "bench.html?view=raw"
// Each argument is a query string for the game, or a page plus its query. Default: the game in Concierge view.
// Screenshots land in shots/<page>_<query>.png. Loads dist/ from file://, so Chrome runs with file access enabled.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const queries = process.argv.slice(2).length ? process.argv.slice(2) : ['t=3'];
const profile = resolve(root, 'node_modules/.cache/shot-chrome');

execFileSync('npx', ['vite', 'build', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
mkdirSync(resolve(root, 'shots'), { recursive: true });
const target = (arg) => {
  const [file, q] = /\.html/.test(arg) ? arg.split('?') : ['index.html', arg];
  return { url: `file://${resolve(root, 'dist', file)}?${q ?? ''}`, name: `${file === 'index.html' ? '' : file.replace('.html', '_')}${(q ?? '').replace(/[^a-z0-9]+/gi, '_')}` || 'default' };
};
const flags = ['--headless=new', '--hide-scrollbars', '--allow-file-access-from-files', `--user-data-dir=${profile}`, '--window-size=960,540', '--virtual-time-budget=8000'];

for (const q of queries) {
  const { url, name } = target(q);
  const out = resolve(root, 'shots', `${name}.png`);
  execFileSync(chrome, [...flags, `--screenshot=${out}`, url], { stdio: 'ignore' });
  console.log(`${name}.png`, existsSync(out) ? `${(statSync(out).size / 1024).toFixed(0)} KB` : 'missing');
}
const dom = execFileSync(chrome, ['--headless=new', '--allow-file-access-from-files', `--user-data-dir=${profile}`, '--virtual-time-budget=8000', '--dump-dom', target(queries[0]).url], { encoding: 'utf8', maxBuffer: 64 << 20 });
const err = /data-err="([^"]*)"/.exec(dom);
const ready = /data-ready="1"/.test(dom);
console.log(err ? `error: ${err[1]}` : ready ? 'ready' : 'not ready (no error reported)');
