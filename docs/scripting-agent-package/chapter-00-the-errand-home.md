# Chapter 0: Luna's home

Her flat on the fourteenth floor, 14-07, where a new game begins: her waking (`opening`), her call to the Concierge
(`concierge_home`, a call because her home is a home), and the morning she does not leave until she has read her
messages (`stay`). Her desk is a close-up of its own (`home-desk`): tapped, the view goes in close, and its things are
handled one by one. She has no terminal and no radio: everything of hers is the Concierge's voice and gestures (decision
45). Its Newton's cradle swings when she sets it going; in the Concierge's view a hologram puzzle of three rings floats
over the desk, and her frame shows her photos in turn.

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
      Her desk in warm evening light: a photo frame showing her photos in turn, the Concierge's hologram of three rings
      floating over the desk, a brass cup of pencils, a Newton's cradle in polished chrome, a dark blue notebook and a
      white parcel with a grey ribbon; three smooth drawers.
    raw: >
      A worn grey metal desk, nearly bare: an empty photo frame, a tin cup of pencils, an old Newton's cradle, a pale
      cloth notebook and a parcel in brown paper and string; a pedestal of three drawers.
  spots:
    - id: photo
      name: Photograph
      story: photo
    - id: pencils
      name: Pencils
      look:
        concierge: Pencils in a brass cup. You still like to write things down.
        raw: Pencils, chewed. A tin cup.
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
        raw: Fuses. Two good, one blown.
      when: luna_drawer_open
    - id: screwdrivers
      name: Screwdrivers
      look:
        concierge: A set of little screwdrivers.
        raw: Little screwdrivers, for whatever comes loose.
      when: luna_drawer_open
    - id: buttons
      name: Buttons
      look:
        concierge: A tin of buttons.
        raw: Buttons from coats you no longer have.
      when: luna_drawer_open
    - id: ring-outer
      name: Outer ring
      where: the hologram's outer ring, floating over the desk left of the pencils
      look: Three rings of light, each with a gap. Turn one, and the one inside it turns too.
      story: hologram_outer
      only: concierge
      kind: machine
    - id: ring-middle
      name: Middle ring
      where: the hologram's middle ring
      look: Three rings of light, each with a gap. Turn one, and the one inside it turns too.
      story: hologram_middle
      only: concierge
      kind: machine
    - id: ring-inner
      name: Inner ring
      where: the hologram's inner ring
      look: Three rings of light, each with a gap. Turn one, and the one inside it turns too.
      story: hologram_inner
      only: concierge
      kind: machine
    - id: cradle
      name: Newton's cradle
      where: on the desk, right of the pencils
      look:
        concierge: A Newton's cradle in polished chrome, its five balls hanging still.
        raw: An old Newton's cradle, its steel gone dull. It still clicks true.
      story: luna_cradle
      kind: thing
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
"Good morning, CO." #luna
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

=== photo ===
// a projection: in raw view its frame is empty (decision 31). In the Concierge's view, its photos in turn, of the people
// in her life (decision 45): her alone, with Athena at Athena's bench and on a roof at night, at a party
= look
{ raw_view:
    An empty frame. The pictures were only ever the Concierge's.
- else:
    Your photos, one after another: you, you and Athena, the two of you on a roof, a party.
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

=== luna_cradle ===
// a Newton's cradle on her desk, real in both views: used, an end ball is lifted and let go, and the game swings it
// each time her count of swings goes up (cradle_swings)
= use
~ cradle_swings += 1
{&You lift the end ball and let it go. Click, clack.|The knock runs through the still ones and out the other side.|Click. Clack. Click. It always settles in the end.}
-> END

=== hologram_inner ===
// a puzzle of the Concierge's over her desk, a hologram of three rings (gone in raw view): a ring turned drags the one
// inside it; their gaps lined up, it opens into a flower of light. The game draws it, live (scene home-desk's rings)
= use
{ rings_solved: -> rings_again }
~ rings_in = (rings_in + 1) % 6
Click. The inner ring turns a sixth.
-> rings_turned

=== hologram_middle ===
= use
{ rings_solved: -> rings_again }
~ rings_mid = (rings_mid + 1) % 6
~ rings_in = (rings_in + 1) % 6
Click. The middle ring turns, and the inner one with it.
-> rings_turned

=== hologram_outer ===
= use
{ rings_solved: -> rings_again }
~ rings_out = (rings_out + 1) % 6
~ rings_mid = (rings_mid + 1) % 6
Click. The outer ring turns, and the middle one with it.
-> rings_turned

=== rings_turned ===
{ rings_in == rings_mid && rings_mid == rings_out:
    ~ rings_solved = true
    The gaps line up. The rings chime and open, like a flower of light.
}
-> END

=== rings_again ===
~ rings_solved = false
~ rings_in = 3
~ rings_mid = 0
~ rings_out = 5
The flower folds back into three rings, turned apart again.
-> END

=== luna_drawer ===
// her desk's top drawer, up close (scene home-desk): odds and ends
= look
{ luna_drawer_open:
    Odds and ends: a torch, tape, little tools.
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
