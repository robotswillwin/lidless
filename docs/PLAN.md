# Plan

The full build plan, with the reasoning, image AI pricing and risks: https://claude.ai/artifact/5FwBfUkBwgAKMLe6X5GMMP

## Decisions

- **Genre**: narrative adventure with RPG systems. Encounters are turn-based in side view (the Darkest Dungeon model). Climbing and jumping are tapped context actions.
- **Platforms**: web first in TypeScript and Vite; iOS and Android through Capacitor; desktop and Steam through Tauri.
- **Rendering**: our own WebGL 2 deferred 2D renderer. Quality tiers for phones.
- **Content**: LDtk for levels, Ink for dialogue, characters as cut-out rigs.
- **Art**: generated with an image AI through our pipeline. GPT Image 2.5 Flare generates; Sunburst edits a raw image into its Concierge look. Art made elsewhere comes in with `asset import`. A Flux style model is an option once the look is locked.
- **Names**: the project is called Lidless. The AI is the Concierge inside the game; "Concierge" is taken as a game title.

## The two views

- **Concierge view** is what everyone sees through the visor: warm, flattering, full of neon. Most of the city's colour and allure is AR.
- **Raw view** is the illegal mod. Every real light is a pale, sterile white, and the air between the lights is a poisonous sepia. The engine does this, so assets author their lights in Concierge colours.
- **Raw view is the only way to tell who is real.** A real person can look different in each view (augmented), or the same. A generated person exists only in Concierge view, so raw view shows nothing there: no body, no shadow, no reflection. Some real people exist only in raw view, because the Concierge edits them out. Nothing in Concierge view may give any of this away.

How assets and levels express it: `exists` in a recipe (see [ASSETS.md](ASSETS.md)), and `only` on a hotspot, so a generated person cannot be clicked in raw view.

## Milestones

| Milestone | Status |
| --- | --- |
| M0 Setup: repository, tooling, renderer drawing sprites, quality tiers | Done |
| M1 Vertical slice: tap to walk, hotspots, view switch unlocked by the fixer, Ink conversations, saving | Done, on one screen; the scrolling camera comes with a wider street |
| M2 Pipeline v1: clean, derive maps, pack, preview, one image AI connected | Done. The live API is untested until there is a key in `.env.local` |
| M3 First real art through the pipeline | |
| M4 Turn-based encounters | |
| M5 Mobile builds and touch controls | |
