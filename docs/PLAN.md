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
  - the Concierge's attention: what it notices, not what is illegal. Raw view is legal (bible v0.4) and costs nothing;
    attention is kept for anomalies (later: a long or frequent stay in a public restroom, tampering with its feeds). The
    meter (three steps under the view switch) shows once it rises, and settles back while she stays in its view;
  - time windows tied to the daily routine, when a decoy can cover for the player.

## The HUD

The design: https://claude.ai/artifact/X65FknT3sqWZBgJaHgHboZ. In code: `src/game/hud.ts`, with its styles in
`src/style.css`.

- **One HUD in both views.** It is hers, neutral glass; what changes with the view is what things are and are called,
  and the Concierge, only in its view and made of light (src/game/concierge.ts): its mark (the C of its stations,
  turning as it speaks, rippling as it listens), its greeting with her heart and credits, its messages, its labels on
  her things. Tapped, it opens into its card: its words for here, her errands (her journal's objectives), its readouts
  (heart, credits, nourishment), Talk (a conversation with it in the card, written in Ink) and Ask about something.
  Only it calls her Luna; every other machine says "guest". At the top right: the view switch with its attention,
  the map, her journal (on her device, anywhere), her notebook (paper, privacy zones only) and the menu with her
  saves.
- **Two balls, for thumbs.** Tap to walk (further off she jogs, further still she runs, speeding up and slowing down through the gaits; a door or the street's end, she goes through). The right
  ball slides the verbs out along the bottom, her properties: Eyes look, Heart talks, Hands use and take; they stay
  out until a ball is tapped, and the one chosen asks beside the ball what to do it to ("Talk to whom?"). With a verb
  chosen, tapping a thing, or pressing and sliding over the scene and letting go, does it: nothing depends on a mouse
  hovering. Asked about something, the Concierge listens ("About what, Luna?") for her to tap a thing. The left ball slides out her
  things in a tray, each painted as the view shows it, its one name under it: a tap shows it close up, with Use.
- **What she finds is written at the thing**, where the eye already is, on a card. It stays for the time it takes to read (about 15 characters
  a second, 2.5 to 9 seconds) and goes when tapped or when she is given something else to do. Conversations go as in Monkey Island (src/game/talk.ts): each line over the speaker's head in their colour, one
  at a time, tap to move on; narration at the top; her answers as a list along the bottom, the chosen one said over
  her head; the balls stay, resting. Studied against LucasArts-style lines over the speaker, Sierra's text boxes, bubbles anchored to speakers
  (Oxenfree, Night in the Woods), a log (Disco Elysium) and film subtitles; to come: a log of what she has found, and
  a text size setting.
- **What she wears.** At home she changes at her wardrobe by the door, picking from her answers: her own clothes,
  underwear, undressed, and the party dress, a projection over her clothes. She takes her coat off coming home and puts
  it on going out; she does not go out in underwear or undressed. Her shower leaves her undressed.
- **Data.** A hotspot's `tag` and `ask`, a scene's `greeting` and `assist`, `public/assets/items.json` for her things,
  `public/assets/journal.json` and `public/assets/notebook.json` for what she writes down, whose entries appear as the
  story's variables come true, and `world.json`'s `map` for where places are drawn.
- **Not built yet.** The Concierge's offers (disposal) only answer for now; public restrooms and meeting rooms.

## Art done on 22 October, with image credits again

Felix drawn as the sheet's Deep Integration and moved into the cocktail bar, which can now be entered (a cutaway:
restaurant, bar, cellar); the fixer's eyepiece on his right eye; the radio repair's inside drawn flat and its people
at true scale; the cocktail bar's front drawn again, wider, flat, no people; the radio repair's window showing its
inside; the ground cut away beside the radio repair, the restroom and the bar. About $1.10.

## Next, when the director says go: ready for a full game

Reviewed on 20 October, after the director's feedback of that day was done
(`docs/art/LIDLESS_Feedback_v0.2_2026-10-20.md`). Times are my own working time.

**What holds at the size of a full game.** The renderer costs the same per frame however big the game gets (up to 32
lights a frame). Ink is made for deep branching (Inkle wrote 80 Days and Heaven's Vault in it): what she has seen,
inventories and quest states as lists, the whole story saved as one state. Scenes are data, one file each, placed in
the scene editor: content grows by adding files, not code. A painted scene costs about 1.5 to 2 hours and $1 to $3, a
rigged character about an hour and $1: forty scenes is a question of production, not technology.

**What comes first**, before a full game's content goes in, about 10 hours in this order:

1. **Scenes in and out of memory (about 3 hours). Done 21 October:** the scene she is in and the one she came from stay
   on the GPU, the files of the scenes her ways out lead to are fetched while she is there, and the rest are let go
   (src/game/scenes.ts): going back and forth between the backstreet and the main street held 62 textures, 332 MB at
   desktop resolution, and going home let the main street go (255 MB back in the backstreet). A scene fetched ahead
   takes the fade and under a quarter of a second more; one that is not ready after a third of a second shows the
   small sign. Backgrounds' glow maps are half their size. What was planned: every scene she visits stays in GPU memory for the session: at
   desktop resolution the main street alone is 189 MB, the backstreet and her flat 66 MB each, the radio repair 33 MB,
   and Luna in her coat 112 MB (a phone takes about a quarter of that). Fine with four scenes; a phone runs out past
   twenty. And a scene's 8 to 19 MB is fetched only as she walks in, so on a phone the fade can stall for seconds.
   - Keep the scene she is in and the ones its exits lead to; free the rest.
   - Load those neighbours in the background while she is in a scene, and put them on the GPU during the fade.
   - Glow maps at half resolution: about a third less memory per scene.
2. **The story drives the world (about 4 hours). Done 21 October** (docs/STORY.md): conditions on the story's state on
   hotspots, layers and lights; an object's knot, a stitch for each verb and `use_<thing>`; her pockets and what she
   took as Ink lists, things to take, and using a thing she carries on another; command tags in lines (walk, face,
   wear, go, fade, view, wait); the notebook's errands written and crossed out by conditions. Played through in her
   flat and the radio repair: the parcel and the valve taken, the radio mended, the parcel delivered. Part of step 3
   came with it: the story runs headlessly in the tests, and every reference is checked. What was planned: today the story
   runs only conversations: Look, Use and Take show a hotspot's fixed text, taking gives her nothing (her pockets are a
   fixed list in world.json), nothing in a scene can appear, change or go as the story moves on, and there is no "use
   this on that".
   - Conditions read from the story on hotspots, people, exits and lights: there only once something has happened, or
     changed by it.
   - An object that matters gets its own knot in the story, a stitch for each verb; simple ones keep their plain texts.
   - Her inventory and her quests as Ink lists; the notebook already reads the story. Using a thing she carries on
     another goes to the story.
   - Tags on a story's lines as commands (walk there, change, go to a scene, fade, set the city's conditions), so a
     short cutscene needs no code.
