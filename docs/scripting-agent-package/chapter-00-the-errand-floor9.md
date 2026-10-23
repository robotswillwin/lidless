# Chapter 0: Floor 9

The corridor below Luna's: Athena's flat, 9-07, is behind its third door. She rings first (`athena_bell`), then
Athena's invitation lets her in (`athena_door`). As she steps out again, the Concierge asks whether Athena was home
(`arrive`: `athena_asked`), and she covers for her.

## Places

```yaml
- id: floor9
  new: false
  name: Floor 9
  kind: interior
  size: a corridor 8 m long, 2.6 m high, between the corridors of the floors above and below
  greeting: Good evening, Luna.
  assist: This is floor nine, Luna. Yours is fourteen.
  arrive:
    - story: athena_asked
      when: athena_note_read and athena_report == "not_asked"
  arrivals:
    - id: lift
      where: just out of the lift, at the left end
    - id: from-athena
      where: outside flat 9-07, at Athena's door
  spots:
    - id: lift
      name: Lift
      look:
        concierge: Polished steel doors, and over them its floor number glowing softly.
        raw: Scratched steel doors. Over them the indicator's needle shivers between two floors.
      tag:
        concierge: Floors 1 to 20
        raw: it still runs
      ask: The lift serves every floor, Luna. Yours is fourteen.
      story: lift
      kind: way
    - id: door-1
      name:
        concierge: Flat 9-05
        raw: 9-05
      look:
        concierge: Flat 9-05. Quiet.
        raw: A door with a dent at kicking height.
      use:
        concierge: A neighbour's door. No reason to knock.
        raw: Not my door. No reason to knock.
    - id: door-2
      name:
        concierge: Flat 9-06
        raw: 9-06
      look:
        concierge: Flat 9-06. Quiet behind it.
        raw: 9-06. Shut. Faint music behind it, or in the pipes.
      use:
        concierge: A neighbour's door. No reason to knock.
        raw: Not my door. No reason to knock.
      tag:
        concierge: Guest · Integrated Care
        raw: 9-06
    - id: door-3
      name:
        concierge: Flat 9-07
        raw: 9-07
      look:
        concierge: Flat 9-07, right under yours.
        raw: 9-07. The same door as yours, five floors down.
      story: athena_door
      kind: way
    - id: bell
      name: Doorbell
      story: athena_bell
    - id: plant
      name: Plant
      look:
        concierge: A plant in a white pot, glowing faintly pink from beneath.
        raw: A plastic plant over a pink light nobody turns off.
    - id: window
      name: Window
      look:
        concierge: The city, nine floors down, glittering.
        raw: Smog, and the lights under it. The towers across the way are close enough to count windows.
    - id: floors
      name:
        concierge: Other floors
        raw: Above and below
      look:
        concierge: "Floors eight and ten: quiet corridors, the same as this one."
        raw: "Ten: a bicycle, someone's boots. Eight: a child's drawing taped to a door."
```

## Script

```ink
=== athena_door ===
// flat 9-07, Athena's, on floor nine. She rings first, as one does, though Athena said to walk in; then her invitation
// (a message, read) lets her in. The door's reader is a machine of the city's, so it says "guest" (#door); the
// Concierge knows the visit is allowed, and cannot see in
= look
{ athena_invitation_read:
    9-07. Athena's. No marks on the door, nothing forced.
- else:
    9-07. The same door as yours, five floors down.
}
-> END
= talk
-> athena_bell.ring
= ask
{ athena_invitation_read:
    "Athena has authorised your visit, Luna. I can't see inside, of course." #concierge
- else:
    "Flat 9-07, a private home, Luna." #concierge
}
-> END
= use
{ not athena_invitation_read:
    "Good {good()}, guest. This home is private." #door
    -> END
}
{ not athena_bell_rung:
    I'll ring first. #luna
    -> END
}
"Welcome, guest. The resident has let you in." #door
~ athena_flat_entered = true
# go: athena-home/door
The door opens on Athena's flat.
-> END

=== athena_bell ===
// the bell beside 9-07, under its reader
= look
{ raw_view:
    A bell push, worn shiny, under the door's reader.
- else:
    The door's panel: a bell, and its reader.
}
-> END
= use
-> ring
= talk
-> ring
= ring
~ athena_bell_rung = true
You ring. Far inside, the bell. Nobody comes.
{ athena_invitation_read:
    She said to walk in. #luna
}
-> END

=== athena_asked ===
// as she steps out of Athena's flat the Concierge asks: it saw her go in and come out, not what she saw in there. She
// says what Athena asked her to (decision 40): her word, not a fact (athena_report)
"Was Athena at home, Luna?" #concierge
+ [Yes. Her music was loud.]
    ~ athena_report = "covered"
    "I'm glad she's well. Thank you, Luna." #concierge
- ~ prologue_complete = true
-> END
```
