# How the story drives the world

The story, in Ink (`src/story`), is where everything that happens is kept. The game reads it: what she knows, what she
carries, what is in a scene, what an object says and does. A scene file places things; the story decides them. This is
how to write a deep plot, side errands and many objects without code.

## The story's state

`src/story/main.ink` declares what the game reads and sets:

| Variable | What it is |
| --- | --- |
| `raw_view` | Set by the game as a conversation starts and at every choice: true while she sees raw view. |
| `has_raw` | True once the fixer has switched on raw view in her eyepiece; the view switch unlocks. |
| `conditions` | What the city is like now: a variant the scenes have (`rain`, `fog`, `outage`), `""` as they are. |
| `carried` | What is in her pockets: a list of `Things`. Her things (the left ball) show it. |
| `taken` | Everything she has ever picked up from where it was: it is gone from there for good. |
| `arrivals` | Set by the game: how many times she has gone from one scene to another, all told. A clock the story can count by: the station feeds her only if `arrivals - fed_at` is 6 or more. |

`LIST Things = ...` names everything she can carry; `public/assets/items.json` says how each looks and what it is called
in each view. Errands and anything else the plot needs are variables of their own (`parcel_delivered`,
`radio_heard`). Ink lists can also hold an errand's stages (`LIST ParcelErrand = (unstarted), carrying, delivered`).

## Conditions

A condition on the story's state, in a scene file or the notebook, says when something is there:

```
has_raw                          true when the variable is: true, a number other than 0, a word, a list with something in it
!has_raw, not has_raw            not
favours_owed >= 1                comparisons: == != < <= > >=, against numbers, true or false, or "words"
carried has valve                a list holds an item; carried has (valve, radio) holds them all
a && b, a and b, a || b, a or b  both, either
( ... )                          grouping
```

`src/game/conditions.ts` reads them. A condition that cannot be read is an error, and the tests check that every
condition in the game's data reads only variables the story has (`src/game/references.test.ts`).

## In a scene file

| Field | On | What it does |
| --- | --- | --- |
| `when` | a hotspot, a layer, a light | There only while the condition holds: a thing that turns up, a door that opens, a sign that comes on. |
| `story` | a hotspot | Its knot in the story. Each verb runs the knot's stitch of its name where it has one, over the hotspot's own texts: Look runs `look`, Talk `talk`, Use `use`, Take `take`, Ask `ask`. Using a thing she carries on it runs `use_<thing>`. |
| `item` | a hotspot | A thing to pick up, one of the story's `Things`: Take puts it in `carried` and `taken`, and the hotspot is gone for good. Its `take` text says it, or the game says she has it. |
| `talk` | a hotspot | A conversation: the knot that Talk runs from its start (as before). |
| `follows` | a hotspot | A mover it goes with (its asset): it is wherever the mover is (a guard on its round). Talked to or used, the mover stops, turns to her, and goes on when she is done. |
| `map` | a hotspot | `true` puts it on her map once she has seen it; `false` keeps a way out or someone to talk to off it. |
| `reply` | a hotspot | What it says back when she talks to it, with no conversation: the repair bot's "Bzzzzz, bzzzzt". |
| `kind` | a hotspot | `person`, `machine` or `thing`: what it is, for the standard replies. By default a way out if it goes somewhere, a person if it has a conversation, else a thing. |

**Every hotspot answers every verb**: Look, Talk, Use, Take, and asking the Concierge (its view only, chosen at its
greeting: rung, it says the scene's `assist`, and Ask about something has it listen; its answer is the hotspot's
`ask`). What it has nothing of its own for (no text, no stitch), the game answers with a standard reply
for its kind, from `public/assets/replies.json`, a different one each time she tries the same thing: "It doesn't
answer.", "Not yours to take."; asked inside a privacy zone, the Concierge says it cannot see in there. Using a door
goes through it. Tapped with no verb, a thing does what it has of its own (talk, go, use, take, else look).

A scene can show things by turns: `"rotate": { "station_seat": { "values": ["woman", "", "man"], "from": "has_raw" } }`
sets the story variable `station_seat` to the next value each time she arrives (from `has_raw` on; until then the story's
own value stands), and its layers and hotspots say `"when": "station_seat == \"woman\""`. Who sits at the main street's
station: the woman until Luna can see her as she is, then someone else each time she comes back, or nobody.

Simple objects keep their plain texts (`look`, `use`, `take`, each `{ concierge, raw }`): they need no story. An object
that matters gets a knot.

