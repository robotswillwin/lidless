# The GUI: a study, and a brief for the next pass

24 October 2026. Where Lidless's interface stands, why it still reads more like a web page than a game, what to learn
from, and what to build, in order. Written for whoever does the work: a designer, another agent, or Claude again.

## How to work on it

- **See every screen.** `node scripts/ui-shots.mjs` builds the game and photographs every screen of the HUD and its
  menus on a phone held sideways (an iPhone's safe area kept clear at its sides), an Android phone, a tablet, a laptop
  and a desktop, into `shots/ui/<device>-<screen>.png`, with a contact sheet per device (`shots/ui/<device>.html`).
  `node scripts/ui-shots.mjs --no-build phone map journal` takes a few. Look at them after every change, and judge on
  the phone first.
- **Where it lives.** All of the HUD's style is in `src/style.css`, from `.hud {` down. Its hub is `src/game/hud.ts`;
  its parts are `balls.ts` (the two balls, the verbs), `tray.ts` (her things), `panels.ts` (journal, notebook, menu),
  `journal.ts`, `map.ts`, `notebook.ts`, `settings.ts`, `closeup.ts`, `marks.ts` (what a verb lights, the ways out),
  `notes.ts` (what she found), `concierge.ts` (its presence, card, messages, calls), `talk.ts` (conversations),
  `title.ts`, `terminal.ts` and `icons.ts`. The fonts are loaded in `index.html`.
- **Checks.** `npx vitest run` and `node scripts/checks.mjs` (the play checks; some measure the title screen) stay
  green.
- **What is not up for redesign**: the director's decisions and the game's premise.
  - Made for a phone held sideways first. Nothing may need a mouse hovering over it.
  - A tap looks; taking and using are chosen at the ball (decision 46). The verbs are her body: eyes look, the heart
    talks, hands use and take. The heart for talking is deliberate.
  - Two views. The HUD is hers and the same in both. The Concierge exists only in its view, made of light (cyan to
    violet), speaking in the italic serif; raw view has no Concierge at all.
  - Her journal is on her device: readable anywhere, and the Concierge can read it. Her notebook is paper and opens
    only where it cannot see her.
  - Old machines are green phosphor terminals. The eye (the privacy sign, the wait, the title, the app's icon) is the
    game's mark.
  - Accessibility: the text size setting (`--ts`), reduced motion, the keys (Esc, I, M, J, N, E, numbers), touch
    targets of 44 px at least, the screen's safe areas.

## Where it stands

The last passes (commits `31e8c83` to `833174e`) moved the HUD's controls out into the bars beside the frame on
phones and tablets, built the title screen, gave the saves pictures, put every card on one glass, set the verbs on
chips, made buttons give when pressed, and gave the panels one size. That fixed what was broken. It did not make the
interface feel designed for this game. Looking at all of it together, on the phone:

1. **It is a web app's kit.** Pill buttons, segmented tabs, rounded cards with hairline borders, a dark modal: the
   journal, the menu and the map would pass for the settings screen of any app. Nothing in them says Lidless.
2. **The sheets do not hold their room.** One objective in the journal, "Nobody yet" in People, two boxes on the map:
   each sits in a corner of a large dark sheet and reads as unfinished. Nothing was designed for a page with little on
   it, and early in the game every page has little on it.
3. **The map is a diagram, not a place.** Wire boxes with a name in the corner, a road as a pill, names in rows under
   it that collide on a phone; no picture of anywhere; a tap on a box travels at once.
4. **Type has no voice of its own.** Jost at 12 to 15 px nearly everywhere, little hierarchy, small tracked capitals
   for labels. The Concierge's italic serif is the only type with character.
5. **Nothing is an object.** Her device, her paper and the Concierge's light are ideas in the code's comments; on
   screen they are the same dark glass, the notebook apart.
6. **Motion is generic.** Things fade in and sheets appear. Nothing has a signature: a device raised into view, the
   Concierge drawing itself, paper unfolding.
7. **It is silent.** No press makes a sound. The music is the director's (decision 34); sounds for the interface have
   not been decided.

What works, and should be kept: the Concierge's presence and card (the most finished part: its light, its serif
voice, its status line); the HUD's restraint at play (two balls, a row of buttons, nothing else on the scene); the eye;
the paper notebook; the phosphor terminal; ways and notes placed at the thing itself; the title screen's composition.

## Direction: four materials, one grammar

Everything on screen is made of one of four materials, each with its own look and motion. All of them share one
grammar: the same grid, type scale, spacing, corners and states.

- **Her device**: her journal (objectives, people, evidence), the map and, if the director agrees, her saves and the
  settings. A small rugged screen she carries, not a glass sheet over the scene: matte black, a thin bezel, an
  operating system of its own. Along its top a status line (the game's time, and a lit dot when the Concierge can read
  it); its pages as tabs along its side on a wide screen and along its bottom on a phone; numbers and times set in a
  monospace, words in Jost. It slides up from the bottom of the screen as she raises it, and down again. It is always
  the same size, and every page is designed for having little on it.
- **The Concierge's light**: its presence, card, messages, calls and the names it gives things. As it is now, with
  motion of its own: it draws itself open, and its words come a few at a time.
- **Paper**: her notebook, papers seen close up, what she writes. As now, with the page's edge, a margin and a turn.
- **Her glass**: the two balls, the verbs, her things, the buttons at the top, what she found written at the thing.
  Minimal and translucent, as now.

Old machines keep their own: green phosphor.

The grammar, as tokens in `style.css` that every rule uses (none set in place):

- **Type.** Display (the title's name), title, heading, body, small, micro. Body is 15 to 16 px on a phone; nothing is
  ever under 11 px. Jost for her and the game (300 to 600), Playfair Display italic for the Concierge's voice, Caveat
  and Kalam for her hand, VT323 for old machines, and a monospace for data on her device.
- **Colour, by role.** Ink at three strengths (100, 72 and 48 per cent); her glass and its edge; the Concierge's cyan
  `#8ff0ea` to violet `#b7a8ff`; its warning pink `#ff9fcf`; the eye's red `#ff2f3f`, for the eye and nothing else;
  raw view's amber `#f0b25a`.
- **Corners.** 8 px for a chip, 14 px for a card, 20 px for a sheet, round for balls and pills.
- **Depth.** Flat, card, sheet, and over everything, each with its own shadow.
- **Motion.** 120 ms for a press, 180 ms for small things, 260 ms for a sheet. One easing in
  (`cubic-bezier(.2, .8, .3, 1)`) and one out (ease-in). With less motion, fades only.
- **Icons.** The 24-grid line set in `icons.ts` (1.6 stroke, round caps), extended as screens need. Her device may
  want icons of its own, with cut corners rather than round ones.

## References

Look at the named screen for the thing listed, to learn how it was solved, not to copy a style.

Where to look:

- [Game UI Database](https://www.gameuidatabase.com): thousands of games' screens, searchable by game and filtered
  by screen type (map, journal, inventory, dialogue, title, pause).
- [Interface In Game](https://interfaceingame.com): screenshots by element, such as
  [maps](https://interfaceingame.com/screenshots/?elements=map),
  [main menus](https://interfaceingame.com/screenshots/?elements=main-menu) and
  [overlays](https://interfaceingame.com/screenshots/?elements=overlay), and games such as
  [Cyberpunk 2077](https://interfaceingame.com/games/cyberpunk-2077/) and [Hades](https://interfaceingame.com/games/hades/).
- [Apple's Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines): safe areas,
  44 pt touch targets, games on a phone.

Games, by what to take from them:

- **Her device and its pages**
  - *Citizen Sleeper*: calm, typographic panels; how a page with one thing on it still looks composed.
  - *Simulacra* and *Sara Is Missing* (found-phone games): an interface that is a phone in the fiction, with its
    status bar, apps and notifications.
  - *Florence*: a phone's screens as part of a story, simply.
- **The map**
  - *Outer Wilds*, the ship log in rumour mode: each place a card with its picture, joined by lines; places not yet
    explored as cards with a question mark. The closest to what Lidless's map wants.
  - *Kentucky Route Zero*: the Zero, a monochrome schematic of a road. A map as a line drawing with a mood.
  - Transit maps (Beck's London Underground diagram, Vignelli's New York subway map): streets as lines, places as
    stations, legibility before geography.
  - *Citizen Sleeper*: the station as a structure of places as nodes.
- **Notes, paper and the people she meets**
  - *Return of the Obra Dinn*: the logbook as the whole interface; a page of faces whose names are filled in as she
    learns them.
  - *Heaven's Vault*: the notebook of inscriptions.
  - *Pentiment*: typography as part of the world.
- **Conversations**
  - *Disco Elysium*: the conversation as a tall column at the right, the scene kept; each inner voice with a colour
    and a name.
  - *Oxenfree*, *Night in the Woods*: lines over the speakers' heads, readable over any background.
  - *Return to Monkey Island*: things carried in a bag that opens; actions offered as the pointer passes a thing; a
    hint book that is part of the game.
- **The Concierge's light and the two views**
  - *Observer: System Redux*: vision modes switched on and off, a world seen through implants and their glitches.
    The closest thing to raw view and the Concierge's.
  - *Cyberpunk 2077*: the scanner, with labels on leader lines over things, a colour for the system and one for
    danger. Its menus are what not to do: too much at once.
  - *Deus Ex: Human Revolution*: one coherent augmented HUD, its gold and its hexagons used everywhere.
- **Title screens and menus**
  - *Hades*: illustrated menus where every press answers with motion. The bar for polish.
  - *Signalis*: menus with a material (a CRT, a radio) rather than a style.
  - *Gris*, *Sable*: titles that are the art, with almost nothing over it.

## Screen by screen

Each screen with its shot (`shots/ui/phone-<screen>.png`), what is wrong, the target, and a priority: P0 now, P1
next, P2 later.

### The map (`map`): P0

Wrong: wire boxes with the name in a corner; a road drawn as a pill; names in rows under the road that collide on a
phone; no picture of anywhere; a tap travels at once.

Target: a schematic of what she has walked, in the manner of a transit map, each place a picture card.

- Streets are lines, named once along them. The doors along a street are stops on it, the place behind each above it.
- A place she has been is a card with a picture of it as she last saw it and its name under it on one line. The game
  takes the picture when she arrives, as it takes a save's (a small copy of the canvas, kept in her save). A place she
  has only seen the door of is a dashed card with a question mark and the name she knows.
- A building is a stack of its floors, joined by its lift's shaft drawn as a double line, each floor with its number.
- Where she is: its card lit, and a pin with her on it; the map opens centred on it.
- One size for a card (about 120 by 68 px on a phone, 160 by 90 on a laptop), never blown up. Bigger than the page,
  it is dragged to pan and pinched to zoom.
- A tap on a card opens it larger: its picture, its name, who and what she knows there, and Go there, which travels.
- Names never overlap: on the cards, not under the roads. People and things are listed in their place's card.

Refs: *Outer Wilds*' rumour mode; transit diagrams; *Citizen Sleeper*.

### Her journal (`journal`, `journal-people`): P0

Wrong: one small card in the corner of a large dark sheet; "Nobody yet" alone in the middle; a web app's tabs.

Target:

- The device's shell for the journal and the map (and the saves and settings, if they belong on her device): the
  status line, the pages as tabs, one size, sliding up.
- Objectives: the current one large (what, where, by when, its place's picture), the rest as a list under it; those
  done struck through and folded away.
- People: portraits (crops of the characters' own art: the fixer, Felix, Athena), each with a name and what she knows
  of them; someone not yet met as a silhouette. *Obra Dinn*'s page of faces.
- Evidence: what she has found, as cards with their pictures (the items' art exists).
- An empty page is designed: a line drawing in the device's style and one line of text ("No one yet. The people she
  meets are kept here.").

Refs: *Citizen Sleeper*; *Return of the Obra Dinn*; the found-phone games.

### The menu: saves, settings, how to play (`menu-saves`, `menu-settings`, `menu-help`): P1

Wrong: a sheet over the scene like the journal's, so pausing does not feel like pausing; How to play is paragraphs.

Target: a pause screen of its own, as the title screen is: the scene blurred and darkened behind it, the game's mark,
its choices down the left (Resume, Save, Load, Settings, How to play, Title screen) and its pages at the right. Saves
keep their pictures. Settings are grouped, each with one line saying what it does. How to play is shown, not told: a
small drawing of each gesture (tap, hold to run, slide over the scene).

Refs: *Hades*, *Signalis*, *Citizen Sleeper*.

### The HUD at play (`hud`, `hud-raw`, `verbs`, `verb-chosen`, `things`, `thing-close`, `note`): P1

Wrong: four round buttons of equal weight at the top right for four quite different things; a thing close up is a
generic card.

Target:

- At the top right, fewer and clearer: her device (the journal and the map) and the view switch; her notebook where
  it can open, as now; the menu folded into the device, or reached by a long press. To try on a phone before deciding.
- The balls stay. The verbs stay a row; a ring round the ball (the old verb coin) is worth trying on a phone, since a
  thumb reaches round a ring more easily than along a row.
- Her things: the tray stays. A thing close up becomes an object view: larger, turned a little, described in her
  words, with what she can do with it.
- What she found, at the thing: stays.

Refs: *Return to Monkey Island*; *Norco* for a sparse HUD.

### Conversations (`talk-line`, `talk-answers`): P1

Mostly right: lines over the speakers' heads in their colours, narration at the top, her answers as a list at the
bottom, the one picked said over her head. To refine: the speaker's name over their first line; the answers' list no
wider than a line can be read; the answer under the finger lit more clearly.

### The Concierge (`concierge`, the presence in `hud`): P2

Keep. Give it motion: its card draws itself open, its words come a few at a time, and its presence breathes while it
is idle.

### The title screen (`title`, `title-settings`, `title-help`): P1

Right in composition. Next: a Continue card with the save's picture and where and when it was; the eye opening once
as the title first shows (the wait's eye handing over to it); the scene's camera drifting slowly behind; a line for
the version and credits.

### Her notebook (P2), old machines (`terminal`, P2), the waits and fades (P2)

Keep. The notebook could have its margin, the paper's edge and a page turn.

## The order of work

**P0**, about three to four hours of Claude's time:

1. The tokens in `style.css` (type, colour, corners, depth, motion), and every rule using them.
2. Her device's shell for the journal and the map: the slide up, the status line, the tabs, one size, designed empty
   pages.
3. The map as picture cards, with the picture of a place taken as she arrives and kept in her save.
4. The journal's pages: objectives, people with portraits, evidence with pictures.

**P1**: the pause screen; the title's Continue card and its eye; a thing close up as an object view; How to play
drawn; the verb ring tried on a phone; conversation refinements.

**P2**: the Concierge's motion; the paper's details; sounds for the interface, with the director; icons of the
device's own.

Done means: every screen in `shots/ui`, on the phone and on the laptop, reads as one game; no sheet changes size; no
text is under 11 px; nothing overlaps anything; nothing needs a pointer hovering; the checks are green.

## Open, for the director

- What her device is in the fiction (a phone, a band on her wrist, a pad), which decides the shell's shape.
- Whether her saves and the settings belong on her device, in the fiction, or outside it, as the game's own menu.
- People's portraits in the journal: crops of the characters' art, or drawn for the journal.
- Sounds for the interface, separately from the music (decision 34).
