# Lidless

A narrative adventure in a city run by the Concierge, a polite AI with very hard rules.
Everyone wears a visor over one eye and sees its dressed-up version of the world; the raw view is an illegal mod.

Web first in TypeScript, with a custom WebGL 2 renderer: 2D lighting with normal maps, a raw and a Concierge
look for every object, wet reflections, rain, depth of field, bloom and a film grade.
The same build is meant to ship to iOS and Android (Capacitor) and desktop (Tauri).

## Run it

```bash
npm install
npm run dev
```

Then open the address Vite prints.

- Made for a phone held sideways; a mouse works the same way, and nothing needs it to hover. Tap anywhere to walk
  there; further off she jogs, and further still she runs, speeding up and slowing down through the gaits, her last
  steps walked. Tapping a door or the end of the street walks her there and through. Arrow keys or A/D walk too, with
  Shift she runs.
- **The ball at the bottom right** slides out what she can do along the bottom: Look, Talk, Use, Take, and in
  Concierge view Ask (its bell). They stay out until the ball is tapped again, or the other one. Choose one, then press
  and slide over the scene: what that verb does something to lights up under your finger (framed by the Concierge in
  its view, ringed in her pencil in raw view), and letting go does it. What she finds is written at the thing, the
  Concierge's card in its view, her pencil note in raw view, for as long as it takes to read; tapping it, or giving her
  something else to do, clears it. Right-click puts the verb down, or looks; **Esc** puts it down.
- **The ball at the bottom left** slides out her things (her pockets in raw view), her notebook, the view switch once
  she has it, and in Concierge view *Assistance*, which asks the Concierge for a hint. **N** opens the notebook, **I**
  her things, **Esc** closes.
- Talk to the fixer in the radio shop. Once he has opened your eye, **E** or her temple (with her things) switches
  between Concierge view and raw view, and many things read differently. On the dev server, E works from the start.
- Conversations go as in Monkey Island: each line over the head of whoever says it, in their colour (hers, the
  fixer's amber, the Concierge's cyan), narration quietly at the top, one line at a time for as long as it takes to
  read; a tap, a click or **Space** moves on. Her answers are a list along the bottom between the balls (number keys
  pick them), and the one she picks she says over her head. The balls stay, resting, while she talks. **Q** cycles the
  quality tiers.
- **L** opens the look panel: pixel size and shape, colour levels and dither, lights, haze, bloom, light shafts,
  raw-view fog and rain, how lights behind characters fill and rim them, how much glow shows over them and the light
  they are shown in, exposure, contrast, saturation, temperature, tint, vignette, grain, colour fringes and depth of
  field, all live. Each setting is shared by both views, or split (its **both** button): then raw view and Concierge
  view have values of their own, and the slider edits the view on screen.
- Its **Reflections** group sets how wet ground mirrors the set and the people: strength, mirroring a painted set,
  how far up the reflection reaches and how far lights streak (see [docs/ASSETS.md](docs/ASSETS.md), Reflections).
- The panel edits the game's look (**All scenes**) or the scene on screen (**This scene**): a scene sets some settings
  its own way over the game's look, marked with a dot, and × takes one back to the game's value. Tuning is kept in
  the browser until what it was made against changes, so a browser never shows the game through settings made for
  art that is gone. **Save** (on the dev server) writes the game's look to `public/assets/look.json`, or the scene's
  own settings into its scene file, under `look`.
- The game saves as you go. Add `?new` to the address to start over, `?debug` to see the tier and frame rate.

Other commands:

- `npm run build` type-checks and builds to `dist/`.
- `npm run shot -- "t=3" "t=3&view=raw" "bench.html?asset=cast/hero"` builds and saves screenshots to `shots/` with headless Chrome. No server needed.
- `npm run play` builds and plays a scripted run (look, talk to the fixer, switch view, reload) with a screenshot per step.
- `npm run perf` builds and reports the frame rate per quality tier, up to a 4K canvas.
- `npm run asset -- rig art/cast/hero.json` rigs Luna in Blender and renders her walk (needs Blender: `brew install --cask blender`). See docs/ASSETS.md, "Characters".
- `node tools/styleframe/export.mjs` regenerates the old hand-coded street layers in `public/assets/street` (sky, crowd, set), which the main street no longer uses.

Address options: `new`, `view=raw` (skips the mod), `q=low|medium|high`, `t=<seconds>` to freeze time, `debug`,
`scene=<id>&spawn=<place>` to start in any scene.

