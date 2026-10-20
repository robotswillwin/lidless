# Plan

The full build plan, with the reasoning, image AI pricing and risks: https://claude.ai/artifact/5FwBfUkBwgAKMLe6X5GMMP

The story and the art direction live in [docs/story](story) and [docs/art](art); [docs/README.md](README.md) lists every
document.

## Decisions

- **Genre**: narrative adventure with RPG systems. Encounters are turn-based in side view (the Darkest Dungeon model). Climbing and jumping are tapped context actions.
- **Platforms**: web first in TypeScript and Vite; iOS and Android through Capacitor; desktop and Steam through Tauri.
- **Rendering**: our own WebGL 2 deferred 2D renderer. Quality tiers for phones.
- **Content**: LDtk for levels, Ink for dialogue, characters as cut-out rigs.
- **Art**: generated with an image AI through our pipeline. GPT Image 2.5 Flare generates; Sunburst edits a raw image into its Concierge look. Art made elsewhere comes in with `asset import`. A Flux style model is an option once the look is locked.
- **Names**: the project is called Lidless. The AI is the Concierge inside the game; "Concierge" is taken as a game title.

## The two views

- **Concierge view** is what everyone sees: cool and sexy, sleek and full of neon. Most of the city's colour and allure is AR, including many of the neon signs on the buildings. It never rains in it: the streets are dry, with glossy, calm puddles. Its signs are in English, with some Chinese and Japanese, like an international city.
- **Raw view** is the real world: poisonous, cheap and post-Soviet. Its colours are muted and lean cold, but it is not black and white, and main lighting is a pale, sterile white (the look's "Raw view colour" sets how much colour survives). The strongest colour is in the air: a poisonous yellow-green fog, thicker with distance, in the haze around lights, the steam and the light shafts. It rains. Only machines keep their colour: a monitor, an indicator, the kiosk's eye. Almost no text survives: signs have peeled or faded, and what remains is faint Russian or an invented script. The engine does all this, so assets author their lights in Concierge colours and mark machine lights.
- **Old analog devices are relics.** Radios, valve sets and clockwork keep their retro look in Concierge view, restored as they were when new; raw view shows them steampunk-like and shabby, patched together for decades. A recipe marks this with `relics`.
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
  - the Concierge's attention, fed by actions, gaze and dialogue choices. A first version is in: looking closely at
    something that differs between the views, in raw view, costs a step; her eye in the HUD shows three steps, and its
    attention settles back while she stays in its view;
  - time windows tied to the daily routine, when a decoy can cover for the player.

## The HUD

The design: https://claude.ai/artifact/X65FknT3sqWZBgJaHgHboZ. In code: `src/game/hud.ts`, with its styles in
`src/style.css`.

- **Two skins.** In Concierge view the HUD is the Concierge's own interface: its greeting and line of the day, its
  labels on things, its messages, *Ring for assistance* and *Your things*. In raw view that interface is gone with the
  augmented eye, and what is left is Luna's own: her handwriting, her pockets, her notebook, her sense of being watched
  and the temple switch.
- **Two balls, for thumbs.** Tap to walk (further off she jogs, further still she runs, speeding up and slowing down through the gaits; a door or the street's end, she goes through). The right
  ball slides the verbs out along the bottom, her properties: Eyes look, Heart talks, Hands use and take, and the
  Concierge's bell asks it; they stay out until a ball is tapped. With a verb chosen, pressing and sliding over the
  scene lights up what it does something to, and letting go does it: nothing depends on a mouse hovering. The left
  ball slides out her things, her notebook, the view switch and the bell's *Assistance*; later, her eye's mods and
  using a thing she carries on another.
- **What she finds is written at the thing**, where the eye already is: the Concierge's card in its view (its
  annotation of the world), her pencil note in raw view. It stays for the time it takes to read (about 15 characters
  a second, 2.5 to 9 seconds) and goes when tapped or when she is given something else to do. Conversations go as in Monkey Island (src/game/talk.ts): each line over the speaker's head in their colour, one
  at a time, tap to move on; narration at the top; her answers as a list along the bottom, the chosen one said over
  her head; the balls stay, resting. Studied against LucasArts-style lines over the speaker, Sierra's text boxes, bubbles anchored to speakers
  (Oxenfree, Night in the Woods), a log (Disco Elysium) and film subtitles; to come: a log of what she has found, and
  a text size setting.
- **Data.** A hotspot's `tag` and `ask`, a scene's `greeting` and `assist`, `public/assets/items.json` for her things
  and `public/assets/notebook.json` for her notebook, whose entries appear as Ink variables come true.
- **Not built yet.** Use and Take only say what happens (a hotspot's `use` and `take`): what she takes does not go into
  her pockets yet, and giving and using a thing she carries on another wait for items in the story. The Concierge's
  offers (rest, disposal) only answer for now.

## Milestones

| Milestone | Status |
| --- | --- |
| M0 Setup: repository, tooling, renderer drawing sprites, quality tiers | Done |
| M1 Vertical slice: tap to walk, hotspots, view switch unlocked by the fixer, Ink conversations, saving | Done, on one screen; the scrolling camera comes with a wider street |
| M2 Pipeline v1: clean, derive maps, pack, preview, one image AI connected | Done. The live API is untested until there is a key in `.env.local` |
| M3 First real art through the pipeline | In progress. Luna (the hero) walks both ways from AI-drawn parts. Scenes connect through doors and street ends, a camera scrolls wide scenes, and a scene editor places lights, hotspots and exits. All four opening places are built at one scale, the street's people are generated characters, and the game starts at home. The art review's first pass has begun: the radio repair is rebuilt from a blockout at true scale, its tools within reach, and the woman at the street machine holds one pose in both views. The HUD is in, in both skins. The look is set: flat, simple shapes and dramatic light, like a modern Another World (see ASSETS.md, Painted scenes). The main street and Luna are done in it, the camera pulled back; next the backstreet, Luna's home (framed in part of the screen) and the radio repair, and lighting variants (rain, fog, a power cut, dawn) |
| M4 Turn-based encounters | |
| M5 Mobile builds and touch controls | |
