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
  await page.goto(`${url}?new&fast&${query}`);
  await ready(page);
  return page;
}
const ready = (page) => page.waitForFunction(() => document.documentElement.dataset.ready === '1' || document.documentElement.dataset.err, { timeout: 30000 }).then(() => wait(1000));
/** A page loaded again with what was saved: a scene asked for, the save's story and clothes. */
async function again(page, query) {
  await page.goto(`${url}?fast&${query}`);
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
// the Concierge's card, opened from its presence, and a button in it (Talk, Ask about something)
const coCard = async (page, press) => {
  await page.evaluate(() => { if (!document.querySelector('.co-card')) document.querySelector('.co-head')?.click(); });
  await wait(300);
  if (press) await page.evaluate((t) => [...document.querySelectorAll('.co-foot > button')].find((b) => b.textContent === t)?.click(), press);
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
  // a tap shows it close up; Use takes it out
  await page.evaluate((n) => document.querySelector(`.hud-tray .slot[data-item="${n}"]`)?.click(), name);
  await wait(200);
  await page.evaluate(() => document.querySelector('.hud-inspect .row .primary')?.click());
  await wait(300);
};
// a conversation through to its end, or its answers: through its pauses too, while the game does what a line says
const talkThrough = async (page, timeout = 12000) => {
  await page.waitForFunction(() => !!document.querySelector('.talk-line:not([hidden]), .talk-choices:not([hidden])'), { timeout }).catch(() => {});
  const said = [], until = Date.now() + 30000;
  while (Date.now() < until) {
    const st = await page.evaluate(() => ({ talking: 'talking' in (document.querySelector('.hud')?.dataset ?? {}), line: document.querySelector('.talk-line:not([hidden])')?.textContent ?? null, choices: !!document.querySelector('.talk-choices:not([hidden])') }));
    if ((!st.talking && st.line === null) || st.choices) break;
    if (st.line !== null) { if (said.at(-1) !== st.line) said.push(st.line); await page.keyboard.press(' '); }
    await wait(250);
  }
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

// an answer picked from the list, by its words
const choose = async (page, words) => {
  await page.waitForFunction(() => document.querySelectorAll('.talk-choices:not([hidden]) .talk-choice').length > 0, { timeout: 12000 }).catch(() => {});
  await page.evaluate((w) => [...document.querySelectorAll('.talk-choices:not([hidden]) .talk-choice')].find((b) => b.textContent.includes(w))?.click(), words);
  await wait(400);
};
// with a verb chosen, the pointer swept along a row of the screen until what it lights up is called `name`: where it is
const findThing = async (page, name, y = 420) => {
  for (let sx = 0.02; sx < 1; sx += 0.01) {
    const [px, py] = await page.evaluate((sx, y) => { const c = document.querySelector('canvas').getBoundingClientRect(); return [c.left + sx * c.width, c.top + (y / 540) * c.height]; }, sx, y);
    await page.mouse.move(px, py);
    await wait(25);
    const n = await page.$eval('.hud-mark .name', (e) => e.textContent).catch(() => '');
    if (n.includes(name)) return [px, py];
  }
  return null;
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

  /**
   * Every verb answers everything: a machine its own reply, a thing with nothing of its own a standard one (another the
   * next time), the Concierge that it cannot see into a privacy zone; her things named under their pictures, a tap
   * showing one close up.
   */
  async actions() {
    const page = await fresh('scene=backstreet&spawn=from-street');
    const noteAfter = async (v, x, y, ms = 3500) => {
      await verb(page, v);
      await tap(page, x, y);
      await wait(ms);
      return page.$eval('.hud-note', (n) => n.textContent).catch(() => '');
    };
    const bot = await noteAfter('heart', 610, 410);
    check('talked to, the repair bot answers in its own way', /Bzzzzz, bzzzzt/.test(bot), bot.slice(0, 70));
    await page.keyboard.press('Escape');
    await again(page, 'scene=home&spawn=door');
    // (she walks to it from the door first)
    const first = await noteAfter('take', 506, 333, 6000), second = await noteAfter('take', 506, 333, 1200);
    check('taking the bed: a standard reply, and another the next time', !!first && !!second && first !== second, `${first.slice(0, 40)} | ${second.slice(0, 40)}`);
    // (the verbs stay out once chosen from)
    await page.evaluate(() => { if (!document.querySelector('.hud-menu.verbs')) document.querySelector('.hud-ball.verbs')?.click(); });
    await wait(250);
    const verbs = await page.$$eval('.hud-menu.verbs [data-verb]', (bs) => bs.map((b) => b.dataset.verb));
    check('her four verbs at the ball, asking at the Concierge', verbs.join() === 'eyes,heart,hands,take', verbs.join());
    await page.evaluate(() => document.querySelector('.hud-ball.verbs')?.click());
    // at home it cannot hear her: its card says so, with no talking to it and no asking
    await coCard(page);
    const home = await page.$eval('.co-card', (c) => ({ quiet: c.querySelector('.co-foot .quiet')?.textContent ?? '', buttons: c.querySelectorAll('.co-foot > button').length })).catch(() => null);
    check('at home its card says it cannot hear her: no talking to it, no asking', /cannot hear/.test(home?.quiet ?? '') && home?.buttons === 0, JSON.stringify(home));
    await page.keyboard.press('Escape');
    // out in the backstreet: its card, asking it about something, talking to it
    await again(page, 'scene=backstreet&spawn=from-street');
    await coCard(page);
    const opened = await page.$eval('.co-card', (c) => ({ words: c.querySelector('.co-words')?.textContent ?? '', reminders: c.querySelectorAll('.co-reminders li').length, readouts: c.querySelector('.co-readouts')?.textContent ?? '', buttons: [...c.querySelectorAll('.co-foot > button')].map((b) => b.textContent) })).catch(() => null);
    check('its card: what it would have her do, her errands, how she is, Talk and Ask', !!opened?.words && opened.reminders > 0 && /bpm/.test(opened.readouts) && /credits/.test(opened.readouts) && opened.buttons.join() === 'Talk,Ask about something', JSON.stringify(opened)?.slice(0, 150));
    await coCard(page, 'Ask about something');
    const listening = await page.$eval('.co', (c) => c.dataset.state === 'listening' && /About what/.test(c.textContent ?? ''));
    check('asked about something, it listens: "About what, Luna?"', listening);
    await tap(page, 182, 333);
    await wait(3500);
    const answered = await page.$eval('.co-say', (t) => t.textContent).catch(() => '');
    check('asked about the store, it answers in its own words', /Drinks, tobacco/.test(answered), answered.slice(0, 70));
    await coCard(page, 'Talk');
    await wait(1500);
    const talk = await page.$eval('.co-card', (c) => ({ said: [...c.querySelectorAll('.msg.its')].map((m) => m.textContent), answers: [...c.querySelectorAll('.co-choices button')].map((b) => b.textContent) })).catch(() => null);
    check('talked to, it speaks in its card, and she has answers', talk?.said.length === 1 && (talk?.answers.length ?? 0) >= 2, JSON.stringify(talk)?.slice(0, 150));
    await page.evaluate(() => [...document.querySelectorAll('.co-choices button')].find((b) => /How am I/.test(b.textContent ?? ''))?.click());
    await wait(1800);
    const thread = await page.$$eval('.co-thread .msg', (ms) => ms.map((m) => `${m.className}: ${m.textContent}`));
    check('her answer on the right, its reply in its voice', thread.some((m) => /msg hers: How am I/.test(m)) && thread.filter((m) => /msg its/.test(m)).length === 2, thread.join(' | ').slice(0, 150));
    await page.evaluate(() => [...document.querySelectorAll('.co-choices button')].find((b) => /Nothing, thank you/.test(b.textContent ?? ''))?.click());
    await wait(1800);
    const after = await page.$$eval('.co-foot > button', (bs) => bs.map((b) => b.textContent));
    check('said through, it is over, and its card offers Talk and Ask again', after.join() === 'Talk,Ask about something', after.join());
    await page.keyboard.press('Escape');
    await panel(page, 'things');
    const names = await page.$$eval('.hud-tray .slot', (ss) => ss.map((s) => {
      const pic = s.querySelector('.picture :is(img, svg)')?.getBoundingClientRect(), l = s.querySelector('.label'), lr = l?.getBoundingClientRect();
      return { text: l?.textContent, shown: !!lr && lr.height > 0 && getComputedStyle(l).opacity !== '0', clear: !!pic && !!lr && pic.bottom <= lr.top + 1 };
    }));
    check('her things named under their pictures, clear of them, without a hover', names.length > 0 && names.every((n) => n.shown && n.text && n.clear), names.map((n) => `${n.text}${n.clear ? '' : ' (covered)'}`).join(', '));
    await page.evaluate(() => document.querySelector('.hud-tray .slot')?.click());
    await wait(250);
    const card = await page.$eval('.hud-inspect', (c) => ({ name: c.querySelector('h2')?.textContent, use: c.querySelector('.row .primary')?.textContent })).catch(() => null);
    check('a tap on a thing shows it close up, Use on it', !!card?.name && card.use === 'Use', `${card?.name} · ${card?.use}`);
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
    const over = await page.evaluate(() => {
      const box = (re) => [...document.querySelectorAll('.chart button.place')].find((b) => re.test(b.getAttribute('aria-label') ?? ''))?.getBoundingClientRect();
      const home = box(/Luna's home/), street = box(/Backstreet/), stem = document.querySelector('.chart line.link');
      return home && street ? { above: home.bottom < street.top + 10, joined: !!stem } : null;
    });
    check('her home above the backstreet, joined to its door', !!over?.above && over.joined, JSON.stringify(over));
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

  /** The nutrition station: used up close, then not needed again for a while; who sits at it takes turns once she sees. */
  async station() {
    const page = await fresh('scene=street&spawn=start');
    await verb(page, 'hands');
    await tap(page, 700, 380);
    const shown = await page.waitForFunction(() => !!document.querySelector('.hud-closeup img'), { timeout: 15000 }).then(() => true).catch(() => false);
    const src = await page.$eval('.hud-closeup img', (i) => i.getAttribute('src')).catch(() => '');
    await talkThrough(page);
    await wait(700);
    check('the station: her wrist in the cuff, up close', shown && /closeups\/station\.concierge\.webp/.test(src), src);
    check('the close-up goes with the conversation', !(await page.$('.hud-closeup:not(.out)')));
    check('fed: the story keeps when', /"fed_at":\s*0\b/.test(await ink(page)));
    // the camera has followed her along the street: the station found where it is on screen now
    await verb(page, 'hands');
    if (await findThing(page, 'Nutrition station', 380)) { await page.mouse.down(); await wait(60); await page.mouse.up(); }
    await page.waitForFunction(() => !!document.querySelector('.hud-note'), { timeout: 8000 }).catch(() => {});
    const note = await page.$eval('.hud-note', (n) => n.textContent).catch(() => '');
    check('used again at once: she does not need it now', /don't need it/.test(note), note);
    await page.close();
    // raw view opened at the fixer's: out on the street the woman is there; back again, someone else's turn
    const p2 = await fresh('scene=radio');
    await verb(p2, 'heart');
    await tap(p2, 690, 335);
    await choose(p2, 'not here about a radio');
    await talkThrough(p2, 4000);
    await choose(p2, 'Do it');
    await talkThrough(p2, 4000);
    await tap(p2, 230, 330);
    await wait(4000);
    const first = await ink(p2);
    await tap(p2, 304, 350);
    await wait(4000);
    await tap(p2, 230, 330);
    await wait(4000);
    const second = await ink(p2);
    // the story's save leaves out what is as it began: the woman, if it says nobody else
    const seat = (json) => (json.match(/"station_seat":"\^([^"]*)"/) ?? [null, 'woman'])[1];
    check('with raw view, out on the street: the woman at the station', /"has_raw":\s*true/.test(first) && seat(first) === 'woman', `has_raw ${/"has_raw":\s*true/.test(first)}, seat ${seat(first)}`);
    check('back again: her seat taken by someone else, or nobody', seat(second) !== 'woman', `seat ${seat(second) || 'nobody'}`);
    await p2.close();
  },

  /** The guardian on its round: it stops for her and speaks of keeping the street safe. */
  async guardian() {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewport({ width: 1920, height: 1080 });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluateOnNewDocument(() => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('lidless.save.v1', JSON.stringify({ v: 2, scene: 'street', heroX: 1480, facing: 1, view: 1, ink: null })); });
    await page.goto(`${url}?notitle&fast`);
    await ready(page);
    await verb(page, 'heart');
    const at = await findThing(page, 'Civic guardian');
    if (at) { await page.mouse.down(); await wait(60); await page.mouse.up(); }
    await page.waitForFunction(() => !!document.querySelector('.talk-line:not([hidden])'), { timeout: 12000 }).catch(() => {});
    const said = await page.$eval('.talk-line', (l) => `${l.dataset.voice}: ${l.textContent}`).catch(() => '');
    check('the guardian: found on its round, it speaks of keeping the street safe', !!at && /^co: .*safe/.test(said), said);
    await page.close();
  },

  /** The public restroom: a privacy room, her notebook opens there; coming back too often, the Concierge notices. */
  async restroom() {
    const page = await fresh('scene=street&spawn=from-restroom');
    // its door, where it is on screen: found with Look, then walked through with the verb put down
    const through = async () => {
      await verb(page, 'eyes');
      const at = await findThing(page, 'Rest rooms', 360);
      // the verb put down: its slot tapped again
      await page.evaluate(() => document.querySelector('[data-verb="eyes"]')?.click());
      await wait(150);
      if (at) { await page.mouse.move(at[0], at[1]); await page.mouse.down(); await wait(60); await page.mouse.up(); }
      await wait(3500);
    };
    await through();
    check('through the restroom door', (await save(page))?.scene === 'restroom', (await save(page))?.scene);
    await panel(page, 'notebook');
    check('a privacy room: her notebook opens there', !!(await page.$('.hud-panel.notebook')));
    await page.keyboard.press('Escape');
    const out = async () => { await tap(page, 844, 300); await wait(3500); };
    await out();
    await through();
    await out();
    check('twice in a while: not noticed yet', !(await page.$('.co-say')));
    await through();
    await out();
    const toast = await page.$eval('.co-say', (t) => t.textContent).catch(() => '');
    check('a third time: the Concierge notices, and says so', /Back again so soon/.test(toast) && (await save(page))?.attention === 1, `${toast} | attention ${(await save(page))?.attention}`);
    await page.close();
  },

  /** The title screen as the game opens, over its first scene; the settings, kept, from the menu at the top right. */
  async title() {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`${url}?fast`);
    await ready(page);
    check('the title screen, as the game opens', !!(await page.$('.title-screen')) && (await page.$eval('.title-screen .logo', (n) => n.textContent)) === 'Lidless');
    // its settings and how to play, laid out as they should be: small labels, everything on the screen, at a laptop's
    // size and at a phone's held sideways
    for (const [w, h] of [[1280, 720], [844, 390]]) {
      await page.setViewport({ width: w, height: h });
      for (const item of ['Settings', 'How to play']) {
        await page.evaluate((label) => [...document.querySelectorAll('.title-screen .menu button')].find((b) => b.textContent === label)?.click(), item);
        await wait(200);
        const laid = await page.evaluate(() => {
          const box = document.querySelector('.title-screen'), logo = box.querySelector('.logo').getBoundingClientRect();
          const labels = [...box.querySelectorAll('.panel .name')].map((n) => parseFloat(getComputedStyle(n).fontSize));
          return { labels: Math.max(...labels), logoTop: logo.top, fits: box.scrollHeight <= box.clientHeight + 1 || box.scrollTop >= 0 };
        });
        check(`${item} on the title screen at ${w}×${h}: small labels, the logo on screen`, laid.labels <= 18 && laid.logoTop >= 0, `labels ${laid.labels}px, logo at ${Math.round(laid.logoTop)}`);
        await page.evaluate(() => document.querySelector('.title-screen .back')?.click());
        await wait(150);
      }
    }
    await page.setViewport({ width: 1920, height: 1080 });
    await page.evaluate(() => document.querySelector('.title-screen .menu button.primary')?.click());
    await wait(800);
    check('in: the title gone, the game to play', !(await page.$('.title-screen')) && !(await page.$eval('.stage', (s) => 'title' in s.dataset)));
    await panel(page, 'saves');
    await page.evaluate(() => [...document.querySelectorAll('.hud-panel.menu .tab')].find((t) => t.textContent === 'Settings')?.click());
    await wait(300);
    await page.evaluate(() => [...document.querySelectorAll('.settings .choice')].find((c) => c.textContent === 'Large')?.click());
    await wait(200);
    const ts = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ts').trim());
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('lidless.settings') ?? '{}').text);
    check('settings from the menu: large text, applied and kept', ts === '1.22' && kept === 'large', `--ts ${ts}, kept ${kept}`);
    await page.evaluate(() => document.querySelector('.hud-panel.menu .to-title')?.click());
    await wait(500);
    check('the menu leads back to the title screen', !!(await page.$('.title-screen')));
    await page.evaluate(() => localStorage.removeItem('lidless.settings'));
    await page.close();
  },

  /** An old machine's screen: shut files, a password in a careless history, root, and the story keeps what she read. */
  async terminal() {
    const page = await fresh('scene=home&terminal=relay7');
    await page.waitForSelector('.terminal .line:not([hidden])', { timeout: 15000 });
    const type = async (line) => { await page.type('.terminal input', line); await page.keyboard.press('Enter'); await wait(80); };
    const last = (n = 1) => page.$$eval('.terminal .out .l', (ls, k) => ls.slice(-k).map((l) => l.textContent), n);
    const prompt = () => page.$eval('.terminal .prompt', (p) => p.textContent);
    check('the machine comes up: its message, then its prompt', /^okafor@relay7:~\$ $/.test(await prompt()) && (await page.$eval('.terminal .out', (o) => o.textContent)).includes('Municipal Relay Authority'), await prompt());
    await type('cat /root/handover.txt');
    check('root\'s files are shut to her', (await last())[0] === 'cat: /root/handover.txt: Permission denied', (await last())[0]);
    await type('cat .sh_history');
    check('her history: a password typed where a command goes', (await last(12)).includes('w1nter-carrier'));
    await type('su');
    check('su asks for the password, hidden as it is typed', (await page.$eval('.terminal input', (i) => i.type)) === 'password');
    await type('w1nter-carrier');
    check('the password opens root', (await prompt()).endsWith('# '), await prompt());
    await type('cat /root/handover.txt');
    check('root reads the handover', (await last(10)).some((l) => l.includes('HANDOVER')));
    await type('exit');
    await type('exit');
    const gone = await page.waitForFunction(() => !document.querySelector('.terminal'), { timeout: 5000 }).then(() => true).catch(() => false);
    const story = await ink(page);
    check('switched off: the screen goes, the story keeps what she found', gone && /"relay7_root":\s*true/.test(story) && /"relay7_handover":\s*true/.test(story));
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
