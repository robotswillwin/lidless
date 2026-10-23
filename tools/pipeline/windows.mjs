// Windows that show the rooms behind them: each window on a street's picture shows its room as the room's own picture
// has it, in both views. The room's picture is cropped where the window stands and scaled from the cutaway's metre
// (169 px at people 0.6) to the street's (146 px), and set into the glass; frames over the glass are put back as they
// were. The recipe's "windows" says, for each window, where its glass is, where the room's street door and floor are
// on the street, and the room (a recipe folder) with where its own street door and floor are in its picture:
//
//   "windows": [{ "glass": [x, y, w, h], "keep": [[x, y, w, h]], "door": 70, "floor": 862,
//                 "room": "art/radio/shop", "cx": 412, "cy": 790 }]
//
//   npm run asset -- windows <street recipe>      then split the street again
//
// Free: no image model. The street's pictures are written over (their old ones kept in candidates/).

import { mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { loadRecipe, ROOT } from './recipe.mjs';
import { rel } from './shared.mjs';

/** The street's metre over the cutaways': 146 px against 169. */
const K = 146 / 169;

export async function cmdWindows([file]) {
  const r = await loadRecipe(file), windows = r.windows ?? [];
  if (!windows.length) throw new Error(`${rel(r.file)} has no "windows"`);
  await mkdir(join(r.dir, 'candidates'), { recursive: true });
  for (const view of ['concierge', 'raw']) {
    const street = join(r.dir, `${view}.png`), before = await sharp(street).png().toBuffer(), layers = [];
    await copyFile(street, join(r.dir, 'candidates', `${view}-before-windows.png`));
    for (const w of windows) {
      const [gx, gy, gw, gh] = w.glass;
      const x0 = Math.round(w.cx + (gx - w.door) / K), x1 = Math.round(w.cx + (gx + gw - w.door) / K);
      const y0 = Math.round(w.cy - (w.floor - gy) / K), y1 = Math.round(w.cy - (w.floor - gy - gh) / K), top = Math.max(0, y0);
      const lost = Math.round((top - y0) * K);
      const crop = await sharp(join(ROOT, w.room, `${view}.png`)).extract({ left: x0, top, width: x1 - x0, height: y1 - top })
        .resize(gw, gh - lost, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
      layers.push({ input: crop, left: gx, top: gy + lost });
      for (const [kx, ky, kw, kh] of w.keep ?? []) layers.push({ input: await sharp(before).extract({ left: kx, top: ky, width: kw, height: kh }).png().toBuffer(), left: kx, top: ky });
      console.log(`${r.name} ${view}: ${w.room} [${x0}, ${top}, ${x1 - x0}, ${y1 - top}] → window [${w.glass.join(', ')}]`);
    }
    await sharp(before).composite(layers).png().toFile(street);
  }
  console.log(`${r.name}: windows set; split it again for the game`);
}
