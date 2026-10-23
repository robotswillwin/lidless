# Chapter 0: The errand

The game's beginning as it is built, written in the chapter format
(`docs/story/LIDLESS_Chapter_Format_v1_2026-10-22.md`): a worked example to copy from. It is the opening, "The
Invitation" (her morning, Athena's message, Athena's empty flat), and the errand it leads into (the parcel, the fixer,
raw view, her radio). Everything here is in the game, so places, things and variables say `new: false`, and they
describe what is there rather than ask for it; a new chapter leaves `new` out. Athena is the one exception: she is not
drawn yet, so hers is a new person's entry.

Imported, it changes nothing (`npm run chapter -- docs/chapters/00-the-errand --import --dry`): that is how we know it
says what the game does.

## About

```yaml
chapter: 0
title: The errand
length: 40
summary: >
  Luna wakes in her flat on the fourteenth floor and calls the Concierge. Two messages are waiting: a parcel on her
  desk for Radio Repair, due by ten, and Athena, her neighbour on floor nine, asking her down for a surprise. She
  dresses, takes her paper notebook from her desk and goes down. Athena's flat is empty. On her workbench a note says
  she is fine, had to leave quickly, and asks Luna to tell the Concierge she was home with her music loud; a timetable
  of patrol times and a receipt for a portable computer at Radio Repair hint at more. As Luna steps out, the Concierge
  asks whether Athena was home, and Luna covers for her. Then the errand: at Radio Repair the fixer takes the parcel
  without opening it, and offers to switch on raw view in her eyepiece for a favour, to be named later. In raw view the
  curio on her desk is a radio valve; with it her old transistor radio works again, and under the static there is a
  voice that is not the Concierge's.
```

## Beats

1. **Waking** (`home`, knot `opening`, run once as a new game begins). Two close-ups in the dark: her left eye shut,
   then open as the device over her right eye lights (`waking-closed`, `waking-open`). Then she is standing in her
   room in her underwear. "Good morning, CO.": she calls the Concierge (`concierge_home`), its privacy sign open while
   the call lasts.
2. **Her messages** (`## Messages`). In the Concierge's card: the delivery, and Athena's invitation
   (`intro_messages_read`, `athena_invitation_read`). Until she has read both she stays in ("My messages first.").
3. **Her desk** (`home/desk`, a close-up of its own: `home-desk`). Her paper notebook is there (`paper_notebook`):
   taken, it opens wherever the Concierge cannot see. The parcel and the curio are there too, and her top drawer of
   tools. She dresses at her coat (`home/coat`): she does not go out in her underwear.
4. **The lift** (`floor14/lift`, knot `lift`). Floor nine, once she has read Athena's invitation; not the ground
   floor until she has been to Athena ("Athena asked me to come down. I'll see her first.").
5. **Athena's door** (`floor9/door-3`, knots `athena_bell` and `athena_door`). She rings first (`athena_bell_rung`),
   and nobody comes. The invitation lets her in; the door's reader calls her guest (`athena_flat_entered`).
6. **Athena's flat** (`athena-home`). A whole home, and nobody in it. Her workbench is a close-up of its own
   (`athena-bench`): her note against the radio (`athena_note_read`; it stays up close until Luna puts it down), the
   receipt under its paperweight (`athena_repair_slip_seen`), the gap where her portable computer stood, a drawer of
   spare valves and old letters. The timetable is pinned on the wall over the bench (`athena_patrol_sheet_seen`). She
   can keep all three papers.
7. **The Concierge asks** (`floor9`, its `arrive`: `athena_asked`). As she steps out it asks whether Athena was home,
   and she says what Athena asked her to (decision 40): `athena_report` is `"covered"`, and `prologue_complete`.
8. **The street.** Down to the lobby and out by the backstreet to the main street: the nutrition station and its
   woman in red (`street/dock`), the guardian on its round, the bars, the restroom.
9. **The fixer.** At Radio Repair she gives him the parcel (using `parcel` on `fixer`: `parcel_delivered`). He offers
   raw view for a favour; she accepts (`has_raw`, `favours_owed`).
