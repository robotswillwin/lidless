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

- Click or tap to walk. Click a thing to use it: with one use she just does it; with several they fan out in an arc
  above it, each in its fixed place (Feet go, Hands use, Eyes look, Heart talks, and in Concierge view its bell asks
  the Concierge). A second click on the same thing, or a double-click, does its main use. Right-click looks. Arrow
  keys or A/D walk too.
- **N** opens her notebook, **I** her things (her pockets in raw view), **Esc** closes. In Concierge view,
  *Ring for assistance* asks the Concierge for a hint.
- Talk to the fixer in the radio shop. Once he has opened your eye, **E** or the button switches between
  Concierge view and raw view, and many things read differently. On the dev server, E works from the start.
- Number keys pick answers in a conversation. **Q** cycles the quality tiers.
- **L** opens the look panel: pixel size and shape, colour levels and dither, lights, haze, bloom, light shafts,
  raw-view fog, how lights behind characters fill and rim them and how much glow shows over them, exposure,
  contrast, saturation, temperature, tint, vignette, grain and colour fringes, all live. Each setting is shared by
  both views, or split (its **both** button): then raw view and Concierge view have values of their own, and the
  slider edits the view on screen. Tuning is kept in the browser, until the game's look changes: then it is set
  aside, so a browser never shows the game through settings made for art that is gone. **Save** (on the dev server)
  makes it the game's look, in `public/assets/look.json`.
- The game saves as you go. Add `?new` to the address to start over, `?debug` to see the tier and frame rate.

Other commands:

- `npm run build` type-checks and builds to `dist/`.
- `npm run shot -- "t=3" "t=3&view=raw" "bench.html?asset=cast/hero"` builds and saves screenshots to `shots/` with headless Chrome. No server needed.
- `npm run play` builds and plays a scripted run (look, talk to the fixer, switch view, reload) with a screenshot per step.
- `npm run perf` builds and reports the frame rate per quality tier, up to a 4K canvas.
- `npm run asset -- rig art/cast/hero.json` rigs Lux in Blender and renders her walk (needs Blender: `brew install --cask blender`). See docs/ASSETS.md, "Characters".
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

The scenes so far: Lux's home (`home`), the backstreet, the main street and the radio repair (`radio`). Entrance 3 on the
backstreet leads home, and the radio repair's door on the main street leads into the shop, where the fixer works.

**The scene editor**, `/editor.html` on the dev server, shows a scene rendered as in the game, and Lux to judge the
light on.

- **Moving:** drag lights, hotspots, exits, spawns, areas, the walk line and the reflection line; arrows nudge the
  selection.
- **Editing:** the selected item's settings in the side panel.
- **Lights:** colour, strength, reach, height, cone, haze, shadows, flicker, whether they are behind, among or in
  front of the characters, Concierge view only, and machine lights.
- **Adding:** new scenes from a built background, and layers from any built asset.
- **Keys:** E switches view, L opens the look panel, Cmd+Z undoes, Cmd+S saves.

Save writes the scene file, and an open game tab reloads the scene at once.

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
and `parts` makes a character that walks (see [docs/ASSETS.md](docs/ASSETS.md)).

The image AI needs an OpenAI API key in `.env.local` as `OPENAI_API_KEY=...`. That file is never committed.

**The asset bench** shows a built sprite lit by the game's own renderer, next to its maps:
open `/bench.html` on the dev server. It lists everything built, scene by scene, opens on the newest, and reloads by
itself whenever `build` runs.

- Pick a backdrop: a plain wall with puddles, or the main street.
- On the plain wall, pick a light: street lamp, shop door, neon or studio.
- **E** switches view, **F** turns the sprite around and **W** walks it across the street.

## Layout

- `src/engine`: WebGL helpers, shaders, renderer, asset loading.
- `src/game`: scenes, the walking hero, hotspots, conversations, saving.
- `src/story`: dialogue in Ink, compiled at build time. `main.ink` declares the variables and includes one file per scene; a tag on a line names its speaker (`#lux`, `#fixer`, `#concierge`), and untagged lines are narration.
- `public/assets`: game assets in the format described in [docs/ASSETS.md](docs/ASSETS.md), one folder per scene
  (`home`, `backstreet`, `street`, `radio`) plus `cast` for recurring characters; `scenes/<id>/scene.json` places them,
  and `world.json` lists the scenes and where the game starts.
- `art`: recipes and the chosen source images for the pipeline, in the same folders (generated candidates are not
  committed).
- `tools/pipeline`: the asset pipeline. `tools/styleframe`: the hand-coded main street (sky, crowd and set), drawn in code.
- `scripts`: headless checks: `play` walks the opening route, `shot` takes screenshots, `perf` measures frame times.
- `docs`: the plan, the asset contract, the story documents and the art review; [docs/README.md](docs/README.md) lists
  them.

The plan and the reasoning behind the stack: [docs/PLAN.md](docs/PLAN.md).
