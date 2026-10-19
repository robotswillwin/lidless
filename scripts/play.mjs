// A scripted playthrough in headless Chrome, with a screenshot after each step. No server needed.
// Usage: npm run play   (builds first; screenshots land in shots/play-*.png)

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const root = resolve(import.meta.dirname, '..');
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
execFileSync('npx', ['vite', 'build', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
mkdirSync(resolve(root, 'shots'), { recursive: true });
// last run's screenshots go, so a renamed step leaves nothing stale behind
for (const f of readdirSync(resolve(root, 'shots'))) if (/^play-.*\.png$/.test(f)) rmSync(resolve(root, 'shots', f));

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--allow-file-access-from-files', '--hide-scrollbars', `--user-data-dir=${resolve(root, 'node_modules/.cache/play-chrome')}`],
  defaultViewport: { width: 960, height: 540 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const url = 'file://' + resolve(root, 'dist/index.html');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const shot = async (name) => {
  const file = resolve(root, 'shots', `play-${String(++n).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  console.log(file.split('/').pop());
};
const text = (sel) => page.$eval(sel, (e) => (e.hidden ? '' : e.textContent ?? '')).catch(() => '');
const ready = () => page.waitForFunction(() => document.documentElement.dataset.ready === '1' || document.documentElement.dataset.err, { timeout: 15000 });

const where = () => page.evaluate(() => { const s = JSON.parse(localStorage.getItem('lidless.save.v1') ?? '{}'); return `${s.scene} x=${s.heroX}`; });
const hold = async (key, ms) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); await wait(1500); };

// the opening route: the game starts in Lux's flat
await page.goto(`${url}?new`);
await ready();
await shot('home');

// out of the flat, down to the backstreet, and along it to the main street: walking into its right end leaves
await page.mouse.click(815, 300);
await wait(3000);
console.log('out of the flat:', await where());
await shot('backstreet');
await hold('ArrowRight', 5000);
console.log('along the backstreet:', await where());

// something far away: the Concierge's face on its billboard. In the Concierge's view it has two uses, looking and
// asking it, so a click fans them out; a second click on it does the default, looking, from where she stands
await page.mouse.click(870, 160);
await wait(250);
console.log('ring:', await page.$$eval('.hud-slot', (b) => b.map((e) => e.getAttribute('aria-label')).join(', ')));
await shot('ring-sky');
await page.mouse.click(870, 160);
await wait(300);
console.log('caption:', await text('.caption'));
await shot('look-sky');

// into the radio repair, through its door on the street, and talk to the fixer at his bench
await page.mouse.click(304, 350);
await wait(5000);
console.log('through the shop door:', await where());
await shot('shop');
// a double-click on him does his default, talking
await page.mouse.click(620, 400, { count: 2 });
await page.waitForSelector('.dialogue:not([hidden])', { timeout: 10000 });
await wait(200);
await shot('fixer-opens');
const choose = async (label) => {
  const buttons = await page.$$('.dialogue .choice');
  for (const b of buttons) if ((await b.evaluate((e) => e.textContent ?? '')).includes(label)) return b.click();
  throw new Error(`no choice "${label}"`);
};
await choose("I'm not here about a radio.");
await wait(200);
await shot('fixer-offer');
await choose('What will I see?');
await wait(150);
await choose('Do it.');
await wait(200);
await shot('fixer-installs');
await choose('Close');
await wait(300);
console.log('caption:', await text('.caption'), '| button hidden:', await page.$eval('#view', (e) => e.hidden));
await shot('unlocked');

// back out to the street by the door in the left wall: walking into the left end leaves. Then raw view, and the woman
// at the street machine
await hold('ArrowLeft', 7000);
console.log('back out:', await where());
await page.keyboard.press('e');
await wait(600);
await page.mouse.click(830, 385);
await wait(600);
console.log('caption:', await text('.caption'), '| attention:', await page.$eval('.hud-eye', (e) => e.dataset.level));
await shot('raw-dock');

// her notebook, and what is really in her pockets
await page.keyboard.press('n');
await wait(300);
console.log('notebook:', (await text('.hud-panel.notebook')).slice(0, 80));
await shot('raw-notebook');
await page.keyboard.press('i');
await wait(300);
await shot('raw-pockets');
await page.keyboard.press('Escape');

// reload: the save should keep the mod, the view and the position
await page.goto(url);
await ready();
await wait(300);
console.log('after reload, button hidden:', await page.$eval('#view', (e) => e.hidden), '| label:', await text('#view-label'), '| skin:', await page.$eval('.hud', (e) => e.dataset.skin));
await shot('reloaded');

console.log(errors.length ? `errors:\n${errors.join('\n')}` : 'no errors');
await browser.close();
