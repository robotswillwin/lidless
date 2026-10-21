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
  steps walked. Tapping a door or the end of the street walks her there and through. Outdoors, holding a finger down far
  from her runs her after it, on along the street as the camera follows her, until it comes up; brought in near her,
  it has her walk to it, and held past the end of the street it takes her on through. Arrow keys or A/D walk too, with
  Shift she runs.
- **Between scenes** the screen fades to black for a quarter of a second. The scenes her ways out lead to are fetched
  while she is near them, so that is all it takes; if one is still coming after a third of a second, a small ring
  turns. The game opens with its name over the same fade.
- **The HUD is the same in both views**: it is hers, not the Concierge's. What changes with the view is what things are
  and are called, and the Concierge's own voice, which only its view has: its greeting at the top left with her credits
  (digital, her allowance; tap it for its assistance), its messages, its offers.
- **The ball at the bottom right** slides out what she can do along the bottom: Look, Talk, Use, Take, and in
  Concierge view Ask (its bell). They stay out until the ball is tapped again, or the other one. Choose one, then press
  and slide over the scene: what that verb does something to lights up under your finger, and letting go does it. What
  she finds is written at the thing for as long as it takes to read; tapping it, or giving her something else to do,
  clears it. Right-click puts the verb down, or looks; **Esc** puts it down.
- **The ball at the bottom left** slides out her things along the bottom (**I**). Tapping one takes it out: it sits on
  the right ball, and sliding over the scene uses it on what lights up (the radio needs a valve; the fixer is waiting
  for a parcel). The ball, right-click or **Esc** puts it back. Pressing and holding one (or right-clicking it) shows it
  close up, with what is known about it; in the Concierge's view, where it can see her, a pink dot marks what it did
  not make, and close up it offers to dispose of it. A thing that exists only in its eye (a projection) is its own
  graphic there, and in raw view an empty place in her pocket. **Take** puts what can be picked up in her pockets: the
  parcel and the valve on her desk.
- **At the top right**: the view switch once she has it (its attention shows under it once it notices something; raw
  view itself is legal and costs nothing); the **map** (**M**); her **journal** (**J**); her **notebook** (**N**); and
  the menu with her saves. A dot on the journal or the notebook means something new is written in it.
- **Her journal** is on her device: she reads it anywhere, and the Concierge can read it too. Its pages are tabs:
  objectives, people, places (the map) and evidence anyone may see.
