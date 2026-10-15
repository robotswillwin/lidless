# Plan

The full build plan, with the reasoning, image AI pricing and risks: https://claude.ai/artifact/5FwBfUkBwgAKMLe6X5GMMP

## Decisions

- **Genre**: narrative adventure with RPG systems. Encounters are turn-based in side view (the Darkest Dungeon model). Climbing and jumping are tapped context actions.
- **Platforms**: web first in TypeScript and Vite; iOS and Android through Capacitor; desktop and Steam through Tauri.
- **Rendering**: our own WebGL 2 deferred 2D renderer. Quality tiers for phones.
- **Content**: LDtk for levels, Ink for dialogue, characters as cut-out rigs.
- **Art**: generated with an image AI through our pipeline. Default GPT Image 2.5 for sprites, Nano Banana 2.1 for raw and Concierge pairs, a Flux style model once the look is locked.
- **Names**: the project is called Lidless. The AI is the Concierge inside the game; "Concierge" is taken as a game title.

## Milestones

| Milestone | Status |
| --- | --- |
| M0 Setup: repository, tooling, renderer drawing sprites, quality tiers | Done |
| M1 Vertical slice: tap to walk, camera, hotspots, view switch, one Ink conversation, saving | Next |
| M2 Pipeline v1: clean, derive maps, pack, preview, one image AI connected | |
| M3 First real art through the pipeline | |
| M4 Turn-based encounters | |
| M5 Mobile builds and touch controls | |
