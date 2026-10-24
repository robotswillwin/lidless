// Every screen of the HUD and its menus, photographed on a phone held sideways (an iPhone's safe area at its sides), an
// Android phone, a tablet, a laptop and a desktop: for working on the GUI and seeing all of it at once. It builds the
// game and plays dist/ from file://, so no server is needed (or, with --dev, uses the dev server on port 5173).
//
// Usage: node scripts/ui-shots.mjs                     every screen, every device, into shots/ui/
//        node scripts/ui-shots.mjs --no-build phone    on the last build, one device
//        node scripts/ui-shots.mjs map journal         only these screens
// Each shot is shots/ui/<device>-<screen>.png; a contact sheet of each device's is shots/ui/<device>.html.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const root = resolve(import.meta.dirname, '..');
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2), wanted = args.filter((a) => !a.startsWith('--'));
const dev = args.includes('--dev');
if (!dev && !args.includes('--no-build')) execFileSync('npx', ['vite', 'build', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
const base = dev ? 'http://localhost:5173/' : `file://${resolve(root, 'dist/index.html')}`;
const out = resolve(root, 'shots/ui');
mkdirSync(out, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** The devices: a phone held sideways is the one the game is made for first. */
const DEVICES = {
  phone: { width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true, isLandscape: true, notch: 47 },
  android: { width: 915, height: 412, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, isLandscape: true },
  tablet: { width: 1180, height: 820, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true },
  laptop: { width: 1440, height: 900, deviceScaleFactor: 2 },
  desktop: { width: 1920, height: 1080, deviceScaleFactor: 1 },
};
const devices = Object.keys(DEVICES).filter((d) => !wanted.length || wanted.includes(d) || !wanted.some((w) => DEVICES[w]));
const only = wanted.filter((w) => !DEVICES[w]);

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--allow-file-access-from-files', '--hide-scrollbars'] });
const errors = [];

for (const name of devices) {
  const { notch, ...vp } = DEVICES[name], page = await browser.newPage(), shots = [];
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  await page.setViewport(vp);
  const open = async (q, title = false) => {
    await page.goto(`${base}?${title ? '' : `notitle&fast&${q}`}`, { waitUntil: 'domcontentloaded' });
    // an iPhone held sideways keeps 47 px clear at each side and 21 at the bottom: what the HUD keeps out of
    if (notch) await page.addStyleTag({ content: `.hud { --el: calc(max(var(--m), ${notch + 8}px) - var(--bx)) !important; --er: calc(max(var(--m), ${notch + 8}px) - var(--bx)) !important; --eb: calc(max(var(--m), 29px) - var(--by)) !important; }` });
    await page.waitForFunction(() => document.documentElement.dataset.ready === '1' || document.querySelector('.title-screen'), { timeout: 30000 }).catch(() => {});
    await wait(title ? 2500 : 1200);
  };
  const shot = async (screen) => { await page.screenshot({ path: `${out}/${name}-${screen}.png` }); shots.push(screen); };
  const click = (sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);
  const tab = (re) => page.evaluate((r) => [...document.querySelectorAll('.hud-panel .tab, .title-screen button')].find((b) => new RegExp(r, 'i').test(b.textContent))?.click(), re);
  const at = (x, y) => page.evaluate((x, y) => { const c = document.querySelector('canvas').getBoundingClientRect(); return [c.left + (x / 960) * c.width, c.top + (y / 540) * c.height]; }, x, y);
  const tap = async (x, y) => { const [px, py] = await at(x, y); await page.mouse.move(px, py); await page.mouse.down(); await wait(60); await page.mouse.up(); };
  const verb = async (v) => { if (!(await page.$(`[data-verb="${v}"]`))) await click('.hud-ball.verbs'); await wait(250); await page.evaluate((v) => document.querySelector(`[data-verb="${v}"]`)?.click(), v); await wait(200); };
  // the walk she has had: the tower, then the street and the places off it, so the map has something to show
  // each place opened, looked at a moment (its picture is taken), and a step taken there (her save keeps that she was there)
  const walk = async () => {
    for (const q of ['new&scene=home&spawn=door', 'scene=floor14&spawn=lift', 'scene=floor9&spawn=lift', 'scene=lobby&spawn=lift', 'scene=radio&spawn=door', 'scene=bar&spawn=door', 'scene=street&spawn=start']) {
      await open(q);
      await wait(900);
      await page.keyboard.down('ArrowRight'); await wait(350); await page.keyboard.up('ArrowRight'); await wait(1200);
    }
  };
  const SCREENS = {
    hud: async () => { await open('new&scene=street&spawn=start'); await shot('hud'); await open('new&scene=street&spawn=start&view=raw'); await shot('hud-raw'); },
    verbs: async () => { await open('new&scene=street&spawn=start'); await click('.hud-ball.verbs'); await wait(400); await shot('verbs'); await verb('hands'); await click('.hud-ball.verbs'); await wait(300); await shot('verb-chosen'); },
    things: async () => { await open('new&scene=street&spawn=start'); await click('.hud-ball.things'); await wait(400); await shot('things'); await page.evaluate(() => document.querySelector('.hud-tray .slot')?.click()); await wait(400); await shot('thing-close'); },
    note: async () => { await open('new&scene=street&spawn=start'); await tap(130, 300); await wait(1200); await shot('note'); },
    concierge: async () => { await open('new&scene=street&spawn=start'); await click('.co-head'); await wait(600); await shot('concierge'); },
    talk: async () => { await open('new&scene=radio&spawn=door'); await verb('heart'); await tap(690, 335); await page.waitForFunction(() => !!document.querySelector('.talk-line:not([hidden])'), { timeout: 12000 }).catch(() => {}); await wait(300); await shot('talk-line'); for (let k = 0; k < 12 && !(await page.$('.talk-choices:not([hidden])')); k++) { await page.keyboard.press(' '); await wait(500); } await shot('talk-answers'); },
    closeup: async () => { await open('new&scene=home&spawn=door'); await tap(640, 300); await wait(4000); await shot('closeup'); },
    journal: async () => { await walk(); await click('.hud-btn.journal'); await wait(500); await shot('journal'); await tab('people'); await wait(300); await shot('journal-people'); },
    map: async () => { await walk(); await click('.hud-btn.map'); await wait(1000); await shot('map'); },
    menu: async () => { await open('new&scene=street&spawn=start'); await click('.hud-btn.menu'); await wait(500); await shot('menu-saves'); await tab('settings'); await wait(300); await shot('menu-settings'); await tab('how to play'); await wait(300); await shot('menu-help'); },
    terminal: async () => { await open('new&scene=home&terminal=relay7'); await wait(1500); await shot('terminal'); },
    // last: the game in progress, which the others saved, is on it
    title: async () => {
      // a few steps on the street, so the game in progress is saved, with its picture
      await open('new&scene=street&spawn=start'); await wait(900); await page.keyboard.down('ArrowRight'); await wait(400); await page.keyboard.up('ArrowRight'); await wait(1500);
      await open('', true); await shot('title'); await tab('settings'); await wait(400); await shot('title-settings'); await tab('back'); await tab('how to play'); await wait(400); await shot('title-help'); },
  };
  for (const [screen, run] of Object.entries(SCREENS)) {
    if (only.length && !only.includes(screen)) continue;
    try { await run(); } catch (e) { errors.push(`${name} ${screen}: ${e.message}`); }
  }
  // a contact sheet of the device's shots, to look at all of them at once
  writeFileSync(`${out}/${name}.html`, `<!doctype html><meta charset="utf-8"><title>${name}</title><body style="margin:0;background:#111;color:#ccc;font:13px system-ui">${shots.map((s) => `<figure style="display:inline-block;margin:8px;width:46vw"><img src="${name}-${s}.png" style="width:100%"><figcaption>${s}</figcaption></figure>`).join('')}</body>`);
  console.log(`${name}: ${shots.length} shots`);
  await page.close();
}
console.log(errors.length ? errors.join('\n') : `into ${out}`);
await Promise.race([browser.close(), wait(3000)]);
process.exit(errors.length ? 1 : 0);
