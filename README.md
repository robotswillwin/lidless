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

- Click or tap to walk; click people and things to look or talk. Arrow keys or A/D walk too.
- Talk to the fixer in the radio shop. Once he has opened your eye, **E** or the button switches between
  Concierge view and raw view, and many things read differently.
- Number keys pick answers in a conversation. **Q** cycles the quality tiers.
- The game saves as you go. Add `?new` to the address to start over, `?debug` to see the tier and frame rate.

Other commands:

- `npm run build` type-checks and builds to `dist/`.
- `npm run shot -- "t=3" "t=3&view=raw" "bench.html?asset=hero-test"` builds and saves screenshots to `shots/` with headless Chrome. No server needed.
- `npm run play` builds and plays a scripted run (look, talk to the fixer, switch view, reload) with a screenshot per step.
- `npm run perf` builds and reports the frame rate per quality tier, up to a 4K canvas.
- `node tools/styleframe/export.mjs` regenerates the test scene in `public/assets/styleframe` from the hand-coded style frame.

Address options: `new`, `view=raw` (skips the mod), `q=low|medium|high`, `t=<seconds>` to freeze time, `debug`.

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

1. `new` writes a recipe to fill in: what it is, how the Concierge dresses it up, and which views it exists in.
2. `generate` and `variant` call the API.
3. `pick` chooses a candidate.
4. `import` brings in an image made anywhere else.
5. `build` makes the sprite in `public/assets/<scene>/<name>/`.

`npm run asset` alone lists every command and option.

The image AI needs an OpenAI API key in `.env.local` as `OPENAI_API_KEY=...`. That file is never committed.

**The asset bench** shows a built sprite lit by the game's own renderer, next to its maps:
open `/bench.html` on the dev server. It reloads by itself whenever `build` runs.

- Pick a backdrop: a plain wall with puddles, or the style frame street.
- On the plain wall, pick a light: street lamp, shop door, neon or studio.
- **E** switches view, **F** turns the sprite around and **W** walks it across the street.

## Layout

- `src/engine`: WebGL helpers, shaders, renderer, asset loading.
- `src/game`: scenes, the walking hero, hotspots, conversations, saving.
- `src/story`: dialogue in Ink, compiled at build time.
- `public/assets`: game assets in the format described in [docs/ASSETS.md](docs/ASSETS.md).
- `art`: recipes and the chosen source images for the pipeline (generated candidates are not committed).
- `tools/pipeline`: the asset pipeline. `tools/styleframe`: the hand-coded style frame that produced the first test assets.
- `docs`: the plan and the asset contract.

The plan and the reasoning behind the stack: [docs/PLAN.md](docs/PLAN.md).
