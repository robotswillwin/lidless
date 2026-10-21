# How the story drives the world

The story, in Ink (`src/story`), is where everything that happens is kept. The game reads it: what she knows, what she
carries, what is in a scene, what an object says and does. A scene file places things; the story decides them. This is
how to write a deep plot, side errands and many objects without code.

## The story's state

`src/story/main.ink` declares what the game reads and sets:

| Variable | What it is |
| --- | --- |
| `raw_view` | Set by the game as a conversation starts and at every choice: true while she sees raw view. |
| `has_raw` | True once the fixer has opened her eye; the view switch unlocks. |
| `conditions` | What the city is like now: a variant the scenes have (`rain`, `fog`, `outage`), `""` as they are. |
| `carried` | What is in her pockets: a list of `Things`. Her things (the left ball) show it. |
| `taken` | Everything she has ever picked up from where it was: it is gone from there for good. |

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

A short cutscene is a knot of such lines. Speaker tags (`#luna`, `#fixer`, `#concierge`) stay as they are.

## The notebook

`public/assets/notebook.json`: each errand and person has `when` (she has written it once this holds) and `done`
(crossed out once this holds); the questions page has a `when`.

## A thing painted into a background

A thing she can take that is painted into a scene's picture needs the picture without it, shown once she has taken
it: a patch. Her flat's valve and parcel are made this way (`art/home/desk-valve-gone`, `desk-parcel-gone`):

1. Back up both views of the picture, `touch` the Concierge's view with the thing gone, and redraw raw view from it
   with `touch --from concierge` over the same box.
2. Cut the box out of both touched pictures, put the pictures back as they were, and blend each patch into its picture
   along its edge (the image model shifts colours a little: the difference along the edge is carried smoothly across).
3. Build the patch as a `background` piece (a prop would have its flat background keyed out) and place it over the
   layer, at the picture's own scale: a picture 1088 texels tall is drawn at 1080, so a texel x of the picture is at
   scene x 0.32 + 0.4963 × x in her flat. `when: "taken has valve"` shows it once she has the thing; the thing's own
   light gets `when: "!(taken has valve)"`.

## Checks

`npm test` runs the story headlessly (`src/game/story.test.ts`: her pockets, the radio, the parcel, saves) and checks
every reference (`src/game/references.test.ts`): every knot a hotspot names, every thing to take, every condition's
variables, in every scene and the notebook.
