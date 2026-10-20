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
// a verb from the ball in the bottom right corner; then pressing on something it does something to lights it up, and
// letting go does it
// (the verbs stay out once slid out, until the ball is tapped again)
const verb = async (v) => { if (!(await page.$('.hud-menu.verbs'))) { await page.click('.hud-ball.verbs'); await wait(250); } await page.click(`.hud-menu [data-verb="${v}"]`); await wait(150); };
// what she found is written at the thing
const found = () => text('.hud-note p');
const hold = async (key, ms) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); await wait(1500); };

// the opening route: the game starts in Lux's flat
await page.goto(`${url}?new`);
await ready();
await shot('home');

// out of the flat, down to the backstreet, and along it to the main street: tapping the door walks her there and out,
// and walking into the street's right end leaves
await page.mouse.click(815, 300);
await wait(3000);
console.log('out of the flat:', await where());
await shot('backstreet');
await hold('ArrowRight', 5000);
console.log('along the backstreet:', await where());

// far along the street she runs there
await page.mouse.click(800, 470);
await wait(700);
await shot('running');

// something far away: the Concierge's face on its billboard. Look, chosen at the ball, lights it up under the pointer,
// and a click on it looks, from where she stands; Ask asks the Concierge about it
await page.click('.hud-ball.verbs');
await wait(250);
console.log('verbs:', await page.$$eval('.hud-menu [data-verb]', (b) => b.map((e) => e.getAttribute('aria-label')).join(', ')));
await shot('verbs');
await page.click('.hud-menu [data-verb="eyes"]');
await wait(150);
await page.mouse.move(870, 160);
await wait(250);
console.log('lit:', await text('.hud-mark-label'));
await shot('look-lit');
await page.mouse.click(870, 160);
await wait(300);
console.log('found:', await found(), '| verb put down:', await page.$eval('.hud-ball.verbs', (b) => b.getAttribute('aria-pressed')), '| verbs still out:', !!(await page.$('.hud-menu.verbs')));
await shot('look-sky');
await verb('ask');
await page.mouse.click(870, 160);
await wait(300);
console.log('asked:', await text('.hud-toast'));

// her things, in the left ball: her things, her notebook and the Concierge's bell; the verbs go in as they come out
await page.click('.hud-ball.things');
await wait(250);
console.log('things:', await page.$$eval('.hud-menu [data-menu]', (b) => b.map((e) => e.getAttribute('aria-label')).join(', ')));
await shot('things');
console.log('verbs put away:', !(await page.$('.hud-menu.verbs')));
await page.keyboard.press('Escape');

// into the radio repair, through its door on the street, and talk to the fixer at his bench
await page.mouse.click(304, 350);
await wait(5000);
console.log('through the shop door:', await where());
await shot('shop');
// Talk, and a tap on him: she walks up to him and they talk
await verb('heart');
await page.mouse.click(620, 400);
await page.waitForSelector('.talk-line:not([hidden])', { timeout: 10000 });
await wait(200);
console.log('over a head:', await text('.talk-line'), '| balls still there:', await page.$eval('.hud-ball.verbs', (b) => getComputedStyle(b).visibility));
await shot('fixer-opens');
// the lines come one at a time over the speakers' heads; Space moves on, to her answers along the bottom
const answers = async () => { for (let i = 0; i < 30 && !(await page.$('.talk-choices:not([hidden])')); i++) { await page.keyboard.press(' '); await wait(120); } };
const choose = async (label) => {
  await answers();
  for (const b of await page.$$('.talk-choice')) if ((await b.evaluate((e) => e.textContent ?? '')).includes(label)) return b.click();
  throw new Error(`no answer "${label}"`);
};
await answers();
await shot('fixer-answers');
await choose("I'm not here about a radio.");
await wait(200);
console.log('she says:', await text('.talk-line'));
await shot('fixer-she-says');
await choose('What will I see?');
await choose('Do it.');
await wait(250);
await page.keyboard.press(' ');
await wait(250);
await shot('fixer-installs');
// the last lines, and the conversation is over
for (let i = 0; i < 30 && (await page.$('.talk-line:not([hidden])')); i++) { await page.keyboard.press(' '); await wait(150); }
await wait(300);
console.log('caption:', await text('.caption'), '| view switch:', await page.$eval('.hud', (e) => 'switch' in e.dataset));
await shot('unlocked');

// back out to the street by the door in the left wall: walking into the left end leaves. Then raw view, and the woman
// at the street machine
await hold('ArrowLeft', 7000);
console.log('back out:', await where());
await page.keyboard.press('e');
await wait(600);
await verb('eyes');
await page.mouse.click(865, 420);
await wait(600);
console.log('found:', await found(), '| attention:', await page.$eval('.hud-eye', (e) => e.dataset.level));
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
console.log('after reload, view switch:', await page.$eval('.hud', (e) => 'switch' in e.dataset), '| skin:', await page.$eval('.hud', (e) => e.dataset.skin));
await shot('reloaded');

console.log(errors.length ? `errors:\n${errors.join('\n')}` : 'no errors');
await browser.close();
