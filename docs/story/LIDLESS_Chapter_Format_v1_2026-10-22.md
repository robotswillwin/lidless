# LIDLESS — Chapter format v1
**22 October 2026 · how a chapter is written so the game can be built from it as written, without guessing: for the
director and the scripting agents**

A chapter is a folder of Markdown files. The prose in them is for people; the game reads the **YAML** blocks (places,
people, things, the story's state, the journal and notebook) and the **Ink** blocks (the script) under fixed headings.
A checker reads a chapter the way the game will, and says what is wrong before anything is built.

This replaces the instructions for the writing assistant in the first writing brief (17 October), which the game has
outgrown. The world is the bible's (`LIDLESS_Game_Bible_v0.4_2026-10-21.md`): where this format and the bible meet,
the bible decides what is true and this format decides how it is written down.

- **The example:** `docs/chapters/00-the-errand/`, the game's opening written in this format. Copy its shape.
- **The catalog:** `docs/chapters/CATALOG.md`, everything the game has now (places and their spots, people, things,
  variables, knots, outfits, close-ups, machines, journal and notebook pages), by id. Generated from the game; give it
  to the agent with each new chapter.
- **The checker:** `npm run chapter -- docs/chapters/<NN>-<name>`.

## How a chapter gets into the game

1. **The director gives the agent a brief**: what the chapter is for, what must happen in it, where, and anything
   decided for it. The format says how to write a chapter; the brief says what it is about.
2. **The scripting agent writes the overview first**, from the brief, the bible and the director's decisions since it
   (`LIDLESS_Director_Decisions_2026-10-22.md`), this format, the catalog and the chapters before it. The director
   reads it (its beats, people, things and puzzles show whether the chapter is right before any dialogue is written)
   and says go, or what to change.
3. **Then the agent writes each place's file**, with its script.
4. **The director reads it**, answers its questions, and saves it as `docs/chapters/<NN>-<name>/`.
5. **The checker checks it.** Errors go back to the agent to fix; warnings are weighed.
6. **I build it.**
   - The places, people, things and close-ups are drawn from their prompts, in both views, each measured against
     Luna before anyone sees it.
   - The spots are placed in the scene editor.
   - The data and the script go into the game, and the chapter is played through and checked.

## Instructions for the scripting agent

Paste this into the agent's project instructions. Its knowledge files: the bible, the director's decisions since it,
this format, the catalog, the worked example, and the chapters written so far.

```
You are the scripting agent for Lidless, a cyberpunk point-and-click adventure. The game bible is canon, and the
director's decisions (LIDLESS_Director_Decisions) hold over it where they differ: never change what either decides
without asking the director; say when you invent or change anything else.

Write each chapter from the director's brief, in the chapter format (LIDLESS_Chapter_Format_v1), exactly:
- A folder of Markdown files: overview.md, with About, Beats, People, Things, Story state, Puzzles, Journal, Notebook,
  Close-ups, Machines and Questions; and one file per place, with its Places entry and its Script. A person met in
  several places may have a file of their own.
- Deliver overview.md first, and wait for the director's go before writing the places' files.
- Data in ```yaml blocks and the story in ```ink blocks, under the format's ## headings. Prose anywhere else is for
  people and is not read.
- Use the catalog's ids for anything the game has. Give everything new an id, text for both views, and its real size.
- Everything drawn (places, people, things, close-ups) gets a prompt for the Concierge's view and one for raw view.
- Sizes in metres or centimetres. No positions or coordinates: say where things are in words.
- Lines under 25 words, choices under 8, British spelling. Adult themes yes; no explicit sex, no nudity.
- End each chapter with your questions for the director under ## Questions.

Deliver the files as downloadable .md files. If you cannot, put each file in a block fenced with four backticks
(````), its file name on the line before it.

When the director pastes errors from the checker, fix exactly those, and send back only the files that changed.
```

## The files

- **A chapter is a folder**, `docs/chapters/<NN>-<name>/`: `01-the-voice-at-three`. Its files:
  - **`overview.md`**: About, Beats, People, Things, Story state, Puzzles, Journal, Notebook, Close-ups, Machines and
    Questions.
  - **One file per place** the chapter uses, named after it (`relay-lobby.md`): each new place, and each place of the
    game's where something new happens. It holds the place's entry under Places and its knots under Script.
  - **A person met in several places** can have a file of their own (`mara.md`), with their People entry and their
    knot.
  - The vertical slice comes to about 5 to 7 files; a full chapter of 10 to 12 places to about 12 to 15.
- **In what order:** `overview.md` first, for the director to approve; then the places' files, one per reply if need
  be.
- **Only these headings are read**, at the level `##`, each any number of times, in any file: About, Beats, Places,
  People, Things, Story state, Puzzles, Journal, Notebook, Close-ups, Machines, Script, Questions, Notes. A heading the
  format does not have is a warning.
- **Under a heading, only fenced blocks are read**: ```` ```yaml ```` for data, ```` ```ink ```` for the Script. A list
  under the same heading in several blocks or files is one list. Prose, tables and bullet lists are for people: use
  them freely (Beats, Questions and Notes are prose only).
- **New or changed.** An entry the game does not have is new: it needs every required field. An entry the catalog
  lists is the game's: mark it `new: false`, and what is written changes it or describes it (nothing more is required).

### Ids and names

| What | Its id | Example |
| --- | --- | --- |
| Places, spots, arrivals, close-ups, machines, journal and notebook entries | lowercase letters, digits and `-` | `relay-lobby`, `back-door` |
| People, things, variables | lowercase letters, digits and `_`: they are names in the story | `mara`, `old_laptop`, `relay_found` |
| Lists | CapitalCase | `RelayErrand` |
| Knots | lowercase and `_`, unique in the whole game | `relay_terminal`, `mara` |

A person's id is also their speaker tag (`#mara`). A thing's id is its name in the story's `Things` list.

**Text for both views.** Wherever text or a picture can differ between the views, give one text for both, or
`{ concierge: ..., raw: ... }`. The Concierge's text is what it shows and says; raw view's is what is there, and, for
names in her things and the notebook, Luna's own words.

## About

```yaml
chapter: 1                       # its number
title: The voice at three
length: 40                       # minutes of play, a target
summary: >                       # what happens, in a few sentences
  ...
```

## Beats

Prose: a numbered list of what happens, in order, each beat naming its places, spots, people, things and variables in
backticks (`street/kiosk`, `mara`, `relay_found`). It is how the director reads the chapter, and how I play it
through to check it.

## Places

A place is a scene: a room (interior) or a stretch of street (exterior), drawn in both views.

```yaml
- id: relay-lobby
  name: { concierge: Utility access, raw: Relay 7 }   # on the map and the screen
  kind: interior                   # interior or exterior
  width: 1                         # screens wide: 1 a room, up to 3 for a street, which scrolls
  size: 7 m wide, 3.2 m high       # its real size, for scale: required
  private: false                   # a privacy zone: the Concierge cannot see or hear inside; her notebook opens
  greeting: Good evening, guest.   # the Concierge's welcome here, in its view
  assist: ...                      # what it says when she rings for help here (optional)
  look:                            # the picture, a prompt for each view: required
    concierge: >
      ...
    raw: >
      ...
  light: ...                       # what lights it, in each view (optional)
  arrivals:                        # where she can arrive: at least one
    - id: door
      where: just inside the steel door
  ways:                            # doors and the ends of a street
    - id: door
      name: Steel door
      where: on the right
      to: street                   # a place, the game's or this chapter's
      arrive: from-relay           # one of that place's arrivals (add it there if it is new)
  spots: [...]                     # what she can look at, use, take, talk to: below
```

A place the game has (`new: false`) can take new spots, ways and arrivals, and changes to its own; leave out what
stays.

### Spots

A spot is anything in a place she can point at.

```yaml
- id: terminal
  name: { concierge: Workstation, raw: Old terminal }
  where: on the desk, under the window   # where it is, in words: required for a new spot
  size: 45 cm tall                 # its real size: for anything drawn as a prop
  look: { concierge: ..., raw: ... }     # what Look says: one or two sentences each
  use: ...                         # what Use says (plain text, optional)
  take: ...                        # what Take says (plain text, optional)
  tag: { concierge: "Guest · repairs", raw: the radio man }   # under its name: its label, her note
  ask: ...                         # what the Concierge answers when she asks about it (its view)
  story: relay_terminal            # its knot in the Script: its stitches override the plain texts
  talk: mara                       # a conversation from a knot's start (Talk), for people
  item: old_laptop                 # a thing she can take: Take puts it in her pockets, for good
  prop: true                       # drawn as a picture of its own (she takes it, or it changes), not painted in
  only: raw                        # there in one view only: raw (edited out by the Concierge) or concierge (made up)
  when: relay_found                # there only while this holds
  map: true                        # on her map once she has seen it (ways and people are anyway)
  wear: robe                       # using it, she changes into this outfit (the catalog's outfits)
```

Every new spot needs a `name`, a `where`, and something to see or do: a `look`, a `story`, a way out, or an `item`.

## People

```yaml
- id: mara                         # also the speaker tag: #mara
  name: { concierge: Mrs Lind, raw: Mara Lind }
  who: >                           # who they are, in a sentence or two
    ...
  age: 91
  height: 1.58 m                   # real height: required. Luna is 1.7 m
  voice: slow, exact, dry          # how they talk
  pose: sitting on the bench, both hands on her stick   # how they are drawn
  moves: still                     # still, walks (comes and goes), or patrols (a beat, like the guardian)
  look:                            # a prompt for each view: required
    concierge: >
      ...
    raw: >
      ...
  where:                           # where they are, and when
    - place: restroom
      spot: bench
      when: relay7_pattern
  story: mara                      # their knot
  only: concierge                  # someone the Concierge makes up (gone in raw view), or raw (edited out of its view)
```

People are drawn as characters of their own, never painted into a place: only far-off figures and people sitting
still behind a window can be part of the picture.

## Things

What she can carry.

```yaml
- id: old_laptop
  name: { concierge: Retro laptop, raw: old laptop }
  note: { concierge: "Vintage device · not connected", raw: "it still boots. it doesn't phone home." }
  size: 32 × 24 × 4 cm             # real size: its picture is drawn to it
  look:                            # its picture in her things, a prompt for each view
    concierge: ...
    raw: ...
  unlicensed: true                 # made by people, not the Concierge: it offers to dispose of it
  only: concierge                  # exists only in one view (her credits)
  starts: fixer-shop/back-shelf    # where it is as the chapter begins: a place/spot (that spot has item: old_laptop),
                                   # carried, or given (the Script gives it: ~ carried += old_laptop)
```

Her things show raw view's name and note in her own voice, lowercase; the Concierge's view shows its own.

## Story state

What the story keeps track of, new in this chapter. The catalog lists what the game has: use those, never declare
them again.

```yaml
variables:
  - name: relay_found
    start: false                   # true or false, a number, or "text"
    means: she has found the relay's door on the street
lists:                             # an errand's stages, as an Ink list: rare
  - name: RelayErrand
    items: [unstarted, asked, found]
```

`Things` gets the chapter's things by itself. Name variables for what happened (`parcel_delivered`), not for the
puzzle (`step_3_done`).

## Puzzles

How each puzzle works, for review and for the playthrough checks.

```yaml
- id: root-password
  goal: read the handover note
  steps:
    - read ~/.sh_history on the relay's machine
    - become root with the password typed there by mistake (relay7_root)
    - read /root/handover.txt (relay7_handover)
  gives: [relay7_handover]         # variables or things it ends with
  hint: the history has a line that is not a command
```

Difficulty comes from reasoning, not from hidden pixels or random guesses (the bible, 8.4).

## Journal and notebook

The **journal** is her device: the Concierge can read it. Objectives, people, places and evidence anyone may see. The
**notebook** is paper, read only in a privacy zone: what she keeps from the Concierge, in her own voice, lowercase.
Both have pages; the catalog lists them.

```yaml
- page: objectives                 # a page of the catalog's, or a new one (give its title under Notes)
  id: the-voice
  name: The voice under the static
  when: radio_heard                # written once this holds
  done: relay_found                # crossed out once this holds
  lines:
    - Find out where it comes from.
    - { text: "It comes at three, on 7350 kHz.", when: heard_at_three }
```

## Close-ups

A moment shown up close over the dimmed scene: her wrist in the station's cuff. The Script shows one with
`# closeup: <id>`, and `# closeup: off` ends it.

```yaml
- id: laptop-screen
  look:
    concierge: ...                 # a prompt for each view, of the same moment
    raw: ...
```

## Machines

An old computer she can type at, opened by `# terminal: <id>`: a small Unix, offline and read-only. She can list,
read and search its files, and become another user with a password she has found. The game gives it its commands
(`ls`, `cd`, `cat`, `grep`, `find`, `su`, `man` and the rest); the chapter writes what is on it.

```yaml
- id: relay7
  name: Relay 7                    # on the screen's bar
  host: relay7                     # the machine's name in its prompt
  system: MRA/UX 3.2 PM-11         # what uname -a says
  clock: 2030-11-02 03:12          # its date as it comes up
  boot:                            # what it prints as it comes up
    - MRA PM-11 ROM monitor 2.04
    - "WARNING: clock battery flat; the date may be wrong"
  user: okafor                     # who was left logged in
  users:
    okafor: { name: "Daniel Okafor, relay technician", home: /home/okafor }
    root: { home: /root, password: w1nter-carrier, login: { relay7_root: true } }   # login: what becoming it tells the story
  files:                           # by path from /; a path ending in / is a directory
    /etc/motd:
      text: |
        MRA/UX 3.2 - Municipal Relay Authority
        RELAY 7 - Eastern District
    /home/okafor/todo:
      owner: okafor
      date: 2030-10-30 17:41
      text: |
        - ask Mara about the 03:00 test pattern. it is not on the schedule
    /root/:
      mode: rwx------              # who may read it, as ls shows it: here only its owner, root
    /root/handover.txt:
      mode: rw-------
      read: { relay7_handover: true }   # reading it whole tells the story this
      text: |
        ...
    /var/spool/relay/archive.tar:
      kind: tar archive            # a file that is not text: what `file` says it is
      entries: [schedule/rev01.txt, log/2030-10.txt]
      damaged: true                # tar lists this far, then stops
  man:                             # manual pages of its own
    relayd: |
      RELAYD(8) ...
```

A file can wait for the story (`when`), so what is on the machine can change as she learns. Passwords are found, not
guessed: in a careless history, a note, a conversation.

## Script

The story, in Ink: one knot for each spot that does more than show a text, and one for each person.

```ink
=== relay_terminal ===
= look
{ raw_view:
    A grey terminal, its keys worn blank.
- else:
    A sleek workstation, asleep.
}
-> END
= use
# terminal: relay7
-> END
= use_old_laptop
You set the laptop beside it. The cables don't fit. Of course they don't.
-> END
```

- **Verbs.** A spot's knot runs one stitch per verb: Look runs `look`, Talk `talk`, Use `use`, Take `take`, Ask
  `ask`. Using a thing she carries on it runs `use_<thing>`; with none, nothing comes of it. Other stitches are the
  knot's own (`= offer`).
- **What a stitch shows.** One plain line (narration, or hers) with nothing to answer is written at the thing. More
  (several lines, someone speaking, choices, a command) is a conversation, each line over the head of who says it.
- **Speakers.** A tag at the end of a spoken line: `"Shop's closed." #fixer`. `#luna`, `#concierge`, or a person's id.
  A line without a tag is narration: second person, present tense ("You set the laptop beside it.").
- **Choices.** `* [Text]` disappears once picked; `+ [Text]` can be picked again. Two to four at a time. Every branch
  ends in `-> END` or goes back to a choice.
- **Two views.** `raw_view` is true in raw view: `{ raw_view: ... - else: ... }`, raw view first. Write both wherever
  they differ.
- **The story's state.** `~ relay_found = true`. Her pockets: `~ carried += old_laptop`, `~ carried -= old_laptop`.
  `taken` holds everything she has ever picked up. Read them in conditions: `{ carried has old_laptop: ... }`.
- **A knot of the game's** (the catalog lists them) is rewritten by giving a knot of the same name: the chapter's
  replaces it whole. A knot's name is unique in the whole game: name a thing's knot `<place>_<spot>` unless it is
  plainly unique.
- **Not used:** `INCLUDE`, `EXTERNAL`, threads (`<-`), and tags other than speakers and the commands below.

### Commands

A tag `name: value` makes the game do something before the line is said; the conversation waits for it. On a line of
its own, it belongs to the next line.

| Command | What the game does |
| --- | --- |
| `walk: desk`, `walk: 640` | She walks to a spot, or to x, and turns to it. |
| `face: left`, `face: right` | She turns. |
| `wear: party` | She changes, behind a fade (the catalog's outfits). |
| `go: street/from-relay` | She goes to a place, arriving at one of its arrivals. The conversation goes on there. |
| `fade: 0.6` | The screen goes dark for so many seconds, and comes back. |
| `view: raw`, `view: concierge` | The view switches. |
| `wait: 1.5` | A pause, in seconds. |
| `closeup: laptop-screen`, `closeup: off` | A close-up over the dimmed scene, until `off` or the conversation's end. |
| `terminal: relay7` | An old machine's screen, until she switches it off. |

### Conditions

Wherever the data says `when` or `done`, and in Ink's `{ ... }`:

```
relay_found                      true when it is true, a number other than 0, a word, a list with something in it
!relay_found, not relay_found    not
favours_owed >= 1                == != < <= > >=, against numbers, true or false, or "words"
carried has old_laptop           a list holds a thing; carried has (old_laptop, valve) holds both
a && b, a and b, a || b, a or b  both, either
( ... )                          grouping
```

## Writing

- **Lines** are one or two sentences, under 25 words: they are captions on a small screen. At most four lines
  between choices.
- **Choices** are under 8 words, two to four at a time.
- **British spelling** (favour, colour). No real brands, people or countries by name.
- **The Concierge** is kind, calm and sure. It calls her "guest", never raises its voice, and never says anything bad
  about the city. Its view names things the way a brochure would: "Fine dining · by reservation".
- **Raw view and her own words:** dry, short, observant. Her things' notes and her notebook are lowercase.
- **Privacy.** Anything she would not want the Concierge to know belongs in a privacy zone: her home, the public
  restroom, approved meeting rooms. Raw view is legal, and the Concierge knows she uses it; it notices a long or
  frequent stay in a privacy room (the director's decisions on the bible, 21 October).
- **Content.** Adult themes are welcome: smoking, drinking, violence, despair, attraction. No explicit sex and no
  nudity: the game is made for app stores.

## Art: prompts and scale

The look is the game's own: flat shapes, dramatic light, the two views' references. The pipeline gives every prompt
that look. A prompt says **what is there**, not how to draw it.

- **Both views, always.** The Concierge's view is the same place made beautiful, glossy and expensive, real and
  physical (never a hologram). Raw view is what is there: worn, cheap, post-Soviet, in the smog. The outlines match:
  the same layout, the same things in the same places.
- **Real sizes.** Places in metres, people's heights in metres, things in centimetres. Every picture is measured
  against Luna (1.7 m) before it is used: a door is 2 to 2.1 m, a seated adult about 1.3 m to the top of the head.
- **Where, in words.** "On the desk, left of the window". Never coordinates: spots are placed in the editor.
- **Props.** Anything she takes, moves or uses up, or anything that changes, is a prop (`prop: true`): a picture of
  its own, not painted into the place.
- **People** are characters: give their height, pose and both views. Not painted into places.
- **No writing** in pictures except signs that say what they must; signs are in English, Chinese or Japanese in the
  Concierge's view, faded Cyrillic in raw view.

## What the checker checks

- **Every section's data:** the required fields, the ids, both views, real sizes, `new: false` only for what the game
  has.
- **Every reference:**
  - knots, things, places and arrivals;
  - outfits, close-ups and machines;
  - the variables and things every condition names.
- **The Script,** compiled with the game's story: Ink errors with their file and line, the commands and what they name,
  speakers who are someone.
- **The writing's limits:** lines over 25 words, choices over 8, look texts over 30, positions given as coordinates.
- **What it would take to make:** places, people, things, props and close-ups, in my hours and the image model's
  dollars.

## Before handing a chapter over

- [ ] About, Beats, and a Questions section, even if empty.
- [ ] Every new place, person, thing and close-up has a prompt for each view and its real size.
- [ ] Every new spot says where it is, in words, and has something to see or do.
- [ ] Every variable it uses is in the catalog or under Story state; every thing in the catalog or under Things.
- [ ] Every knot a spot or person names is in the Script.
- [ ] Every puzzle says its steps and what it gives.
- [ ] `npm run chapter` shows no errors.
