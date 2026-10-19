// The main street's layers as the camera moves, in headless Chrome. No server needed.
// Usage: npm run check:layers   (builds first; pictures land in shots/layers-*.png)
//
// - The street lamp's pole, held at camera positions a tenth of a screen pixel apart across one pixel: its darkness
//   against the lit cone must stay steady. Cut-out edges that jump a whole pixel at a time made it flicker (12%).
// - The street at both ends of the camera's drift, in both views, for an eye to check for cracks and seams.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
execFileSync('npx', ['vite', 'build', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
mkdirSync(resolve(root, 'shots'), { recursive: true });
for (const f of readdirSync(resolve(root, 'shots'))) if (/^layers-.*\.png$/.test(f)) rmSync(resolve(root, 'shots', f));

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--allow-file-access-from-files', '--hide-scrollbars', `--user-data-dir=${resolve(root, 'node_modules/.cache/play-chrome')}`],
});
const page = await browser.newPage();
// the high tier, at a render scale of 2, as on a desktop
await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const url = 'file://' + resolve(root, 'dist/index.html');
// a still frame (t) with the camera held (cam), in the view asked for
const frame = async (cam, view) => {
  await page.goto(`${url}?new&scene=street&spawn=start&q=high&t=1&cam=${cam}${view === 'raw' ? '&view=raw' : ''}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1' || document.documentElement.dataset.err, { timeout: 20000 });
  const err = await page.evaluate(() => document.documentElement.dataset.err);
  if (err) throw new Error(`the street did not load: ${err}`);
};

let failed = false;
for (const view of ['raw', 'concierge']) {
  const darks = [];
  for (let k = 0; k <= 10; k++) {
    await frame(-9 + k * 0.05, view);
    // the pole, between the lamp's head and its base, against the lit cone
    const buf = await page.screenshot({ clip: { x: 425, y: 330, width: 22, height: 40 } });
    const { data, info } = await sharp(buf).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
    let total = 0;
    for (let y = 0; y < info.height; y++) {
      const row = data.subarray(y * info.width, (y + 1) * info.width), bg = (row[0] + row[1] + row[info.width - 1] + row[info.width - 2]) / 4;
      for (let x = 0; x < info.width; x++) total += Math.max(0, bg - row[x]);
    }
    darks.push(total / info.height);
  }
  const mean = darks.reduce((a, b) => a + b, 0) / darks.length, spread = (100 * (Math.max(...darks) - Math.min(...darks))) / mean;
  const ok = spread < 5;
  if (!ok) failed = true;
  console.log(`${view}: the pole's darkness across one pixel of camera movement varies ${spread.toFixed(1)}% ${ok ? '(steady)' : '(FLICKERS: over 5%)'}`);
  for (const [cam, end] of [[-18, 'left'], [18, 'right']]) {
    await frame(cam, view);
    const file = resolve(root, 'shots', `layers-${view}-${end}.png`);
    await page.screenshot({ path: file });
    console.log(`  ${file.split('/').pop()}`);
  }
}
await browser.close();
if (errors.length) { console.log(`errors:\n${errors.join('\n')}`); failed = true; } else console.log('no errors');
process.exit(failed ? 1 : 0);
