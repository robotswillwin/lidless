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
- `npm run shot -- "t=3" "t=3&view=raw"` builds and saves screenshots to `shots/` with headless Chrome. No server needed.
- `npm run play` builds and plays a scripted run (look, talk to the fixer, switch view, reload) with a screenshot per step.
- `npm run perf` builds and reports the frame rate per quality tier, up to a 4K canvas.
- `node tools/styleframe/export.mjs` regenerates the test scene in `public/assets/styleframe` from the hand-coded style frame.

Address options: `new`, `view=raw` (skips the mod), `q=low|medium|high`, `t=<seconds>` to freeze time, `debug`.

## Layout

- `src/engine`: WebGL helpers, shaders, renderer, asset loading.
- `src/game`: scenes, the walking hero, hotspots, conversations, saving.
- `src/story`: dialogue in Ink, compiled at build time.
- `public/assets`: game assets in the format described in [docs/ASSETS.md](docs/ASSETS.md).
- `tools/styleframe`: the hand-coded style frame that produced the first test assets.
- `docs`: the plan and the asset contract.

The plan and the reasoning behind the stack: [docs/PLAN.md](docs/PLAN.md).
