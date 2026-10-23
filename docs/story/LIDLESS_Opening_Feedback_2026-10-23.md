# LIDLESS — Feedback on the opening overview, "The Invitation"
**23 October 2026 · from the director and the build, for the scripting agent · on the director-review draft of `overview.md`**

The overview is approved in its direction: the story, its pacing, its stop point and its care for privacy are right.
Revise it with the points below and send it back for approval; only then write the place files.

The director's decisions record (`LIDLESS_Director_Decisions_2026-10-22.md`, updated today, decisions 29 to 33) has
the new decisions in full and holds over this note where they differ. Use the refreshed `CATALOG.md`: it lists the
places, knots, things and variables the game has now, including Luna's tower.

## 1. The director's answers

- **Time of day (decision 29).** The Concierge's view has no day: it is always evening or night. Raw view shows the
  real time: by day, the city's smog and fog. So the opening can be a morning, and "Good morning" stays. In the
  Concierge's view her room looks like evening; nobody remarks on it, it is normal to them. Raw view is not available
  in the opening.
- **Athena's level (32).** She was downgraded from a higher level to Level 1, and has now probably gone to Level 0,
  which Luna does not know. Give her `level: 1`, what the city has on record, and say the rest in `who`. Drawn later,
  she shows Level 1 (a simple eyepiece over the right eye, the wrist interfaces); traces of her higher levels may show
  (healed marks where implants and fluid lines were), never the equipment itself.
- **Waking (33).** A close-up, as the feeding at the station is, with no lying or rising animation: two pictures shown
  in turn, her face in the dark with the left eye shut, then open, the right eye's device lighting. Then she is
  standing in her room.
- **The privacy sign (30).** Every privacy location shows the closed eye, in the Concierge's interface; the game draws
  it, so never paint it into a place. A call or an emergency breaks privacy: the sign changes to the open eye until it
  ends. Luna can call the Concierge from a private home, never from a public privacy room (a public restroom, an
  approved meeting room). So the morning conversation is a **call**: she calls, the eye opens, they talk, she ends it,
  the eye closes. This replaces the draft's rule that the closed eye must not open because she asks a question:
  during a call it is open, and that is the point. She chose to let it in.
- **The photograph (31).** A projection: in raw view its frame is empty. What it shows in the Concierge's view is still
  to decide; don't build on it.