## Scenes and the scene editor

The world is `public/assets/world.json`: its scenes, where the game starts and who the hero is. Each scene is
`public/assets/scenes/<id>/scene.json`:

- its layers, which are built assets, placed. A character placed as a layer plays its idle loop, and `"facing": -1` turns it to the left;
- its lights;
- its kind: exteriors are outside and rainy in raw view, interiors inside;
- its areas of the other kind, such as a shop's inside seen from the street;
- the walk line and the places to arrive at (spawns);
- its hotspots.

A hotspot with `go` is an exit to another scene. Over an end of the walk line, walking into it leaves too.

The scenes so far: Luna's home (`home`), the backstreet, the main street and the radio repair (`radio`). Entrance 3 on the
backstreet leads home, and the radio repair's door on the main street leads into the shop, where the fixer works.

**The scene editor**, `/editor.html` on the dev server, shows a scene rendered as in the game, and Luna to judge the
light on.

- **Moving:** drag lights, hotspots, exits, spawns, areas, the walk line and the reflection line; arrows nudge the
  selection.
- **Editing:** the selected item's settings in the side panel.
- **Lights:** colour, strength, reach, height, cone, haze, shadows, flicker, whether they are behind, among or in
  front of the characters, Concierge view only, and machine lights. **+ Light** places one of its own or one of a kind
  (a preset, shared by every scene: see [docs/ASSETS.md](docs/ASSETS.md#kinds-of-light-presets)).
- **Suggest lights from the art** (the scene's settings): lights where the art glows, in its colour and in the views it
  glows in, drawn with dashed rings to keep, move or discard.
- **Lighting view** (G, or **Lighting**): every surface a flat grey, so all that shows is what the lights do.
- **Ground** (the scene's settings): the floor the engine draws below the reflection line, its slabs, kerb and
  puddles; how wet, shiny and worn it is in each view is in the look panel (see
  [docs/ASSETS.md](docs/ASSETS.md#painted-scenes)).
- **Luna:** drag her, turn her, have the camera move with her, or have her follow the pointer along the walk line to
  see the light fall on her as she walks.
- **Adding:** new scenes from a built background, and layers from any built asset.
- **Effects** (**+ Effect**): steam and smoke, light shafts, beacons, drips and movers, each drawn over the scene to
  drag (a mover's band and its two ends), with its settings in the side panel; the scene's settings list them all.
  Things on a far layer (a mover, a hotspot or light with a parallax) are drawn where they are with the camera moved.
- **Layers:** each with its parallax, and whether it is drawn in front of the people. A scene no wider than the screen
  can have the camera follow Luna a little (its drift, in the scene's settings); **Move the camera with her** previews
  it with Luna where she stands in the editor.
- **Keys:** E switches view, L opens the look panel, G the lighting view, Cmd+Z undoes, Cmd+S saves.

Save writes the scene file, and an open game tab reloads the scene at once. In the game on the dev server, the key left
of 1 (`` ` ``) opens the editor on the scene she is in, in the view on screen, always in the same tab.

## Making assets

Art is generated with an image AI, then cleaned and turned into game sprites by `tools/pipeline`:

```bash
npm run asset -- new street/dock-worker --kind character
npm run asset -- generate art/street/dock-worker.json
npm run asset -- pick art/street/dock-worker.json raw-02
npm run asset -- variant art/street/dock-worker.json
npm run asset -- pick art/street/dock-worker.json concierge-01
npm run asset -- build art/street/dock-worker.json
```

1. `new` writes a recipe to fill in: what it is, how the Concierge dresses it up, and which views it exists in. A
   background that is a room gets `"interior": true`, which frames it as a room instead of a street, and `"relics": true`
   keeps old devices retro in Concierge view instead of white and blue.
2. `generate` and `variant` call the API.
3. `pick` chooses a candidate.
4. `import` brings in an image made anywhere else.
5. `build` makes the sprite in `public/assets/<scene>/<name>/`.

`npm run asset` alone lists every command and option. `blockout` draws a room in metres at the game's scale, as the
guide its painting must follow (see [docs/ASSETS.md](docs/ASSETS.md)); `touch` changes one marked area of a picked image, `redress`
re-dresses a whole view while keeping its layout, `generate --layout` follows a rough picture's composition (the radio
repair's inside was laid out from the shop seen through its window), `reframe` shrinks a set to the characters' scale,
`parts` makes a character that walks, and `split` cuts a background into layers that move at their own speed (see
[docs/ASSETS.md](docs/ASSETS.md)). `split` judges depth with a model that runs on this machine, downloaded once
(about 100 MB) into `node_modules/.cache/lidless`; nothing of it ships with the game.

The image AI needs an OpenAI API key in `.env.local` as `OPENAI_API_KEY=...`. That file is never committed.

Git keeps the sources of the art (pictures, parts, rigs, layer maps and cut layers) and the built sprites the game
loads, but not what the tools can make again without a paid call: candidates, a rig's rendered frames, the image
model's layer fills and previews. Built sprites change with every rebuild, so rebuild when the art changes, not to
check something.

**The asset bench** shows a built sprite lit by the game's own renderer, next to its maps:
open `/bench.html` on the dev server. It lists everything built, scene by scene, opens on the newest, and reloads by
itself whenever `build` runs.

- Pick a backdrop: a plain wall with puddles, or the main street.
- On the plain wall, pick a light: street lamp, shop door, neon or studio.
- **E** switches view, **F** turns the sprite around and **W** walks it across the street.

## Layout

- `src/engine`: WebGL helpers, shaders, renderer, asset loading.
- `src/game`: the game. `game.ts` is a session: the scene she is in and the ways between them, what she does with
  things, the view switch and the Concierge's attention, conversations, saving, each frame. Around it: `camera.ts` and
  `hero.ts` (shared with the scene editor), `actions.ts` (what can be done with a thing), `input.ts` (pointer and keys),
  `scene.ts` (a scene's frame: layers, movers, people, effects), `scenefile.ts` (scene files), `world.ts` (her walk),
  `hud.ts` and `ui.ts` (the interface), `dialogue.ts`, `save.ts`. `src/main.ts` only boots it.
- `src/editor`: the scene editor. `state.ts` (what is edited), `files.ts` (opening, building, saving, undo),
  `overlay.ts` (what is drawn over the scene, and dragging it), `panels.ts` with `form.ts` (the side panel), `edit.ts`
  (adding and deleting), `main.ts` (wiring and start). `src/bench.ts` is the asset bench, `src/look-panel.ts` the look
  panel both use.
- `src/story`: dialogue in Ink, compiled at build time. `main.ink` declares the variables and includes one file per scene; a tag on a line names its speaker (`#luna`, `#fixer`, `#concierge`), and untagged lines are narration.
- `public/assets`: game assets in the format described in [docs/ASSETS.md](docs/ASSETS.md), one folder per scene
  (`home`, `backstreet`, `street`, `radio`) plus `cast` for recurring characters; `scenes/<id>/scene.json` places them,
  and `world.json` lists the scenes and where the game starts.
- `art`: recipes and the chosen source images for the pipeline, in the same folders (generated candidates are not
  committed).
- `tools/pipeline`: the asset pipeline. `cli.mjs` is its command line; the commands are in `images.mjs` (pictures with
  the image model), `build.mjs` (game sprites), `characters.mjs` (parts and rigs) and `scenes.mjs` (rooms, camera
  pull-backs, layers), with `shared.mjs`; under them `clean.mjs`, `derive.mjs` and `image.mjs` (pixels and maps),
  `parts.mjs` (cutting and posing parts), `split.mjs` and `depth.mjs` (layer maps), `style.mjs` (the prompts),
  `openai.mjs`, `recipe.mjs` and `blockout.mjs`. `tools/blender`: the rig. `tools/styleframe`: the hand-coded main
  street (sky, crowd and set), drawn in code.
- `scripts`: headless checks: `play` walks the opening route, `check:layers` checks the main street's layers as the
  camera moves (a thin pole must stay steady, and the street at both ends of the drift is saved to look at), `shot`
  takes screenshots, `perf` measures frame times. None needs the dev server.
- Tests: `npm test` runs the unit tests (Vitest), next to the code they test (`*.test.ts`, `*.test.mjs`): the camera,
  what can be done with things, scene files, the look and a scene's own, movers and blended edges, hotspots on far
  layers, layer maps. `npm run check` checks the types. A scene file with a mistake says what is wrong when it loads.
- `docs`: the plan, the asset contract, the story documents and the art review; [docs/README.md](docs/README.md) lists
  them.

The plan and the reasoning behind the stack: [docs/PLAN.md](docs/PLAN.md).
