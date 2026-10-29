#!/usr/bin/env node
// The asset pipeline's command line. Run `npm run asset -- help` for the commands. The commands live in images.mjs
// (pictures with the image model), build.mjs (game sprites), characters.mjs (parts, rigs) and scenes.mjs (rooms,
// layers); shared.mjs has what they share.

import { cmdCloseups } from './closeups.mjs';
import { cmdItems } from './items.mjs';
import { cmdWindows } from './windows.mjs';
import { cmdBlink } from './blink.mjs';
import { cmdTurns } from './turns.mjs';
import { cmdLift } from './lift.mjs';
import { resolve } from 'node:path';
import { ROOT } from './recipe.mjs';
import { buildOne } from './build.mjs';
import { cmdParts, cmdRig } from './characters.mjs';
import { cmdErase, cmdExtend, cmdGenerate, cmdImport, cmdNew, cmdPaint, cmdPick, cmdRedress, cmdReframe, cmdSheet, cmdTouch, cmdVariant } from './images.mjs';
import { cmdHotspots } from './hotspots.mjs';
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
      Where the head has a shut eye (blink/), her blink is made from the frames after (see blink), and her turns too.
  npm run asset -- blink <recipe> [more...]
      Her blink: her left eye shut in each frame she stands in facing left, into anims/blinkLeft/, for build. The eye
      was shut once by touch, in blink/<view>-shut.png beside the frame it was touched from (<view>-open.png), in the
      folder of the character whose head the outfit shares (parts.same); each frame's head is found where it moved to
      and the lid set over the eye there. Free.
  npm run asset -- turns <recipe> [more...]
      Her front and back: the pictures the recipe's "turns" names (each a recipe of its own, drawn from her profile, in
      both views) set into her frames as she stands in them, her height, her soles on its ground, her middle on its hip,
      into anims/front/ and anims/back/, for build. Free.
  npm run asset -- erase <recipe> --file <image> --poly "x,y x,y x,y ..."
      Make everything inside the polygon transparent, to clear stray bits off cut-out art. Free; the old image is kept.
  npm run asset -- paint <recipe> --file <image> --box x,y,w,h --like x,y,w,h [--skin]
      Paint the box in the colour of the --like area, keeping its light and shade: a robe's thighs in the robe's
      fabric; with --skin only the skin in it, such as an arm drawn onto a torso. Free; the old image is kept.
  npm run asset -- touch <recipe> --box x,y,w,h --prompt "what to change" [--view raw|concierge] [--from concierge|raw] [--guide guide.png] [--ref design.png] [--quality low|medium] [--frame idle/1] [--dry]
      Change one area of the picked image with GPT Image 2.5 Sunburst, then rebuild. The box is in the picked
      image's pixels. Only a window around it is sent, and only the box is pasted back; the old image is kept
      in candidates/. With --frame, the result becomes that animation frame instead (art/<scene>/<name>/anims/),
      the picked image staying frame 0: everything outside the box is identical in every frame. With --from, the
      area is redrawn from the other view's picture as this view, its outlines in place, after that view was
      changed there: so the two views still line up. --guide redraws the area from a copy of the picture with rough
      flat shapes painted over the box, which keep their place and size: the way to get people and things there at
      their true size against the rest. --ref sends pictures of what to paint there (a design sheet) along. A frame
      made --from the other view is redrawn from that view's same frame.
  npm run asset -- lift <picture recipe> --box x,y,w,h --name <thing> [--prompt "what it is"] [--scene <id>] [--when "<condition>"] [--before <dir>] [--hull]
      A thing she can take or move, lifted out of a scene's picture into a prop of its own: painted out of both views
      (touch, raw view redrawn from the Concierge's), cut from the pictures as they were where they changed (the thing
      and its shadow, not the background drawn again around it), built as a prop that keeps the frame it was cut in,
      and placed in the scene where it was (shown while --when holds). The picture is split again without it. With
      --before, the pictures are already without it: it is cut from the ones in <dir> (concierge.png, raw.png). --hull:
      it is convex (a box, a jar), everything between its edges is it. The box is in the picture's pixels: keep it
      tight, what changed in it besides the thing is cut with it.
  npm run asset -- hotspots <scene> [--view raw|concierge|both] [--scale 1] [--all]
      A review picture of a scene's hotspots over its art, in each view: art/review/<scene>.<view>.png. Layers shown
      only while the story says so are left out unless --all.

  npm run asset -- closeups [--only station] [--n 2] [--quality medium] [--dry]
      Close-ups, a moment shown up close over the dimmed scene, as described in art/closeups/closeups.json: the
      Concierge's view first. --pick station=1 picks it and draws raw view's candidates from it; --pick-raw station=1
      picks that, and both go into public/assets/closeups/<id>.<view>.webp for the story's "# closeup: <id>".
  npm run asset -- items [--only parcel,valve] [--n 2] [--quality medium] [--dry]
      Paint her things for the tray, each real thing she can carry on its own in the game's look, as described in
      art/items/items.json, with its pictures as the style to match: candidates in art/items/<id>/candidates/.
  npm run asset -- items --pick parcel=2,valve=1
      Cut those candidates out square into public/assets/items/<id>.webp, and name them in items.json as the art.
  npm run asset -- items --concierge [--only parcel] [--n 1]
      Edit each thing's picture in the game into the Concierge's view, as art/items/items.json's "concierge" describes
      it: the same thing in the same pose, made over. --pick-concierge parcel=1 puts it in as <id>.concierge.webp.
  npm run asset -- windows <street recipe>
      Set each room into the street windows that look into it, as the recipe's "windows" lists them: the room's own
      picture cropped where the window stands and scaled to the street, in both views. Then split the street again.
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

