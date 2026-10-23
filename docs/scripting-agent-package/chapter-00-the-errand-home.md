# Chapter 0: Luna's home

Her flat on the fourteenth floor, 14-07, where a new game begins: her waking (`opening`), her call to the Concierge
(`concierge_home`, a call because her home is a home), and the morning she does not leave until she has read her
messages (`stay`). Her desk is a close-up of its own (`home-desk`): tapped, the view goes in close, and its things are
handled one by one.

## Places

```yaml
- id: home
  new: false
  name: Luna's home
  kind: interior
  size: 6.5 m wide, 2.8 m high, a cutaway of her flat in a tall block
  look:
    concierge: >
      A small hotel room she has made her own: a glass shower and a basin with a mirror ringed with light, a low bed
      under a window full of glittering neon towers, her desk, a red coat by the door. Warm, soft, expensive.
    raw: >
      The same room as it is: a steel shower behind a screen that sticks, a narrow standard-issue bed, a metered
      water tap, the window onto smog and panel blocks, a worn grey desk. Clean, cheap, cared for.
  private: true
  home: true
  greeting: Welcome home, Luna. I'll leave you to yourself.
  assist: Your parcel is due at Radio Repair by 22:00, Luna. Take the lift down; the main street is to the right.
  stay:
    when: intro_morning_started and not (intro_messages_read and athena_invitation_read)
    say: My messages first.
  arrivals:
    - id: door
      where: just inside the door, by the coat
    - id: bed
      where: by the bed, where she wakes
  ways:
    - id: door
      name: To the corridor
      to: floor14
      arrive: her-door
  spots:
    - id: coat
      name:
        concierge: Red coat
        raw: Raincoat
      look:
        concierge: "Your coat: glossy red, with a neon trim that catches every light."
        raw: Your raincoat, worn brown and cheap. Still damp from yesterday.
      wardrobe: true
    - id: shower
      name:
        concierge: Bathroom
        raw: Wash unit
      look:
        concierge: A glass shower, a toilet, a basin, a mirror ringed with light. Exactly the right temperature, always.
        raw: A steel shower, a steel toilet, a basin. Four minutes of water a day. The screen sticks.
      use:
        concierge: Exactly the right temperature, as always.
        raw: Four minutes of lukewarm water. Enough.
      wear: nude
    - id: mirror
      name: Mirror
      look:
        concierge: "Your face as the Concierge keeps it: rested, flawless, a white shell over your right eye."
        raw: Your own face. Tired, freckled, the old goggle strapped over your right eye.
    - id: plant
      name: Plant
      look:
        concierge: Lush and green. It always looks like this.
        raw: Small, a few leaves gone yellow. Alive. You keep it alive.
      use:
        concierge: You water it. Here, it doesn't need it.
        raw: You give it a little of your water. It needs it.
    - id: bed
      name: Bed
      look:
        concierge: Soft linen, turned down for you. Rest is part of the service.
        raw: Standard issue. Clean. Thin.
    - id: window
      name: Window
      look:
        concierge: The skyline glitters, close enough to touch. Flying cars thread between the towers.
        raw: Smog, and the panel blocks across the yard. A few windows lit.
    - id: book
      name: Book
      look:
        concierge: A book. The Concierge would gladly read it to you.
        raw: Paper. Nothing in it can change while you're not looking.
    - id: desk
      name:
        concierge: Your desk
        raw: My desk
      look:
        concierge: Your desk.
        raw: My desk.
      zoom: home-desk
    - id: screen
      name:
        concierge: The Concierge's screen
        raw: Wall screen
      look:
        concierge: Asleep, a faint ring of light. In here it waits to be asked.
        raw: A grey panel, off. In here it neither sees nor hears you.
      tag: Your Concierge
      ask: Good evening, Luna. You called? Your parcel is due at Radio Repair by 22:00.
      kind: machine
    - id: water
      name:
        concierge: Water
        raw: Water tap
      look:
        concierge: Water, cool and exactly enough.
        raw: A metered tap. It counts every cup.
      use:
        concierge: Cool, and exactly enough.
        raw: You drink. The meter ticks.

- id: home-desk
  new: false
  name:
    concierge: Your desk
    raw: My desk
  kind: interior
  private: true
  home: true
  greeting: Welcome home, Luna. I'll leave you to yourself.
  assist: Your parcel is due at Radio Repair by 22:00, Luna.
  closeup: home
  size: the desk 1.6 m wide, seen from the front and a little above
  look:
    concierge: >
      Her desk in warm evening light: a glowing photograph of her smiling, a slim monitor, a brass pencil cup, a retro
      speaker, a valve curio, a dark blue notebook and a white parcel with a grey ribbon; three smooth drawers.
    raw: >
      A worn grey metal desk: an empty photo frame, an old terminal with worn keys, a tin cup of pencils, a transistor
      radio with its back off and a dead valve beside it, a spare valve, a pale cloth notebook and a parcel in brown
      paper and string; a pedestal of three drawers.
  spots:
    - id: photo
      name: Photograph
      story: photo
    - id: terminal
      name: Terminal
      look:
        concierge: "Your terminal: credits, messages, the news, a game you never finish."
        raw: Your terminal. The letters are worn off its keys, under your fingers.
      use:
        concierge: Nothing new. Your credits are where you left them.
        raw: The screen hums. Nothing new.
      kind: machine
    - id: pencils
      name: Pencils
      look:
        concierge: Pencils in a brass cup. You still like to write things down.
        raw: Pencils, chewed. A tin cup.
    - id: radio
      name:
        concierge: Retro speaker
        raw: Transistor radio
      story: radio
      kind: machine
    - id: dead-valve
      name:
        concierge: Valve
        raw: Dead valve
      look:
        concierge: A glass ornament, lying on its side.
        raw: The dead valve, the left one. Its filament snapped.
    - id: lower-drawers
      name: Drawers
      look:
        concierge: Your clothes, folded neatly.
        raw: Socks, darned twice. Two shirts.
      use:
        concierge: Your clothes, folded. Nothing you need now.
        raw: Socks and shirts. Nothing I need now.
    - id: drawer
      name:
        concierge: Drawer
        raw: Top drawer
      story: luna_drawer
      when: not luna_drawer_open
    - id: drawer-open
      name:
        concierge: Drawer
        raw: Top drawer
      story: luna_drawer
      when: luna_drawer_open
    - id: torch
      name: Torch
      look:
        concierge: A slim torch.
        raw: A torch. The battery's nearly flat.
      when: luna_drawer_open
    - id: tape
      name: Tape
      look:
        concierge: A roll of insulating tape.
        raw: Tape. Half the flat is held together with it.
      when: luna_drawer_open
    - id: fuses
      name: Fuses
      look:
        concierge: Spare fuses.
        raw: Fuses, for the radio. Two good, one blown.
      when: luna_drawer_open
    - id: screwdrivers
      name: Screwdrivers
      look:
        concierge: A set of little screwdrivers.
        raw: Screwdrivers small enough for the radio's screws.
      when: luna_drawer_open
    - id: buttons
      name: Buttons
      look:
        concierge: A tin of buttons.
        raw: Buttons from coats you no longer have.
      when: luna_drawer_open
    - id: valve
      name:
        concierge: Curio
        raw: Radio valve
      look:
        concierge: A vintage ornament, the Concierge calls it. It glows a little.
        raw: An old radio valve. You don't know why you bought it, or why you keep looking at it.
      take:
        concierge: You pocket the curio.
        raw: The valve. The radio's been waiting for one.
      item: valve
    - id: notebook
      name: Notebook
      story: notebook
      item: paper_notebook
    - id: parcel
      name: Parcel
      look:
        concierge: A neat white box, a grey ribbon round it. Due at Radio Repair by 22:00.
        raw: Brown paper and string, no address on the outside. Due at Radio Repair by 22:00.
      take:
        concierge: "Delivery 4471: in your things. Due at Radio Repair by 22:00."
        raw: The parcel. For the radio man. Don't open it.
      item: parcel
```

