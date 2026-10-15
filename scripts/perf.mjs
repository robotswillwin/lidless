// Frame rate per quality tier and screen size, in headless Chrome (reports the GPU it ran on).
// Usage: npm run perf
import puppeteer from 'puppeteer-core';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, "..");
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--allow-file-access-from-files', `--user-data-dir=${resolve(root, 'node_modules/.cache/play-chrome')}`, '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [w, h, dpr, q] of [[960, 540, 1, 'high'], [1920, 1080, 2, 'high'], [1920, 1080, 2, 'medium'], [1920, 1080, 2, 'low']]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr });
  await page.goto('file://' + resolve(root, 'dist/index.html') + `?new&debug&q=${q}`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
  await new Promise((r) => setTimeout(r, 4000));
  const s = await page.$eval('#stats', (e) => e.textContent);
  const gpu = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const d = c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
  console.log(`${w}x${h}@${dpr}x ${q}: ${s} | ${gpu}`);
  await page.close();
}
await browser.close();
