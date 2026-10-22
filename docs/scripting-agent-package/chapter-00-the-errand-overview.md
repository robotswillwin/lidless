# Chapter 0: The errand

The game's opening as it is built, written in the chapter format
(`docs/story/LIDLESS_Chapter_Format_v1_2026-10-22.md`): a worked example to copy from. Everything here is already in
the game, so places, people, things and variables say `new: false`, and they describe what is there rather than ask
for it. A new chapter leaves `new` out.

## About

```yaml
chapter: 0
title: The errand
length: 15
summary: >
  Luna has a parcel to deliver to the radio repair on the main street by ten. The fixer there takes it without opening
  it, and offers to switch on raw view in her eyepiece for a favour, to be named later. In raw view the curio on her
  desk is a radio valve; with it her old transistor radio works again, and under the static there is a voice that is
  not the Concierge's.
```

## Beats

1. **Home.** She wakes to the parcel on her desk (`home/parcel`), due at the radio repair by ten. Her radio
   (`home/radio`) is missing a valve. Her flat is a privacy zone: her notebook opens here.
2. **The street.** Down the backstreet to the main street: the nutrition station, its woman in red (`street/dock`),
   the guardian on its round, the bars, the restroom.
3. **The fixer.** At the radio repair she gives him the parcel (using `parcel` on `fixer`: `parcel_delivered`). He
   offers raw view for a favour; she accepts (`has_raw`, `favours_owed`).
4. **Seeing.** In raw view the street changes: the woman at the station is wire-thin, her wrist locked in a cuff.
5. **The radio.** At home, in raw view, the curio on her desk is a radio valve (`home/valve`, item `valve`). Used on
   the radio (`use_valve`): `radio_heard`. A voice under the static.

## People

```yaml
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
      dark trousers, polished boots; a smooth white eyepiece with a soft blue light over his left eye. The radio is a
      restored relic in walnut and cream bakelite.
    raw: >
      A wiry man: hollow cheeks, grey stubble, sallow skin, short untidy grey hair, tired, watchful eyes; a heavy,
      scratched grey visor of riveted plates over his left eye; a pilled grey cardigan over a stained work shirt.
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
- id: parcel
  new: false
  name: Parcel
  note: { concierge: "Delivery 4471 · to Radio Repair, by 22:00", raw: "for the radio man. don't open it." }
  size: 20 × 14 × 9 cm
  look:
    concierge: A neat white box with the Concierge's mark on it.
    raw: A small cardboard box sealed with brown tape, a handwritten label with the number 4471.
  starts: home/parcel

- id: valve
  new: false
  name: Valve
  note: { concierge: "Vintage · decorative curio", raw: "for the radio. the left one's dead." }
  size: 7 cm tall
  look:
    concierge: A vintage glass ornament with a faint warm glow, on a little stand.
    raw: An old radio valve, a glass tube with its pins, in a jam jar.
  starts: home/valve

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

## Puzzles

```yaml
- id: the-parcel
  goal: deliver the parcel to the radio repair
  steps:
    - take the parcel from her desk (home/parcel)
    - use it on the fixer, in the radio repair
  gives: [parcel_delivered]

- id: the-radio
  goal: make her radio work
  steps:
    - accept the fixer's offer, raw view (has_raw)
    - at home in raw view, the curio is a radio valve; take it
    - use the valve on the radio
  gives: [radio_heard]
  hint: In the Concierge's view the valve is only an ornament; nothing points at it until raw view.
```

## Journal

```yaml
- page: objectives
  id: parcel
  name: Parcel 4471
  done: parcel_delivered
  lines:
    - Deliver to Radio Repair, Main Street, by 22:00.
    - { text: Delivered., when: parcel_delivered }

- page: objectives
  id: radio
  name: My radio
  done: radio_heard
  lines:
    - Needs a new valve. The left one is dead.
    - { text: Working again., when: radio_heard }
```

## Notebook

```yaml
- page: seen
  id: cradle
  name: the woman at the station
  when: has_raw
  lines:
    - real. wire-thin. nobody looks at her.

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

- None: this chapter is built. A real chapter puts its questions for the director here.