## Script

```ink
=== opening ===
// A new game begins here (the game runs it once): her flat, in the morning. Two close-ups, her face in the dark, her
// left eye shut and then open as the device over her right lights (decision 33; the right eye has no lids). Then she
// is standing in her room in her underwear, and calls the Concierge (decision 30: from home she can). Raw view is not
// hers yet.
~ intro_morning_started = true
# closeup: waking-closed
Dark. Warm. The city, far off, humming.
# closeup: waking-open
# wear: underwear
Your left eye opens. Over the right, the light comes on.
# closeup: off
Morning. Not that you'd know it from the light in here.
# call: concierge
Good morning, CO. #luna
-> END

=== concierge_home ===
// a call from her home: it hears her only while the call lasts, its privacy sign open (decision 30); when they are
// done it leaves her home to her
"Good {good()}, Luna." #concierge
{ not intro_messages_read or not athena_invitation_read:
    "Two messages came in for you while you slept." #concierge
}
- (topics)
+ [What's happening today?]
    { not parcel_delivered:
        "A parcel for Radio Repair, on Main Street, due by 22:00. It's on your desk, Luna." #concierge
    }
    { athena_invitation_read and not athena_flat_entered:
        "And Athena is expecting you on nine." #concierge
    }
    { parcel_delivered and (athena_flat_entered or not athena_invitation_read):
        "Nothing you have to do, Luna. A quiet day." #concierge
    }
    -> topics
+ [What are my credits?]
    "{credits} credits, Luna. Your allowance came in at midnight." #concierge
    -> topics
+ [Does this room stay private?]
    "Always. I can hear you now only because you called me. When we're done, I leave, and your home is yours again." #concierge
    -> topics
+ [That's all, thanks.]
    "Have a lovely {good()}, Luna." #concierge
    -> END

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
// a projection: in raw view its frame is empty (decision 31). What it shows in the Concierge's view is still the
// director's to decide; nothing is built on it
= look
{ raw_view:
    An empty frame. The picture was only ever the Concierge's.
- else:
    You, alone, smiling at something out of frame.
}
-> END

=== notebook ===
// her paper notebook, on the end of her desk: hers, never on CO-net. Taken, her notebook opens in a privacy zone
= look
{ raw_view:
    Your notebook. Handwritten pages, kept away from CO-net.
- else:
    A small fabric-bound notebook. It is yours, not CO's.
}
-> END
= take
~ carried += paper_notebook
~ taken += paper_notebook
You slip your notebook into your pocket. Where CO can't see, you can write in it.
-> END

=== luna_drawer ===
// her desk's top drawer, up close (scene home-desk): her tools, mostly for the radio
= look
{ luna_drawer_open:
    Your tools. Mostly for the radio.
- else:
    Your top drawer.
}
-> END
= use
{ luna_drawer_open:
    ~ luna_drawer_open = false
    You push the drawer shut.
- else:
    ~ luna_drawer_open = true
    The drawer sticks, then gives.
}
-> END
```
