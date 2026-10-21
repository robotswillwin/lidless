// The game played through in headless Chrome, checking what should happen: her outfits and projections, the story
// driving the world, saves, running, scenes in and out of memory. No server needed: it builds and plays dist/.
// Usage: npm run check:play            (builds first)
//        npm run check:play -- --no-build story saves    (only these, on the last build)
// Each check prints ok or FAIL; the run fails if any does.

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const root = resolve(import.meta.dirname, '..');
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2), only = args.filter((a) => !a.startsWith('--'));
if (!args.includes('--no-build')) execFileSync('npx', ['vite', 'build', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
const url = 'file://' + resolve(root, 'dist/index.html');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--allow-file-access-from-files', '--hide-scrollbars'] });
let failed = 0, passed = 0;
const errors = [];

/** A fresh page: no save, less motion (shorter fades), the game at full size. */
async function fresh(query) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewport({ width: 1920, height: 1080 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(`${url}?new&${query}`);
  await ready(page);
  return page;
}
const ready = (page) => page.waitForFunction(() => document.documentElement.dataset.ready === '1' || document.documentElement.dataset.err, { timeout: 30000 }).then(() => wait(1000));
/** A page loaded again with what was saved: a scene asked for, the save's story and clothes. */
async function again(page, query) {
  await page.goto(`${url}?${query}`);
  await ready(page);
}

function check(name, ok, more = '') {
  if (ok) passed++; else failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${more ? ` | ${more}` : ''}`);
}

// what the game saved, and its story's state
const save = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('lidless.save.v1') ?? 'null'));
const ink = async (page) => (await save(page))?.ink ?? '';
// level pixels to the page, a tap there, a verb from the right ball
const at = (page, x, y) => page.evaluate((x, y) => { const c = document.querySelector('canvas').getBoundingClientRect(); return [c.left + (x / 960) * c.width, c.top + (y / 540) * c.height]; }, x, y);
const tap = async (page, x, y) => { const [px, py] = await at(page, x, y); await page.mouse.move(px, py); await page.mouse.down(); await wait(60); await page.mouse.up(); };
const verb = async (page, v) => {
  if (!(await page.$(`[data-verb="${v}"]`))) await page.evaluate(() => document.querySelector('.hud-ball.verbs')?.click());
  await wait(250);
  await page.evaluate((v) => document.querySelector(`[data-verb="${v}"]`)?.click(), v);
  await wait(150);
};
// what the HUD opens: her things (the tray from the left ball), her journal, the map (in her journal), her notebook,
// her saves (the menu)
const panel = async (page, which) => {
  const sel = { things: '.hud-ball.things', journal: '.hud-btn.journal', notebook: '.hud-btn.notebook', map: '.hud-btn.map', saves: '.hud-btn.menu' }[which];
  await page.evaluate((s) => document.querySelector(s)?.click(), sel);
  await wait(which === 'map' ? 800 : 400);
};
// a thing out of her pockets, in her hand: tapped in the tray
const holdThing = async (page, name) => {
  await panel(page, 'things');
  await page.evaluate((n) => document.querySelector(`.hud-tray .slot[data-item="${n}"]`)?.click(), name);
  await wait(300);
};
// a conversation through to its end, or its answers
const talkThrough = async (page, timeout = 12000) => {
  await page.waitForFunction(() => !!document.querySelector('.talk-line:not([hidden]), .talk-choices:not([hidden])'), { timeout }).catch(() => {});
  const said = [];
  for (let k = 0; k < 30 && (await page.$('.talk-line:not([hidden])')); k++) { said.push(await page.$eval('.talk-line', (l) => l.textContent)); await page.keyboard.press(' '); await wait(250); }
  await wait(600);
  return said;
};
// her wardrobe in her flat: an outfit picked from its answers
const wardrobe = async (page, name) => {
  await verb(page, 'hands');
  await tap(page, 736, 297);
  await page.waitForFunction(() => document.querySelectorAll('.talk-choices:not([hidden]) .talk-choice').length > 0, { timeout: 8000 }).catch(() => {});
  const choices = await page.$$eval('.talk-choices:not([hidden]) .talk-choice', (bs) => bs.map((b) => b.textContent));
  await page.evaluate((n) => [...document.querySelectorAll('.talk-choices:not([hidden]) .talk-choice')].find((b) => b.textContent.includes(n))?.click(), name);
  await wait(1500);
  return choices;
};

const checks = {
  /** Her real clothes and the projection over them; changing at home's door; the shower. */
  async outfits() {
    const page = await fresh('scene=home&spawn=door');
    const choices = await wardrobe(page, 'Party dress');
    check('the wardrobe: her own clothes and the projection', choices.join('|') === '1Outdoor clothes (wearing)|2Underwear|3Undressed|4Party dress, projected|5Never mind', choices.join(' / '));
    let s = await save(page);
    check('the party dress projected over her clothes', s?.outfit === 'clothes' && s?.projection === 'party', `${s?.outfit} + ${s?.projection}`);
    await wardrobe(page, 'Underwear');
    s = await save(page);
    check('into her underwear: the projection off', s?.outfit === 'underwear' && !s?.projection, `${s?.outfit} + ${s?.projection}`);
    await wardrobe(page, 'Party dress');
    s = await save(page);
    check('the dress from her underwear: her clothes under it', s?.outfit === 'clothes' && s?.projection === 'party', `${s?.outfit} + ${s?.projection}`);
    await tap(page, 816, 294);
    await wait(4500);
    s = await save(page);
    check('out of the door: her coat on, the projection still on', s?.scene === 'backstreet' && s?.outfit === 'coat' && s?.projection === 'party', `${s?.scene} ${s?.outfit} + ${s?.projection}`);
    await tap(page, 453, 357);
    await wait(4500);
    s = await save(page);
    check('home again: her coat off', s?.scene === 'home' && s?.outfit === 'clothes', `${s?.scene} ${s?.outfit}`);
    await verb(page, 'hands');
    await tap(page, 290, 290);
    await wait(5000);
    s = await save(page);
    check('the shower: undressed, the projection off', s?.outfit === 'nude' && !s?.projection, `${s?.outfit} + ${s?.projection}`);
    await page.close();
  },

  /** The story drives the world: things taken off her desk, the radio mended with one, the parcel delivered. */
  async story() {
    const page = await fresh('scene=home&spawn=door');
    await verb(page, 'take');
    await tap(page, 682, 304);
    await wait(3500);
    check('the parcel taken into her pockets', /Things\.parcel/.test(await ink(page)));
    await verb(page, 'take');
    await tap(page, 646, 296);
    await wait(3000);
    check('the valve taken', /Things\.valve/.test(await ink(page)));
    await holdThing(page, 'valve');
    check('the valve in her hand', ((await page.$eval('.hud-ball.verbs', (b) => b.getAttribute('aria-label'))) ?? '').includes('put it back'));
    await tap(page, 669, 297);
    await talkThrough(page);
    check('the radio mended, a voice under the static', /"radio_heard":\s*true/.test(await ink(page)));
    await panel(page, 'journal');
    const done = await page.$$eval('.hud-panel.journal .entry.done .name', (es) => es.map((e) => e.textContent));
    check('her journal crosses out the radio', done.includes('My radio') && !done.includes('Parcel 4471'), done.join(', '));
    await page.keyboard.press('Escape');
    await again(page, 'scene=radio');
    await holdThing(page, 'parcel');
    await tap(page, 690, 335);
    const said = await talkThrough(page);
    check('the parcel delivered to the fixer', /"parcel_delivered":\s*true/.test(await ink(page)), said.join(' / ').slice(0, 100));
    // the same thing, lifted off her desk, now on his bench: a prop placed in any scene the story wants it
    await verb(page, 'eyes');
    await tap(page, 652, 326);
    await wait(600);
    const note = await page.$eval('.hud-note', (n) => n.textContent).catch(() => '');
    check('her parcel on his bench', /parcel|delivery/i.test(note), note.slice(0, 80));
    await page.close();
  },

  /** Her saves: a slot saved and gone back to; none in the middle of a conversation. */
  async saves() {
    const page = await fresh('scene=home&spawn=door');
    await tap(page, 500, 340);
    await wait(3500);
    await panel(page, 'saves');
    check('her saves: now and three slots', (await page.$$('.hud-panel.menu .save')).length === 4);
    await page.evaluate(() => document.querySelector('[aria-label="Save in slot 1"]')?.click());
    await wait(300);
    const slot = await page.evaluate(() => JSON.parse(localStorage.getItem('lidless.slot.1') ?? 'null'));
    check('saved in slot 1, with where', slot?.v === 2 && slot?.where === "Luna's home" && Math.abs(slot.heroX - 500) < 30, `${slot?.where} ${slot?.heroX}`);
    await page.keyboard.press('Escape');
    await tap(page, 780, 340);
    await wait(3500);
    await panel(page, 'saves');
    await Promise.all([page.waitForNavigation({ timeout: 20000 }).catch(() => {}), page.evaluate(() => document.querySelector('[aria-label="Go back to slot 1"]')?.click())]);
    await ready(page);
    check('back where slot 1 was', Math.abs((await save(page))?.heroX - 500) < 30, String((await save(page))?.heroX));
    await again(page, 'scene=radio');
    await verb(page, 'heart');
    const before = (await save(page))?.savedAt;
    await tap(page, 690, 335);
    const talking = await page.waitForFunction(() => !!document.querySelector('.talk-line:not([hidden]), .talk-choices:not([hidden])'), { timeout: 12000 }).then(() => true).catch(() => false);
    await wait(500);
    check('in a conversation, not saved', talking && (await save(page))?.savedAt === before, `talking ${talking}`);
    await page.close();
  },

  /** The map: where she has been and what she has seen, and going there; her notebook, read only out of its sight. */
  async map() {
    const page = await fresh('scene=home&spawn=door');
    // out through her door: the backstreet, and the way to the main street at its end
    await tap(page, 816, 290);
    await wait(4500);
    await panel(page, 'map');
    const places = await page.$$eval('.chart button.place', (bs) => bs.map((b) => b.getAttribute('aria-label')));
    check('the map: her home and the backstreet, the main street sketched in', places.some((l) => /Luna's home/.test(l)) && places.some((l) => /Backstreet: you are here/.test(l)) && places.some((l) => /Main street: not been there yet/.test(l)), places.join(' / '));
    // home again, from the map
    await page.evaluate(() => [...document.querySelectorAll('.chart button.place')].find((b) => /Luna's home/.test(b.getAttribute('aria-label') ?? ''))?.click());
    await wait(3500);
    check('from the map, home', (await save(page))?.scene === 'home', (await save(page))?.scene);
    // her notebook: open at home, a privacy zone; shut out on the street, where it can see
    await panel(page, 'notebook');
    check('her notebook opens at home', !!(await page.$('.hud-panel.notebook')));
    await page.keyboard.press('Escape');
    await again(page, 'scene=backstreet&spawn=from-street');
    await panel(page, 'notebook');
    const said = await talkThrough(page, 4000);
    check('in its sight her notebook stays shut', !(await page.$('.hud-panel.notebook')) && said.some((l) => /can see/.test(l)), said.join(' / '));
    // no blind spots: in the alley mouth too it stays shut; her journal opens anywhere
    await tap(page, 690, 470);
    await wait(3000);
    await panel(page, 'notebook');
    await talkThrough(page, 4000);
    check('no blind spots: in the alley mouth it stays shut', !(await page.$('.hud-panel.notebook')));
    await panel(page, 'journal');
    check('her journal opens anywhere', !!(await page.$('.hud-panel.journal .entry')));
    await page.close();
  },

  /** Held far from her outdoors, a finger runs her after it until it comes up; a tap walks her there. */
  async run() {
    const page = await fresh('scene=street&spawn=from-backstreet');
    // where she starts, from a step to the right (the save follows her)
    await tap(page, 120, 500);
    await wait(2500);
    const start = (await save(page))?.heroX;
    const [px, py] = await at(page, 875, 500);
    await page.mouse.move(px, py);
    await page.mouse.down();
    await wait(3000);
    await page.mouse.up();
    await wait(200);
    const a = (await save(page))?.heroX;
    await wait(800);
    const b = (await save(page))?.heroX;
    // walking she covers about 100 px a second: held three seconds, running, well over twice that
    check('held far ahead: she ran after it', a - start > 600, `${start} → ${a}`);
    check('let go: she stopped', a === b, `${a} → ${b}`);
    await page.close();
  },

  /** Scenes in and out of memory: back and forth, the textures on the GPU stay level; a fade is short. */
  async scenes() {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewport({ width: 1280, height: 720 });
    await page.evaluateOnNewDocument(() => {
      const P = WebGL2RenderingContext.prototype, live = new Set();
      window.__textures = () => live.size;
      const c = P.createTexture; P.createTexture = function () { const t = c.call(this); live.add(t); return t; };
      const d = P.deleteTexture; P.deleteTexture = function (t) { live.delete(t); return d.call(this, t); };
    });
    await page.goto(`${url}?new&scene=backstreet&spawn=from-street`);
    await ready(page);
    const walk = async (key, ms, run = false) => { if (run) await page.keyboard.down('Shift'); await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); if (run) await page.keyboard.up('Shift'); await wait(2500); };
    const counts = [];
    for (let k = 0; k < 2; k++) {
      await walk('ArrowRight', 2500);
      await walk('ArrowLeft', 11000, true);
      counts.push(await page.evaluate(() => window.__textures()));
    }
    check('back and forth twice: the same textures on the GPU', counts[0] === counts[1], counts.join(' → '));
    await page.close();
  },
};

for (const [name, run] of Object.entries(checks)) {
  if (only.length && !only.includes(name)) continue;
  console.log(`— ${name}`);
  try { await run(); } catch (e) { check(`${name} ran to the end`, false, String(e)); }
}
console.log(`${passed} ok, ${failed} failed${errors.length ? `; errors on the page: ${errors.join(' | ')}` : ''}`);
await Promise.race([browser.close(), wait(3000)]);
process.exit(failed || errors.length ? 1 : 0);