What a stitch shows: one plain line (narration, or hers) with nothing to answer is written at the thing, as a look is;
anything more (several lines, someone speaking, answers, a command) is a conversation, each line over the head of who
says it.

## Writing an object's knot

```ink
=== radio ===
= look
{ raw_view:
    A transistor radio with its back off. {radio_heard: It works now. Mostly.|It almost works.}
- else:
    A decorative retro speaker.
}
-> END
= use_valve
You prise out the dead valve and press the new one in. # wait: 0.4
~ carried -= valve
~ radio_heard = true
It warms. Static, and then, under it, almost, a voice. #luna
-> END
```

`= use_<thing>` is what happens when she uses that thing on it; with none, nothing comes of it ("Nothing happens.").
Using a thing she carries: her things (the left ball), **Use** on it, then her finger over what to use it on.

## Commands in a line

A tag `name: value` on a line is something the game does before the line is said; the conversation waits for it. A tag
on a line of its own before a line belongs to that line.

| Tag | What the game does |
| --- | --- |
| `walk: 640`, `walk: desk` | She walks to x, or to a hotspot's place (its `stand`), and turns to it. |
| `face: left`, `face: right` | She turns. |
| `wear: clothes`, `wear: party` | She changes, behind a fade (a projection too). |
| `go: street/from-backstreet` | She goes to a scene, arriving at a place there; the conversation goes on there. |
| `fade: 0.6` | The screen goes dark for so many seconds, and comes back. |
| `view: raw`, `view: concierge` | The view switches. |
| `wait: 1.5` | A pause, in seconds. |
| `closeup: station`, `closeup: off` | A close-up over the dimmed scene (`public/assets/closeups/station.concierge.webp` and `.raw.webp`, as the view on screen has it) until `off` or the conversation's end; lines are said at the top meanwhile. Made with `npm run asset -- closeups`. |
| `terminal: relay7` | An old machine's screen over the game (`public/assets/terminals/relay7.json`), until she switches it off; the line waits. See Old machines, below. |

A short cutscene is a knot of such lines. Speaker tags (`#luna`, `#fixer`, `#concierge`) stay as they are.

## The Concierge