- **The map** (her journal's places) shows the places she has been, with the ways out and people she has seen in them
  (and places marked for it, such as the bar); a door she has seen leads to a place sketched in with a question mark
  until she has been through it. A pin shows where she is. Tapping a place she has been takes her there, behind a fade;
  a door or a person to them; a place sketched in to its door.
- **Her notebook** is paper, what she keeps from the Concierge: what she saw, what she thinks, what to ask it. It opens
  only in a privacy zone, where the law it keeps forbids it to watch: her home (public restrooms and approved meeting
  rooms to come). Anywhere else it stays shut. What she has not read yet has a red dot.
- **The city's helper robots** are small and few, more of them later in the game: now and then a drone crosses between
  the towers; a civic guardian stands by the nutrition station on the main street, a hologram sign for directions
  coming and going beside it in the Concierge's view (look at it, or ask it there); and a repair bot welds at the
  backstreet's wall panel. White and lit in the Concierge's view, rusty in raw view.
- **Her wrist devices**, one on each wrist, go with her eyepiece: sleek white bands with a cyan light in the Concierge's
  view, brass on leather with an amber lens in raw view.
- **The nutrition station** on the main street: a column with two seats built into it, a cuff for the right wrist on
  each armrest. Nobody eats; the station feeds and treats. Real food and drink are rare and dear, but the bars are open,
  and so is Store 24, all night: drinks, tobacco, umbrellas, care for her devices, and new looks in its window.
- **Saves**, from the menu: the game saves as she goes (never in the middle of a conversation), and three slots she
  saves into and goes back to. A save made with an older version of the story keeps what she knew and carried.
  `?new` starts a new game.
- Talk to the fixer in the radio shop. Once he has switched on your raw view, **E** or the view switch at the top right switches
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
- `npm run check:play` builds and plays the game through, checking what should happen: her outfits and projections,
  the story (things taken and used, the notebook, the parcel delivered), saves, running, scenes in and out of memory.
  `npm run check:play -- --no-build story saves` runs only those on the last build. No server needed.
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

**What Luna wears.** `world.json`'s `hero.outfits` lists her outfits, each a sprite of its own (`src/game/outfits.ts`):
her coat, and the clothes under it (her outdoor clothes: a black top and cargo trousers), home clothes (an old
T-shirt and shorts; to the Concierge, blush silk), a cardigan, a bathrobe, underwear and a party dress. A scene with
`"wardrobe": true` is her home: she takes her coat off as she comes in and stays in the clothes under it, and a hotspot
with `"wardrobe": true` (the coat hook by her door) lets her pick what she wears there, with Use, from a list like her
answers in a conversation. As she leaves she puts her coat on (an outfit's `out` names what she changes into), goes out
as she is in the party dress (`out: true`), and does not go out in her bathrobe or her underwear at all: she says its
`stay` line instead. She runs only in what she goes out in. Coming home, an outfit's `home` names what she changes
into. A hotspot's `wear` changes her into an outfit as she uses it, a while passing behind a fade: her shower leaves
her in her bathrobe. What she wears is saved, and only her coat and what she wears are kept loaded.

**Conditions: rain, fog, a power cut.** A scene's `variants` are the scene in other conditions, each with a `name` and
its own `look` settings over the scene's: every scene has `rain` (Heavy rain), `fog` (Dense fog) and `outage` (Power
cut). The story's `conditions` variable says which the city is in ("" as it is), read as she enters a scene and after
each conversation; `?variant=rain` shows every scene in one whatever the story says. They are made from look settings:
`rain` (per view; over 1 a downpour, and the Concierge's view has none unless a variant gives it some), `fog` (each
view's own air: violet to the Concierge, raw view's smog) and `power` (0: the city's lights are out, the light painted
into the art too, but for lights with `"own": 1`, power of their own, which keep what they light lit: the fixer's
off-grid shop, the Concierge's billboard, store and screens). In the editor, the menu beside Both, Raw and AR shows a
variant or makes a new one, and while one is shown the look panel's **This scene** edits its settings and saves them
into the variant; the light panel has **Power of its own**.

The scenes so far: Luna's home (`home`), the backstreet, the main street (two and a half screens wide: the camera
scrolls and its layers slide at their own speeds) and the radio repair (`radio`). Entrance 3 on the
backstreet leads home, and the radio repair's door on the main street leads into the shop, where the fixer works.

**The scene editor**, `/editor.html` on the dev server, shows a scene rendered as in the game, and Luna to judge the
light on.

- **All · Layout · Interaction · Lighting · Effects** (in the toolbar, or keys 1 to 5): what you work on. Each shows
  only its own things over the scene, its own add buttons and its own parts of the scene's panel, so nothing else can be
  picked up by mistake: **Layout** the walk line, the reflection line and the ground, inside and outside areas, layers,
  the camera and the people's size; **Interaction** hotspots, exits and places to arrive at, and the Concierge's lines
  here; **Lighting** lights and the scene's light; **Effects** steam, smoke, light shafts, beacons, drips and movers.
  Problems always lists everything. The editor remembers which you had.
- **Sliders:** an amount (a light's strength and haze, a shaft's strength, how much light is painted into the art,
  puddles, when a beacon blinks) is 0 to 1, on a curve where the low end needs fine control; a distance (a light's
  height and reach, steam, the ground's slabs) is in pixels; a factor that is 1 as standard (parallax, the people's
  size, ambient light) has a tick there. The box beside each slider takes an exact value. Places and sizes of what is
  dragged over the scene (x, y, widths, the walk line) stay as numbers.
- **Undo** (Cmd+Z) steps back one change and **Redo** (Shift+Cmd+Z) forward again; undoing every change since the last
  save leaves the scene as saved, not changed. **Revert** goes back to the scene as last saved, itself a step Cmd+Z
  undoes.
- **Copy and paste** (Cmd+C, Cmd+V, or **Paste** in the toolbar): anything selected, within a scene or into another;
  the clipboard outlasts a change of scene or a reload and goes between tabs. In the scene it came from, the copy lands
  20 px to the right at the same height; in another scene, where it was; off the screen, in the middle of it. A hotspot
  or a place to arrive at gets a name of its own if the scene has one by that name, a mover is drawn after a layer the
  scene has, pasted drips take the place of any there, and in Raw or AR mode what is only in the other view becomes
  this view's own. **Duplicate** (Cmd+D, or the button beside Delete) copies and pastes in one go, leaving the
  clipboard as it was.
- **Exits both ways:** an exit's panel says whether it arrives at a place in the scene it leads to, and whether that
  scene has a way back arriving by it here, with a button for what is missing. What is missing here is made at once.
  What is missing there is made by saving this scene and opening that one with it made, unsaved, to place and save:
  the way back at the end of the walk line she comes in by (the other end from an end walked out by; for a door, the
  same side as the door), and each place to arrive at a little in from where she comes in, facing in. A place already
  by the spot is used instead of making another. A problem about another scene's exit arriving at a place this scene
  lacks selects this scene's exit to it, whose panel makes the place.
- **Both · Raw · AR** (in the toolbar): which views your edits go to. In **Both**, what you change becomes the same in
  both views, and E shows the other view. In **Raw** or **AR** that view is on screen and what you change is its own:
  a light stronger or another colour there, a hotspot elsewhere there, a layer or an effect placed elsewhere; E switches
  between the two. What you add in Raw or AR is only in that view. A field set its own way in a view carries a RAW or
  AR mark; **Same in both views** puts the thing back as it is in both. Whether something is in both views or only in
  one is its **Shown in**, for lights, hotspots, layers, steam, light shafts, beacons and movers. What is only in the
  other view is drawn faintly over the scene. The scene's ambient light, exposure and painted light go by the same rule.
- **The scene's panel** (nothing selected) folds into sections, each left open or folded as you last had it:
  - **Problems**: what is wrong with the scene or will go wrong in play, each a click from what it is about. Its
    layers; the walk line; hotspots nobody can do anything with, or still with the placeholder texts they were made
    with; conversations the story does not have; exits to places that are not there, and other scenes' exits arriving
    at places this one lacks; hotspots under the phone's corner buttons or hidden under another; suggested lights not
    yet kept; more lights on one screen than a phone draws (18).
  - **Outline**: everything in the scene by kind (layers, lights, hotspots, exits, places to arrive at, areas,
    effects), a row to select each, lit on the scene while the pointer is over it; an eye on each kind hides it on
    the scene to see the rest. What is in one view only has a part of its own in each kind: in both views, AR only,
    raw only. The light menu is in the same parts.
  - **Scene settings**, **Ground** and **Luna**.
- **Moving:** drag lights, hotspots, exits, spawns, areas, the walk line and the reflection line; arrows nudge the
  selection.
- **Editing:** the selected item's settings in the side panel.
- **Lights:** colour, strength, reach, height, cone, haze, shadows, flicker, whether they are behind, among or in
  front of the characters, Concierge view only, and machine lights. **+ Light** places one of its own or one of a kind
  (a preset, shared by every scene: see [docs/ASSETS.md](docs/ASSETS.md#kinds-of-light-presets)).
- **Suggest lights from the art** (the scene's settings): lights where the art glows, in its colour and in the views it
  glows in, drawn with dashed rings to keep, move or discard.
- **Lights only** (G): every surface a flat grey, so all that shows is what the lights do.
- **Ground** (the scene's settings): the floor the engine draws below the reflection line, its slabs, kerb and
  puddles; how wet, shiny and worn it is in each view is in the look panel (see
  [docs/ASSETS.md](docs/ASSETS.md#painted-scenes)).
- **Luna:** drag her, turn her, have the camera move with her, or have her follow the pointer: she walks, jogs or
  runs to it along the walk line as she would that far in the game, to see the light fall on her as she moves.
- **Adding:** new scenes from a built background, and layers from any built asset.
- **Effects** (**+ Effect**): steam and smoke, light shafts, beacons, drips and movers, each drawn over the scene to
  drag (a mover's band and its two ends), with its settings in the side panel; the scene's settings list them all.
  Things on a far layer (a mover, a hotspot or light with a parallax) are drawn where they are with the camera moved.
- **Layers:** each with its parallax, and whether it is drawn in front of the people. A scene no wider than the screen
  can have the camera follow Luna a little (its drift, in the scene's settings); **Move the camera with her** previews
  it with Luna where she stands in the editor.
- **Keys:** E shows the other view (in Raw or AR, switches between them), L opens the look panel, G shows lights only,
  Cmd+C and Cmd+V copy and paste, Cmd+D duplicates, Cmd+Z undoes, Shift+Cmd+Z redoes, Cmd+S saves.

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
- `src/story`: the story in Ink, compiled at build time. `main.ink` declares the variables and includes one file per scene; a tag on a line names its speaker (`#luna`, `#fixer`, `#concierge`), and untagged lines are narration. The story drives the world: what is in a scene, what an object does, what she carries (docs/STORY.md).
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