10. **Seeing.** In raw view the street changes: the woman at the station is wire-thin, her wrist locked in a cuff.
11. **The radio.** At home, in raw view, the curio on her desk is a radio valve (`home-desk/valve`, item `valve`).
    Used on the radio (`use_valve`): `radio_heard`. A voice under the static.

## People

Athena is not there: the chapter has no knot of hers and nothing of hers to say, so the checker's note that she has
no `story` is expected. Her entry is for drawing her later; until then she is her message, her note and her flat.

```yaml
- id: athena
  name: Athena
  who: >
    Luna's older neighbour in flat 9-07, a trusted friend and her mentor: curious, inventive, fond of old radios, real
    things and music. Once more deeply integrated, she went down to Level 1, as the city has her on record; she may now
    have gone to Level 0, which Luna does not know and the opening never says. Luna knows her only as Athena.
  age: 89
  height: 1.62 m
  level: 1
  voice: >
    Warm, quick, mischievous and reassuring, with flashes of impatience and pride. Brave and affectionate, and capable
    of poor judgement and of hiding things.
  pose: standing at her workbench, her right hand resting by an old radio
  moves: still
  look:
    concierge: >
      The same woman in the same pose, as the Concierge keeps her: elegant, practical clothes in the same outline, her
      silver hair glossy, smooth skin, a modest white eyepiece over her right eye with a soft light, the wrist
      interfaces clean and glowing. No devices of a higher level.
    raw: >
      A small, energetic woman of eighty-nine: expressive silver hair, aged skin, work-worn hands, practical clothes,
      weathered and mended. Level 1: a plain, worn device over her right eye only, ports at her wrists. Faint healed
      marks where the implants and fluid lines of a higher level were taken out; nothing of them is left.

- id: fixer
  new: false
  name: The fixer
  who: >
    He repairs old radios in a cramped shop on the main street, and switches on raw view in people's eyepieces, for a
    favour. Late fifties.
  height: 1.72 m
  voice: Dry, few words, tired and kind underneath. Never explains more than he must.
  pose: hunched over his workbench, an old radio and a soldering iron in his hands
  moves: still
  look:
    concierge: >
      Healthy and handsome for his age: neat silver hair and a trimmed silver beard, a tailored charcoal knit sweater,
      dark trousers, polished boots; a smooth white shell with a soft blue light over his right eye. The radio is a
      restored relic in walnut and cream bakelite.
    raw: >
      A wiry man: hollow cheeks, grey stubble, sallow skin, short untidy grey hair, tired, watchful eyes; a heavy,
      scratched grey visor of riveted plates bolted over his right eye; a pilled grey cardigan over a stained work
      shirt.
  where:
    - place: radio
      spot: fixer
  story: fixer

- id: guardian
  new: false
  name: { concierge: Civic guardian, raw: Guard unit }
  who: A civic guardian robot that walks a beat on the main street and tells the Concierge what it sees.
  height: 1.6 m
  voice: The Concierge's own manners, a little slower. Kind, sure of itself, never in doubt.
  pose: walking, upright
  moves: patrols
  look:
    concierge: Smooth white panels, clean dark joints, a cyan visor light, crisp grey letters C on its chest.
    raw: Old cream metal plates with rust at the seams, faded letters C, one amber visor light.
  where:
    - place: street
      spot: guardian
  story: guardian
```

## Things