3. **Checks and playthroughs (about 2 hours). Done 21 October:** the story runs headlessly in the tests, every
   reference the scenes and the notebook make is checked against it (src/game/references.test.ts), and
   `npm run check:play` plays the built game through, checking 20 things (scripts/checks.mjs). What was planned: with
   hundreds of branches, broken references are what breaks: a check
   that every knot, variable, item, scene and place to arrive at that a scene or the story names exists, in both
   views; quest playthroughs run in the tests without a browser; and the browser checks run during the work so far
   (outfits, walking, the editor) brought into the repository.
4. **Saves (about an hour, before any public release). Done 21 October:** a save says its version and an older one is
   brought up to date as it loads; one the story has changed under keeps every variable the story still has and where
   she has been; three slots beside the autosave, from the left ball; never saved in the middle of a conversation.
   What was planned: versioned, so a save survives changes to the story; a few
   slots; saved only where it is safe, never in the middle of a conversation.

Along the way, game.ts (scenes, input, outfits, conversations, the HUD and saving in one file) is split into the
scenes' loading, the story's hold on the world, and what the verbs do. Done in part, 21 October: scenes.ts (in and out
of memory), dialogue.ts and conditions.ts (the story and what the world reads of it), direct.ts (a line's commands)
and wardrobe.ts (what she wears) each stand alone and are tested on their own; the input and the verbs are still in
game.ts, about 800 lines, which is the next to go when it grows.

**Not built yet for a full game**: sound (none so far: the director is making the music, the same composition in a
digital and an analogue arrangement to blend between the views; no effects yet), and translations: English only for
now, decided 21 October. Built 21 October: the title screen with its menu and settings (also in the game's menu at the
top right), and old machines' terminals (`# terminal: <id>`, a small read-only Unix over a file system in data; see
STORY.md), with Relay 7 as a placeholder until the story has its machine.

**Loading between screens.** No logo between scenes: with the neighbours loaded beforehand, the quarter-second fade is
the whole way from one scene to the next. If a scene is not ready when the fade ends (a slow network, a jump across the
map), the screen stays dark, and after about 0.3 seconds something small from the world shows: the Concierge's ring
turning in its view, her eyepiece's iris in raw view. A quick load never shows it. The logo is for the first load: a
title screen while the first scene and her outfit load. The browser keeps the game's files, so a returning player
downloads nothing twice.

**Later, if memory still runs short**: textures compressed for the GPU (KTX2, ASTC on phones), about four times less
memory and download. Half a day, and the flat style has to survive the compression.

## Milestones

| Milestone | Status |
| --- | --- |
| M0 Setup: repository, tooling, renderer drawing sprites, quality tiers | Done |
| M1 Vertical slice: tap to walk, hotspots, view switch unlocked by the fixer, Ink conversations, saving | Done, on one screen; the scrolling camera comes with a wider street |
| M2 Pipeline v1: clean, derive maps, pack, preview, one image AI connected | Done. The live API is untested until there is a key in `.env.local` |
| M3 First real art through the pipeline | In progress. Luna (the hero) walks both ways from AI-drawn parts. Scenes connect through doors and street ends, a camera scrolls wide scenes, and a scene editor places lights, hotspots and exits. All four opening places are built at one scale, the street's people are generated characters, and the game starts at home. The art review's first pass has begun: the radio repair is rebuilt from a blockout at true scale, its tools within reach, and the woman at the street machine holds one pose in both views. The HUD is in, in both skins. The look is set: flat, simple shapes and dramatic light, like a modern Another World (see ASSETS.md, Painted scenes). All four opening places, Luna and the fixer are done in it, the camera pulled back: the main street, the backstreet, and Luna's home and the radio repair as cutaways of their buildings. The main street is two and a half screens wide, the camera scrolling and its far city and viaduct sliding behind it (ASSETS.md, Wide scenes). Every scene has variants for heavy rain, dense fog and a power cut (see README, Conditions), chosen by the story's `conditions`; next dawn and the Concierge's hologram flooding the street, which need painted layers of their own |
| M4 Turn-based encounters | Dropped: the v0.4 bible makes the game a detective adventure, with no combat |
| M5 Mobile builds and touch controls | |