In its view the Concierge is at the top left, made of light (`src/game/concierge.ts`). Its presence greets her (the
scene's `greeting`, "Good evening, Luna." by default) with what it keeps of her: her heart (from how she moves) and her
credits (`credits`). It calls her Luna; "guest" is how it speaks of anyone it does not name. Tapped, it opens into
its card:

- its words for where she is: the scene's `assist`;
- what she has to do: her journal's objectives not yet done (it reads her journal);
- its readouts: her heart, her credits, and whether she is nourished (`arrivals - fed_at` under 8);
- **Talk**: a conversation with it in the card, the knot `concierge_<scene>` where she is (a `-` in the scene's id an
  `_`), else `concierge` (`src/story/concierge.ink`). Its lines (`#concierge`) on the left in its voice, hers on the
  right, her answers under them; story commands work as in any conversation;
- **Ask about something**: it listens ("About what, Luna?") until she taps a thing, and answers with its `ask`.

In a privacy zone it cannot hear her: no Talk, no Ask. Its messages (a thing's `ask`, what it notices) come as words
under its presence. Raw view has no Concierge.

## The journal and the notebook

What she writes down is in two places, the same shape. `public/assets/journal.json` is her journal, on her device:
she reads it anywhere and the Concierge can read it too, so it holds what she does not mind it knowing (objectives,
people, evidence anyone may see; its places are the map). `public/assets/notebook.json` is her notebook, on paper:
what she keeps from it (what she saw, what she thinks, what to ask it), read only in a privacy zone, a scene that is
`private` (her home and the public restroom; approved meeting rooms to come). Each is pages, each a tab:

```json
{ "id": "errands", "title": "errands", "empty": "nothing to do. good.", "entries": [
  { "id": "parcel", "name": "parcel 4471", "done": "parcel_delivered", "lines": [
    "to the radio repair, main street. by ten.",
    { "text": "on his bench now. he didn't open it.", "when": "parcel_delivered" } ] } ] }
```

| Field | On | What it does |
| --- | --- | --- |
| `when` | a page, an entry, a line | Written once the condition holds: an entry for a person she has met, a line for what she learned since. |
| `done` | an entry | Crossed out once it holds (an errand run), and put last. |
| `empty` | a page | What it says while nothing is written on it; without it, the page waits until something is. |
| `list` | a page | Its entries as a numbered list of their names (questions to ask). |

What she has not read yet (an entry, a line added to it, a crossing out) has a dot, on the page's tab and the book's
button too; the save keeps what she has read. The tests check every condition in both, and that pages and entries have
ids of their own (the journal's `places` is the map).

## Old machines: terminals

An old computer, offline, is a file system written in data, `public/assets/terminals/<id>.json`, and a small Unix
over it (src/game/shell.ts): `ls`, `cd`, `cat`, `grep`, `find`, `head`, `tail`, `file`, `tar`, `man`, `su` and the
rest (`help` lists them), with pipes, quotes, wildcards, Tab completion and history. Its disk is mounted read-only and
there is no network, so she can read and search it but change nothing. `# terminal: <id>` in a line opens it, and
`?terminal=<id>` in the address opens it at once, for trying one out. On a phone, keys under the screen type the
common commands and the names where she is.

- `name` (on the screen's bar), `host`, `system` (what `uname -a` says), `clock` (the machine's date as it comes up),
  `boot` (lines it prints coming up), `user` (who was left logged in), `man` (manual pages of its own).
- `users`: each with `home`, and a `password` if `su` can reach it (none: it cannot); `login`, variables the story
  is told when she becomes that user.
- `files`: by absolute path; a path ending in `/` is a directory. Each can have `text`, `owner`, `mode` (as ls shows
  it, `rw-r--r--`; the group counts as others), `date`, `kind` and `size` for one that is not text (a program, an
  archive, which `cat` shows as garbage), `entries` and `damaged` for an archive, `when` (there only while a
  condition on the story holds), and `read`: variables the story is told when she reads it whole (`cat`, `more`,
  `less`; a search through it with `grep` does not count).

Relay 7 (`relay7.json`) is a placeholder: a municipal radio relay's machine from 2030, its technician's files, the
night operator's locked ones, logs, mail, a damaged archive, and root's password where a careless history left it. It
tells the story `relay7_root`, `relay7_handover` and `relay7_pattern` (main.ink). Where the machine comes from, and
where in her flat it stands, is the story's to decide; nothing in the game opens it yet but the address.

## The map

The map is the city in profile, as she walks it (`src/game/map.ts`). `world.json` lays each street along its row:
`"map": { "places": { "street": { "at": [96, 0] } } }`, in map units, a street a tenth of its width long, so where a
thing is along it is where it is on the map. A room goes by itself above the door it opens from, where she arrives in
it over that door, joined to it by a line, raised over any room already there; `at` (and `size`, 56 by 30 by default)
puts one elsewhere. `spawn` is where she arrives when she goes there from the map. Every scene of the world's is on it
(the tests check). What she has
seen of what goes on the map is kept as she plays: ways out (`go`) and people (`talk`) are on it once they have been
on screen, and any other hotspot marked `"map": true` (the bar, the corner shop). A way out she has seen leads to a
place sketched in until she has been there.

## Things she can take or move are props

A thing she can take, move or use belongs in no background: it is a sprite of its own (a prop), placed in the scene as
a layer, there while the story says so, and placeable in any other scene (the same asset, any scene's layer). Paint a
new scene's background without such things, and make each one as a prop, with the background as its reference so it
matches. A thing already painted into a picture is lifted out of it:

```
npm run asset -- lift art/home/cutaway.json --box 1354,598,40,28 --name parcel --prompt "the small cardboard parcel" \
  --scene home --when "!(taken has parcel)"
```

`lift` paints it out of the Concierge's view (`touch`) and redraws raw view from that, so the two line up; cuts it from
the pictures as they were where they changed (a difference matte: its own pixels, its light on the wall around it, its
soft edges; where it is the colour of what was behind it in one view, the other view's outline holds); builds it as a
prop that keeps the frame it was cut in; splits the picture again without it; and places it in the scene exactly where
it was, there while `--when` holds. With `--before <dir>`, the pictures are already without it, and it is cut from
the ones in that folder. Her flat's parcel and valve were lifted this way. A light the thing gives (the valve's glow)
gets the same condition.

## Saves

The story's state is the heart of a save. A save made with an older version of the story loads whole if it can; if
the story has changed under where it was saved (a knot renamed), it keeps every variable the story still has and how
often she has been where she has been, and a variable the story added starts as the story declares it. So renaming,
adding and moving knots is safe for players' saves; renaming a variable loses what it held, unless it is copied over.
The game never saves in the middle of a conversation.

## Checks

`npm test` runs the story headlessly (`src/game/story.test.ts`: her pockets, the radio, the parcel, saves) and checks
every reference (`src/game/references.test.ts`): every knot a hotspot names, every thing to take, every condition's
variables, in every scene and the notebook.