```yaml
- id: paper_notebook
  new: false
  name: Notebook
  note: { concierge: "Paper notebook · protected use", raw: "private paper. never on co-net." }
  size: 15 × 21 × 1.5 cm
  look:
    concierge: The same notebook in neat dark blue cloth with an elastic strap, clean and new; nothing written on it.
    raw: >
      A small closed notebook bound in faded pale cloth, worn at the corners, an elastic band round it and a pencil
      under the band; nothing written on it.
  starts: home-desk/notebook

- id: athena_note
  new: false
  name: Note
  note: { concierge: "Personal paper note", raw: "athena wrote this in a hurry." }
  size: 15 × 21 cm
  look:
    concierge: The same folded sheet in clean bright white paper, one corner creased; nothing written on it.
    raw: A sheet of plain paper folded in half, worn and fibrous, a smudge and one creased corner; completely blank.
  starts: athena-bench/note

- id: athena_patrol_sheet
  new: false
  name: Timetable
  note: { concierge: "Personal timing observations", raw: "repeating gaps. what was she watching?" }
  size: 21 × 29.7 cm
  look:
    concierge: The same ruled sheet, clean and crisp, its lines faint; nothing written on it.
    raw: A single sheet of ruled paper folded once, worn at the folds, faint erased pencil pressure; no writing on it.
  starts: athena-home/timetable

- id: athena_repair_slip
  new: false
  name: Receipt
  note: { concierge: "Radio Repair · service receipt", raw: "portable computer. waiting at radio repair?" }
  size: 8 × 13 cm
  look:
    concierge: The same receipt slip, clean white and curled at one corner; no print on it.
    raw: A narrow paper receipt slip, yellowing and curled at one corner; blank, no print on it.
  starts: athena-bench/receipt

- id: parcel
  new: false
  name: Parcel
  note: { concierge: "Delivery 4471 · to Radio Repair, by 22:00", raw: "for the radio man. don't open it." }
  size: 20 × 14 × 9 cm
  look:
    concierge: The same parcel made neat and new, a clean white box with a soft grey ribbon round it, a printed label.
    raw: A small cardboard box sealed with brown tape, a handwritten label with the number 4471.
  starts: home-desk/parcel

- id: valve
  new: false
  name: Valve
  note: { concierge: "Vintage · decorative curio", raw: "for the radio. the left one's dead." }
  size: 7 cm tall
  look:
    concierge: The same valve made a collector's curio, polished glass on a glossy black base, glowing a soft amber.
    raw: An old radio valve, a small glass tube on a black base with metal pins, its filament glowing faintly orange.
  starts: home-desk/valve

- id: matches
  new: false
  name: Matches
  note: { concierge: "Open flame · not permitted indoors", raw: "three left. real fire. it hates that." }
  size: 5 × 3.5 × 1.5 cm
  unlicensed: true
  starts: carried
```

## Story state

```yaml
variables:
  - name: intro_morning_started
    new: false
    start: false
    means: the waking ran, and she is standing at home; her messages have come
  - name: intro_messages_read
    new: false
    start: false
    means: she read the delivery message
  - name: athena_invitation_read
    new: false
    start: false
    means: she read Athena's message; floor nine is hers to go to
  - name: athena_bell_rung
    new: false
    start: false
    means: she rang Athena's bell
  - name: athena_flat_entered
    new: false
    start: false
    means: she went into Athena's flat
  - name: athena_note_read
    new: false
    start: false
    means: she read Athena's note
  - name: athena_patrol_sheet_seen
    new: false
    start: false
    means: she looked at the timetable
  - name: athena_repair_slip_seen
    new: false
    start: false
    means: she looked at the receipt
  - name: athena_drawer_open
    new: false
    start: false
    means: Athena's workbench, up close; its drawer open
  - name: athena_scope_wave
    new: false
    start: sine
    means: the shape of the line on Athena's oscilloscope, as its dial is turned ("sine", "square", "triangle", "saw")
  - name: athena_report
    new: false
    start: not_asked
    means: what she told the Concierge leaving Athena's flat, "covered" (decision 40); her word, not a fact about Athena
  - name: prologue_complete
    new: false
    start: false
    means: the opening is over; the errand goes on
  - name: luna_drawer_open
    new: false
    start: false
    means: her desk, up close; its top drawer open
  - name: has_raw
    new: false
    start: false
    means: the fixer has switched on raw view in her eyepiece; the view switch is hers
  - name: favours_owed
    new: false
    start: 0
    means: favours she owes the fixer
  - name: parcel_delivered
    new: false
    start: false
    means: the parcel is on the fixer's bench
  - name: radio_heard
    new: false
    start: false
    means: her radio works again, and she has heard the voice under the static
```

