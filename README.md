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

Then open the address Vite prints. Press **E** or the button to switch between Concierge view and raw view,
and **Q** to cycle the quality tiers. Add `?debug` to the address to see the tier and frame rate.

Other commands:

- `npm run build` type-checks and builds to `dist/`.
- `npm run shot -- "t=3" "t=3&view=raw"` builds and saves screenshots to `shots/` with headless Chrome. No server needed.
- `node tools/styleframe/export.mjs` regenerates the test scene in `public/assets/styleframe` from the hand-coded style frame.

Address options: `view=raw`, `q=low|medium|high`, `t=<seconds>` to freeze time, `debug`.

## Layout

- `src/engine`: WebGL helpers, shaders, renderer, asset loading.
- `src/game`: scenes and game state.
- `public/assets`: game assets in the format described in [docs/ASSETS.md](docs/ASSETS.md).
- `tools/styleframe`: the hand-coded style frame that produced the first test assets.
- `docs`: the plan and the asset contract.

The plan and the reasoning behind the stack: [docs/PLAN.md](docs/PLAN.md).
