#!/usr/bin/env node
// The asset pipeline's command line. Run `npm run asset -- help` for the commands. The commands live in images.mjs
// (pictures with the image model), build.mjs (game sprites), characters.mjs (parts, rigs) and scenes.mjs (rooms,
// layers); shared.mjs has what they share.

import { resolve } from 'node:path';
import { ROOT } from './recipe.mjs';
import { buildOne } from './build.mjs';
import { cmdParts, cmdRig } from './characters.mjs';
import { cmdErase, cmdExtend, cmdGenerate, cmdImport, cmdNew, cmdPaint, cmdPick, cmdRedress, cmdReframe, cmdSheet, cmdTouch, cmdVariant } from './images.mjs';
import { cmdBlockout, cmdGround, cmdSplit, cmdWiden, cmdZoom } from './scenes.mjs';

try { process.loadEnvFile(resolve(ROOT, '.env.local')); } catch { /* no .env.local: fine until an API call needs the key */ }

const HELP = `Asset pipeline: generate art with an image AI, clean it and turn it into game sprites.

  npm run asset -- new <scene>/<name> [--kind character|prop|background|portrait]
      Write a recipe to art/<scene>/<name>.json to fill in.
  npm run asset -- generate <recipe> [--n 4] [--quality low|medium|high] [--look pixel|paint|vector] [--view raw|concierge] [--ref a.png,b.png] [--layout guide.png] [--tag name] [--dry]
      Generate candidates with GPT Image 2.5 into art/<scene>/<name>/candidates/: raw-view images, or Concierge
      images for something generated. Style references (the recipe's "references", or --ref) go along with the
      prompt; without any, Flare draws from the prompt alone. --layout gives a rough picture whose composition the
      candidates keep: a sketch, or a scene seen elsewhere in the game. --tag adds a word to the candidates' file names.
      --view concierge draws the Concierge's view of something real first, from its "concierge" description (which
      then says everything there is to see) and its "conciergeReferences"; redress --view raw --from its picture then
      draws raw view with every outline in place, as simple as it. That is how the main street was made.
  npm run asset -- variant <recipe> [--n 2] [--quality medium] [--ref a.png] [--tag name] [--dry]
      Edit the picked raw image into Concierge-view candidates (GPT Image 2.5 Sunburst). The recipe's
      "conciergeReferences", or --ref, go along as style references for the augmented view.
  npm run asset -- redress <recipe> --prompt "what to change" [--view raw|concierge] [--from image] [--ref a.png] [--n 2] [--quality medium] [--dry]
      Edit the picked image of one view into new candidates of the same view: the same layout, every outline in
      place, with surfaces, wear and details changed as the prompt says. Pick one, and remake the other view if the
      outlines must still match it. --from edits another image instead, such as layout.png from blockout: painted
      this way, a blockout keeps every object exactly where and how big it is.
  npm run asset -- reframe <recipe> --scale 0.8 --floor <y> [--view raw|concierge] [--quality medium] [--dry]
      Shrink the picked image of a view around its floor line (y, in the image's pixels) and have GPT Image 2.5
      Sunburst paint the new edges: a set drawn too big for the characters gets their scale and keeps what is in it.
      Prints how scene coordinates move. Remake the other view with variant afterwards, so the two still match.
  npm run asset -- extend <recipe> --from <image> --box x,y,width [--view raw|concierge] [--n 2] [--dry]
      Place a picture, such as a concept panel wider than the screen, in the recipe's frame at the box, and have
      GPT Image 2.5 Sunburst paint the rest of the frame around it in its own style. The picture stays as it is.
  npm run asset -- widen <recipe> --prompt "what comes next" --raw-prompt "the same in raw view" [--tile 2400] [--overlap 960] [--dry]
      Widen a background to the right by one tile, in both views, for a street that scrolls: the Concierge's view
      painted on from its end, then raw view redrawn from that tile, so the two line up. The old pictures are kept.
  npm run asset -- zoom <scene id> --scale 0.6 [--dry]
      Pull a scene's camera back: in its scene file every place, hotspot, light and spawn moves toward the middle and
      the walk line by the scale, its people are drawn that much smaller (actorScale), and its walk line stays where it
      is. For each background layer it writes layout-zoom-raw.png (and -concierge) to the recipe's candidates/: the
      picked image shrunk the same way inside a blur of itself, to redraw with generate --layout, which continues the
      place into the blur. Give the recipe the same "scale" first. Free.
  npm run asset -- blockout <recipe>
      Draw the recipe's "blockout", a room built from boxes in metres, in true perspective, as layout.png: the guide
      for generate --layout, so every object comes out at its real size against the characters. layout-check.png
      shows Luna and the fixer standing in it, to judge the scale by eye. Free.
  npm run asset -- sheet <recipe>
      Lay all candidates side by side at game size, finished as the build would, to choose between them.
  npm run asset -- parts <recipe> [--view raw|concierge] [--side left --mirror] [--recut [--swap a,b]] [--quality low|medium] [--dry]
      Have GPT Image 2.5 Sunburst draw the character as a sheet of separate body parts (head, torso, coat, upper arm,
      forearm, thigh, shin) following a template, and cut them out with their joints into art/<scene>/<name>/parts/.
      The raw sheet is drawn from the recipe's parts.from image (default raw.png); the Concierge sheet is the raw
      sheet edited, so the parts match. --dry only writes the template. Each cut writes <view>-check.png, every piece
      outlined and named; --recut cuts the sheet again, and --swap forearm,thigh puts two pieces the cut took for each
      other right, kept in the recipe's parts.at. Clothes other than a long coat say what each piece is in parts.pieces.
      --preview walks the parts in a GIF; --bake renders a standing frame and the walk from them into anims/.
  npm run asset -- rig <recipe> [--render-only]
      Rig the character's parts in Blender: one skeleton for both outfits and sides, the walk keyed with the coat and
      the arms following through, frames rendered into anims/ for build. Saves art/<scene>/<name>/rig/<name>.blend, the
      file to change the walk in by hand; --render-only renders that file as it is. Needs Blender on the PATH.
  npm run asset -- erase <recipe> --file <image> --poly "x,y x,y x,y ..."
      Make everything inside the polygon transparent, to clear stray bits off cut-out art. Free; the old image is kept.
  npm run asset -- paint <recipe> --file <image> --box x,y,w,h --like x,y,w,h [--skin]
      Paint the box in the colour of the --like area, keeping its light and shade: a robe's thighs in the robe's
      fabric; with --skin only the skin in it, such as an arm drawn onto a torso. Free; the old image is kept.
  npm run asset -- touch <recipe> --box x,y,w,h --prompt "what to change" [--view raw|concierge] [--quality low|medium] [--frame idle/1] [--dry]
      Change one area of the picked image with GPT Image 2.5 Sunburst, then rebuild. The box is in the picked
      image's pixels. Only a window around it is sent, and only the box is pasted back; the old image is kept
      in candidates/. With --frame, the result becomes that animation frame instead (art/<scene>/<name>/anims/),
      the picked image staying frame 0: everything outside the box is identical in every frame.
  npm run asset -- ground <recipe> --from <y> [--smooth 20]
      Take the painted reflections out of a picture's wet ground, below the reflection line y (level pixels), in both
      views, so the engine's live ones (the look's "Mirror the set") are the only ones: painted reflections stay put
      while what they reflect slides with the camera. --smooth (level pixels) is how far up and down the ground is
      averaged, so lines across it go. The old pictures are kept in candidates/. Free.
  npm run asset -- split <recipe> --map
  npm run asset -- split <recipe> [--scene <id>] [--quality medium] [--reuse] [--dry]
      Split a background into layers that move at their own speed (the recipe's "split": its layers, far to near, each
      with its parallax, and the walk line). --map draws layers.png, one colour per layer, from the picture's depth
      (a model run on this machine, downloaded once) and the recipe's fixes; check it in layers-preview.png and paint
      over it if need be. Then each layer is cut from both views, GPT Image 2.5 Sunburst paints what nearer layers hide
      behind it and a margin past the screen's edges, and it is built as an asset of its own, <name>-<layer>. --scene
      puts the layers in that scene's file in place of the picture. A fill made from the same picture, mask and prompt
      is used again; --reuse keeps the fills already made, whatever they were made from. A view with things of its own
      can have its own map, layers-raw.png or layers-concierge.png, used for that view instead of layers.png.
  npm run asset -- pick <recipe> <candidate>
      Use a candidate, e.g. raw-03 or concierge-01.
  npm run asset -- import <recipe> <image> [--as raw|concierge]
      Use an image made elsewhere, by hand or with another AI. Transparent PNGs work best;
      otherwise ask for a plain, bright, single-colour backdrop so it can be removed.
  npm run asset -- build <recipe> [more recipes...]
      Clean, size, palette-fit and derive the lighting maps into public/assets/<scene>/<name>/.

A recipe's "exists" says which views it is in:
  both        real (the default). A "concierge" description gives it a dressed-up look too: augmented.
  concierge   generated: the Concierge made it up, so raw view shows nothing there.
  raw         real, but the Concierge edits it out: only raw view shows it.

The API key goes in .env.local as OPENAI_API_KEY=... (never committed).`;

function parse(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2), v = argv[i + 1]; if (v === undefined || v.startsWith('--')) opt[k] = true; else { opt[k] = v; i++; } }
    else pos.push(a);
  }
  return { pos, opt };
}

const [cmd, ...rest] = process.argv.slice(2), { pos, opt } = parse(rest);
const run = { new: cmdNew, rig: cmdRig, zoom: cmdZoom, extend: cmdExtend, generate: cmdGenerate, variant: cmdVariant, redress: cmdRedress, reframe: cmdReframe, blockout: cmdBlockout, pick: cmdPick, import: cmdImport, sheet: cmdSheet, touch: cmdTouch, split: cmdSplit, ground: cmdGround, erase: cmdErase, paint: cmdPaint, parts: cmdParts, widen: cmdWiden, build: async (files) => { if (!files.length) throw new Error('usage: build <recipe> [more...]'); for (const f of files) await buildOne(f); } }[cmd];
if (!run) console.log(HELP);
else run(pos, opt).catch((e) => { console.error(`error: ${e.message}`); process.exit(1); });