## Messages

```yaml
- id: delivery-4471
  from: Delivery
  arrives: intro_morning_started
  text: |
    DELIVERY 4471 — Parcel ready for collection at your desk.
    Destination: Radio Repair, Main Street. Due: 22:00.
  read: intro_messages_read

- id: athena-invitation
  from: Athena
  arrives: intro_morning_started
  text: >
    Luna! Come down as soon as you're awake. I've got a surprise for you. I've given you access to 9-07. Just walk in,
    don't knock. — Athena
  read: athena_invitation_read
```

## Puzzles

```yaml
- id: the-morning
  goal: leave her flat for Athena's
  steps:
    - read her two messages, in the Concierge's card
    - dress, at her coat
    - take the lift to floor nine
  gives: [athena_invitation_read]
  hint: >
    Until she has read her messages she stays in ("My messages first."), and in her underwear she stays in. The lift
    offers floor nine once she has read Athena's. Her notebook, on her desk, is hers to take; nothing waits on it.

- id: athenas-door
  goal: go into Athena's flat
  steps:
    - ring the bell (floor9/bell)
    - use the door; her invitation lets her in
  gives: [athena_flat_entered]
  hint: She rings before she goes in ("I'll ring first."), though Athena said to walk in.

- id: athenas-note
  goal: find out where Athena is
  steps:
    - go up to her workbench (athena-home/bench, the close-up athena-bench)
    - read the note against the radio
    - step out; the Concierge asks, and she covers for Athena
  gives: [athena_note_read, prologue_complete]
  hint: >
    The note is in plain sight on the bench. The timetable on the wall and the receipt under the paperweight are for
    the curious; nothing waits on them.

- id: the-parcel
  goal: deliver the parcel to the radio repair
  steps:
    - take the parcel from her desk (home-desk/parcel)
    - use it on the fixer, in the radio repair
  gives: [parcel_delivered]

- id: the-radio
  goal: make her radio work
  steps:
    - accept the fixer's offer, raw view (has_raw)
    - at home in raw view, the curio on her desk is a radio valve; take it
    - use the valve on the radio
  gives: [radio_heard]
  hint: In the Concierge's view the valve is only an ornament; nothing points at it until raw view.
```

## Journal

```yaml
- page: objectives
  id: visit-athena
  name: Athena's surprise
  when: athena_invitation_read
  done: athena_flat_entered
  lines:
    - Athena asked me to visit her on floor nine, flat 9-07.
    - { text: I went into her flat., when: athena_flat_entered }

- page: objectives
  id: parcel
  name: Parcel 4471
  when: intro_messages_read or not intro_morning_started
  done: parcel_delivered
  lines:
    - Deliver Parcel 4471 to Radio Repair, Main Street, by 22:00.
    - { text: Delivered., when: parcel_delivered }

- page: objectives
  id: radio
  name: My radio
  done: radio_heard
  lines:
    - Needs a new valve. The left one is dead.
    - { text: Working again., when: radio_heard }

- page: people
  id: fixer
  name: The fixer
  when: has_raw
  lines:
    - Radio Repair, Main Street. Repairs old electronics.
```

The parcel's objective shows once she has read the delivery; in a game saved before the opening was built, from the
start.

## Notebook

```yaml
- page: seen
  id: athena-note
  name: athena's note
  when: athena_note_read
  lines:
    - athena left before i arrived. she says she is fine.
    - she wants me to say she was home, listening to loud music.
    - why shouldn't co know she went out?

- page: think
  id: athena-timings
  name: times and gaps
  when: athena_patrol_sheet_seen
  lines:
    - repeating intervals. did she watch the drones and guardians?
    - avoiding one patrol couldn't hide someone from the whole city.

- page: questions
  id: athena-computer
  name: old portable computer
  when: athena_repair_slip_seen
  lines:
    - radio repair has a receipt for athena's portable computer.
    - is it still there? why wasn't she using co-net?

- page: seen
  id: cradle
  name: the woman at the station
  when: has_raw
  lines:
    - real. wire-thin. nobody looks at her.

- page: seen
  id: favour
  name: the fixer
  when: has_raw
  lines:
    - I owe him one favour. he didn't say what.

- page: seen
  id: voice
  name: my radio
  when: radio_heard
  lines:
    - a voice under the static. whose?

- page: questions
  id: before
  name: who ran the radio shop before Care?
```