The API key goes in .env.local as OPENAI_API_KEY=... (never committed).

Any command takes --backend openai|drawthings (or ART_BACKEND=drawthings in the environment). Draw Things is the Mac app
with its API server on (Settings → API Server, HTTP, port 7860; another address: DT_URL=...): free and local, it draws
with the model and settings chosen in the app unless pinned here: --model <file> --steps 20 --cfg 4 --seed 7
--sampler "Euler A Trailing" --strength 0.8 (how far image-to-image may stray from a layout or source)
--lora "file.ckpt:0.8,other.ckpt:0.5" (LoRAs by the file names the app lists, with weights). It takes no
reference images, so the prompt alone carries the style; a layout guide or a source picture is used (tried with Krea 2
Turbo and Z-Image-Turbo: Z-Image draws the flatter picture, at --strength 0.95 for a guide). Give it a guide
without text labels: a diffusion model paints the lettering too.`;

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
// which image model draws, and what a local one is pinned to (see backend.mjs, drawthings.mjs)
if (typeof opt.backend === 'string') process.env.ART_BACKEND = opt.backend;
for (const [flag, env] of [['model', 'DT_MODEL'], ['steps', 'DT_STEPS'], ['cfg', 'DT_CFG'], ['seed', 'DT_SEED'], ['sampler', 'DT_SAMPLER'], ['strength', 'DT_STRENGTH'], ['lora', 'DT_LORA']]) if (typeof opt[flag] === 'string') process.env[env] = opt[flag];
const run = { hotspots: cmdHotspots, closeups: cmdCloseups, items: cmdItems, windows: cmdWindows, blink: cmdBlink, turns: cmdTurns, lift: cmdLift, new: cmdNew, rig: cmdRig, zoom: cmdZoom, extend: cmdExtend, generate: cmdGenerate, variant: cmdVariant, redress: cmdRedress, reframe: cmdReframe, blockout: cmdBlockout, pick: cmdPick, import: cmdImport, sheet: cmdSheet, touch: cmdTouch, split: cmdSplit, ground: cmdGround, erase: cmdErase, paint: cmdPaint, parts: cmdParts, widen: cmdWiden, build: async (files) => { if (!files.length) throw new Error('usage: build <recipe> [more...]'); for (const f of files) await buildOne(f); } }[cmd];
if (!run) console.log(HELP);
else run(pos, opt).catch((e) => { console.error(`error: ${e.message}`); process.exit(1); });