- **Your questions.** Answered: Q3 (one notebook: picking up the paper notebook makes her notebook available, there
  is no second system), Q4 (floors 14 and 9, no B1: see 2), Q7 (the photograph, above), Q9 (yes: the opening comes
  before the existing parcel errand, which stays). Still open, for the director: Q1 (chosen family or a relative), Q2
  (her age and height), Q5 (the note's wording), Q6 (both clues in the opening, or one held back), Q8 (later).

## 2. Fit the overview to the game as it is built

1. **The Concierge calls her Luna** (decision 15). Every `#concierge` line says Luna, never guest: "Good morning,
   Luna", "Athena has authorised your visit, Luna", "Thank you, Luna", and so on. Every other machine or system says
   guest: the lift (`#lift`), a door's reader, a delivery.
2. **Her tower exists** (decision 26). Use it rather than new places:
   - Her flat, `home`, opens on `floor14`, the corridor of floor 14; her door there is `her-door` (flat 14-07).
   - The lift is the hotspot `lift` on every floor and in the lobby; using it runs the game's knot `lift`
     (`tower.ink`), a choice of floors that offers every floor but the one she is on (`scene_now`). There is no
     lift-cabin scene and no floor-panel close-up: the choice is the panel. Drop `luna-landing`, `building-lift` and
     `athena-landing`.
   - Athena lives on **floor 9** (`floor9`, its corridor already drawn and playable), in flat 9-07 behind the door
     `door-3`, directly below Luna's. The corridor's middle door (`door-2`, 9-06) stands ajar on another neighbour,
     a Level 3 guest in his chair: say whether it stays so in the opening or is shut.
   - `lobby` is the ground floor, Entrance 3, out to the backstreet. There is no storage floor: drop B1.
   - Rewrite the game's `lift` knot (same name, in `lobby.md`): Athena's floor appears once her invitation is read
     (`athena_invitation_read`); choosing the ground floor before the visit gives Luna's one line, and the lift stays.
3. **One new place:** `athena-home`, `private: true`, entered from `floor9/door-3`. Your size (8.5 × 3.0 m) is right:
   the game's rooms are cutaways about 8 m wide.
4. **Things: one name in both views, ten letters at most** (the format): `paper_notebook` "Notebook", `athena_note`
   "Note", `athena_patrol_sheet` "Timetable", `athena_repair_slip` "Receipt". How each view sees a thing goes in its
   `note`.
5. **Papers are text, not pictures of text.** A close-up of a paper (the note, the timetable, the receipt) gives its
   exact words in a new field, `text`; its `look` is the paper with nothing written on it, and the game sets the words
   over it in handwriting. See 3.
6. **The inbox is a section of its own**, `## Messages` (see 3), not a close-up: drop `morning-messages`.
7. **Athena:** `level: 1`. She has no knot and is not present, so the checker's note that she has no `story` is
   expected.
8. **Don't paint the Concierge's marks into anything** (decision 25): no closed eye, no C, no interface. The game draws
   them, in its view only.
9. **Spots.** Her wardrobe is `home/coat`; there is no `home/notebook` spot yet: declare it, a new spot on the desk
   with `item: paper_notebook` and `prop: true`. She can wake in her underwear (`# wear: underwear` in the opening
   knot) and dress at the wardrobe; the game keeps her in until she is dressed to go out.

## 3. New in the format, for this opening

Write these as shown. The build adds them to the format, the checker and the game when it builds the opening.

- **The opening knot.** A new game begins with the knot `opening`, run once in `home`: the waking close-ups, the
  first line, whatever must be set.
- **Calls.** In a private home, Talk in the Concierge's card is a call: the game runs `concierge_<place>`
  (`concierge_home` at home), and the privacy sign shows the open eye until the conversation ends. There is no call in
  a public privacy room. Elsewhere, Talk runs the same knots, as it does now.
- **Messages:**
  ```yaml
  ## Messages
  - id: delivery-4471
    from: Delivery
    arrives: intro_morning_started       # a condition: from when it is in her inbox
    text: >
      DELIVERY 4471 — Parcel ready for collection at your desk. Destination: Radio Repair, Main Street. Due: 22:00.
    read: intro_messages_read            # optional: a variable the game sets true when she reads it
  ```
- **The words on a close-up:**
  ```yaml
  - id: athena-note
    hand: true                           # in handwriting; without it, the interface's type
    text: |
      Luna,
      I'm fine. Better than fine. ...
      — Athena
    look:
      concierge: A folded sheet of paper, nothing written on it, ...   # the paper only: the game writes the words
      raw: ...
  ```
- **On arriving:** a place can run a knot as she arrives, once, while a condition holds. For the Concierge's question
  when she steps out of Athena's flat onto floor 9:
  ```yaml
  arrive:
    - story: athena_asked
      when: athena_note_read and athena_report == "not_asked"
  ```
- **The notebook:** her private notebook (the paper one, read only in privacy zones) opens only once she carries
  `paper_notebook`.

## 4. Smaller points

- `athena_report` as a word is right: `start: "not_asked"`, the answers set `"covered"`, `"truthful"` or `"private"`.
- Rewriting the journal's `objectives/parcel` with `new: false` is right; the catalog shows its current lines. Keep it
  one entry.
- The notebook pages `seen`, `think` and `questions` exist.
- Lines under 25 words, choices under eight (the format).
- Keep writing raw views for every place, thing and close-up, though raw view is not available in the opening.

## 5. Deliver

Return the revised `overview.md` for approval. After approval, the place files, each with `## Places` YAML and
`## Script` Ink: `home.md` (its changes), `floor9.md` (Athena's door), `athena-home.md` (new) and `lobby.md` (the lift
knot rewritten). The build checks them with `npm run chapter`.