## Close-ups

```yaml
- id: waking-closed
  dark: true
  look:
    concierge: >
      Luna's face up close in the dark as she wakes, her head on a white pillow, seen from above: glossy black hair
      with pink and teal streaks, a sleek visor over her right eye, dark and unlit; her left eye closed. Deep blue
      darkness, a thin line of violet neon from a window across the pillow.
    raw: >
      The same face in the dark: dull ash-blonde hair, pale tired skin; over her right eye the old goggle, its amber
      lens unlit; her left eye closed. A thin grey pillow, a rough blanket, a dim smog glow from the window.

- id: waking-open
  dark: true
  look:
    concierge: The same, its framing kept exactly; her left eye open, looking up, the visor glowing a soft ice-blue.
    raw: The same, its framing kept exactly; her left eye open, the goggle's amber lens glowing warm from within.

- id: athena-note
  hand: true
  text: |
    Luna,
    I'm fine. Better than fine. I had to leave quickly.
    If CO asks, tell it I was home. The music was loud. I didn't hear you.
    Please don't message me. I promise I'll explain.
    — Athena
  look:
    concierge: >
      A folded sheet of plain paper opened out on a polished walnut workbench, seen from above, close; cream white,
      softly lit, a crease on one corner, completely blank. At the edges, a restored radio and the warm wood.
    raw: >
      The same sheet on a scarred workbench: worn, fibrous, a smudge, still with nothing written on it; an old radio
      with its back off, solder and wire clippings; dim yellow light.

- id: athena-timetable
  hand: true
  text: |
    07:10 / 07:16 / 07:22 / 07:28
    Civic unit: +6, +6, +6
    Aerial: varies. Check again.
    Service entrance? Not enough.
  look:
    concierge: >
      A single sheet of ruled paper pinned to a wall with a red pin, seen straight on, close: faint lines, completely
      blank, nothing written on it; the warm, softly lit wall around it.
    raw: The same sheet on a stained wall, worn at the folds, faint erased pencil pressure, still no writing on it.

- id: athena-receipt
  text: |
    RADIO REPAIR
    SERVICE 218

    Portable computer —
    battery and data connector

    Status: bench test complete;
    awaiting collection

    Customer: Athena
  look:
    concierge: >
      A paper receipt seen from above, very close: a slip of clean white paper filling the frame from top to bottom,
      completely blank, a small round glass paperweight on its top corner; a little of a polished walnut bench.
    raw: The same receipt on a scarred bench, yellowing, one corner curled, blank; a scratched glass paperweight.

- id: station
  look:
    concierge: >
      A young woman's right forearm and hand on the white, softly lit armrest of the nutrition station, seen from the
      side, palm down. A slim glowing cyan cuff closed round her wrist, above her own white wrist band. A small cyan
      hologram of her vitals above her hand: all good. Behind, a soft blur of night and neon. No face.
    raw: >
      The same moment: a worn, riveted metal armrest with cracked padding; a heavy steel clamp locked round her wrist, a
      rubber tube from it to a small glass window where an orange liquid drips.
```

## Questions

Built for now as the opening's overview proposed, and still the director's to decide (the decisions record, under
"Open, for the director"):

1. **Athena and Luna.** Chosen family, or a relative as well? Nothing in the game says either.
2. **Athena's age and height**: 89 and 1.62 m, as proposed. She is not drawn yet.
3. **The note's wording**, as written.
4. **The clues.** Both the timetable and the receipt are there on the first visit; or one held back for a later one.
5. **A call from a friend's home.** Can Luna call the Concierge from Athena's? Built not: only from her own.
6. **The photograph** on her desk (decision 31): what it shows in the Concierge's view.
