# Chapter 0: Luna's home

## Places

```yaml
- id: home
  new: false
  name: Luna's home
  kind: interior
  size: 6.5 m wide, 2.8 m high, a cutaway of her flat in a tall block
  private: true
  greeting: Welcome home, Luna. I'll leave you to yourself.
  assist: Your parcel is due at Radio Repair by 22:00, Luna. The main street is to the right as you leave.
  look:
    concierge: >
      A small hotel room she has made her own: a glass shower and a basin with a mirror ringed with light, a bed
      under a window full of glittering neon towers, a desk with her terminal, a photograph, a retro speaker, a red
      coat by the door. Warm, soft, expensive.
    raw: >
      The same room as it is: a steel shower and toilet behind a screen that sticks, a narrow standard-issue bed, a
      metered water tap, the window onto smog and panel blocks, a desk with an old terminal and a transistor radio
      with its back off. Clean, cheap, cared for.
  light: a desk lamp and the window; in the Concierge's view warm cove light
  arrivals:
    - id: door
      where: just inside the door, by the coat
  ways:
    - id: door
      name: Door
      where: on the right
      to: backstreet
      arrive: door
  spots:
    - id: radio
      name: { concierge: Retro speaker, raw: Transistor radio }
      where: on the desk, right of the terminal
      size: 25 cm wide
      story: radio
    - id: valve
      name: { concierge: Curio, raw: Radio valve }
      where: on the desk, beside the radio
      size: 7 cm tall
      prop: true
      item: valve
      look:
        concierge: A vintage ornament, the Concierge calls it. It glows a little.
        raw: An old radio valve in a jar. You don't know why you bought it, or why you keep looking at it.
      take:
        concierge: You pocket the curio.
        raw: The valve. The radio's been waiting for one.
    - id: parcel
      name: Parcel
      where: on the desk, at its right end
      size: 20 × 14 × 9 cm
      prop: true
      item: parcel
      look:
        concierge: A neat white box with the Concierge's mark. Due at Radio Repair by 22:00.
        raw: Brown paper and string, no address on the outside. Due at Radio Repair by 22:00.
    - id: photo
      name: Photograph
      where: on the desk, at its left end
      story: photo
    - id: mirror
      name: Mirror
      where: over the basin, in the bathroom
      look:
        concierge: "Your face as the Concierge keeps it: rested, flawless, a white shell over your right eye."
        raw: Your own face. Tired, freckled, the old goggle strapped over your right eye.
    - id: screen
      name: { concierge: The Concierge's screen, raw: Wall screen }
      where: on the wall above the desk
      look:
        concierge: Asleep, a faint ring of light. In here it waits to be asked.
        raw: A grey panel, off. In here it neither sees nor hears you.
      tag: Your Concierge
      ask: Good evening, Luna. You called? Your parcel is due at Radio Repair by 22:00.
```

## Script

```ink
=== radio ===
= look
{ raw_view:
    A transistor radio with its back off, a screwdriver beside it. {radio_heard: It works now. Mostly.|Weeks of work. It almost works.}
- else:
    A decorative retro speaker. It plays whatever the Concierge thinks you'd like.
}
-> END
= use
{ raw_view:
    { radio_heard:
        Static, and under it the voice again. Too faint to make out a word.
    - else:
        { carried has valve:
            -> use_valve
        - else:
            Static. One valve's dead, the one on the left. It needs another.
        }
    }
- else:
    Soft music, chosen for you.
}
-> END
= use_valve
{ radio_heard:
    It already has one.
    -> END
}
You prise out the dead valve and press the new one in. # wait: 0.4
~ carried -= valve
~ radio_heard = true
It warms. Static, a long hiss, and then, under it, almost, a voice. Not the Concierge's. #luna
-> END

=== photo ===
= look
{ raw_view:
    You, and the one you're looking for, an arm round your shoulders. The Concierge shows you alone.
- else:
    You, alone, smiling at something out of frame.
}
-> END
```
