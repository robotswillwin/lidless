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

- **Concierge view** is what everyone sees: cool and sexy, sleek and full of neon. Most of the city's colour and allure is AR, including many of the neon signs on the buildings. It never rains in it: the streets are dry, with glossy, calm puddles. Its signs are in English, with some Chinese and Japanese, like an international city.
- **Raw view** is the real world: poisonous, cheap and post-Soviet. Every thing in it is cold, and main lighting is a pale, sterile white. The only warm colour is in the air: a poisonous yellow-green fog, thicker with distance, in the haze around lights, the steam and the light shafts. It rains. Only machines keep their colour: a monitor, an indicator, the kiosk's eye. Almost no text survives: signs have peeled or faded, and what remains is faint Russian or an invented script. The engine does all this, so assets author their lights in Concierge colours and mark machine lights.
- **Everything in Concierge view looks real.** The only way to tell what is real is the biohack. A real person can look the same in both views, or different (augmented). A generated person exists only in Concierge view, so raw view shows nothing there: no body, no shadow, no reflection. Some real people exist only in raw view, because the Concierge edits them out.

How assets and levels express it: `exists` in a recipe (see [ASSETS.md](ASSETS.md)), and `only` on a hotspot, so a generated person cannot be clicked in raw view.

## The biohack

- Everyone wears a visor over one eye, and that eye has no eyelid, so it can never look away from the Concierge's frames.
- The other, healthy eye is not for seeing. Its signal goes through the visor's processor, which feeds it to the Concierge as raw data. A built-in safeguard makes sure no one ever sees the real world directly.
- Without that feed, the Concierge estimates each person's frames from other people's live data and its stored data.
- The fixer's mod cannot be digital, because the Concierge would notice. It is a biohack: a device that switches off the visual nerve of the augmented eye and, at the same time, routes the healthy eye past the processor. Raw view is that eye's own signal.

## Being watched, and going rogue

- **Early in the game** the player has to think about what they do, what they look at and what they say, because the Concierge may detect malicious plans.
- **Later biohacks** manipulate the local side of the devices. One has a local AI device simulate the player staying put, during sleep or nutrition. Those windows are when the player can go rogue.
- **Systems this needs:**
  - the Concierge's attention, fed by actions, gaze and dialogue choices;
  - time windows tied to the daily routine, when a decoy can cover for the player.

## Milestones

| Milestone | Status |
| --- | --- |
| M0 Setup: repository, tooling, renderer drawing sprites, quality tiers | Done |
| M1 Vertical slice: tap to walk, hotspots, view switch unlocked by the fixer, Ink conversations, saving | Done, on one screen; the scrolling camera comes with a wider street |
| M2 Pipeline v1: clean, derive maps, pack, preview, one image AI connected | Done. The live API is untested until there is a key in `.env.local` |
| M3 First real art through the pipeline | In progress. The hero walks: the image model draws her in each frame to a posed mannequin. Standing characters get idle loops from touch-ups. Next: the radio-shop street generated, wider, with a scrolling camera |
| M4 Turn-based encounters | |
| M5 Mobile builds and touch controls | |
