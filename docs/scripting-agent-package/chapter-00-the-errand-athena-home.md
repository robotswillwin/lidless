# Chapter 0: Athena's flat

Flat 9-07, Athena's home: a private home, the Concierge outside it. Athena is not there. Her workbench is a close-up of
its own (`athena-bench`): her note against the radio, the receipt under its paperweight, where her portable computer
stood, and a drawer of spare valves and old letters. The timetable is pinned on the wall over the bench, in the room.

## Places

```yaml
- id: athena-home
  new: false
  name:
    concierge: Flat 9-07
    raw: Athena's flat
  kind: interior
  size: 8.5 m wide, 3 m high, a cutaway of her flat, below Luna's
  look:
    concierge: >
      Athena's home curated and desirable in warm evening light: a glass shower, a glossy kitchenette, a bed made
      with crisp linen under a window onto the neon city, a velvet armchair, a brass lamp, a polished walnut
      workbench of restored radios.
    raw: >
      An older woman's lived-in flat full of loved old technology: an old shower and basin, a kitchen corner, a bed in
      an alcove under shelves of books, a worn green armchair, a lamp with a mended fringe, a scarred workbench of
      radios in pieces and an oscilloscope.
  private: true
  greeting: A private home, Luna.
  assist: This is Athena's home, Luna. I cannot see or hear you in here. I'll be outside.
  arrivals:
    - id: door
      where: just inside her door
  ways:
    - id: door
      name: Door
      look:
        concierge: The way back to the corridor.
        raw: Her door. Two bolts, both open.
      to: floor9
      arrive: from-athena
  spots:
    - id: coats
      name: Coat stand
      look:
        concierge: A felt hat and a red scarf. Hers.
        raw: Her hat, her red scarf. She went out without them?
    - id: shower
      name: Shower
      look:
        concierge: A sleek glass shower.
        raw: An old shower, its curtain mended with tape.
    - id: basin
      name: Basin
      look:
        concierge: A neat basin under a glowing mirror.
        raw: A chipped basin. Her comb, her toothbrush.
    - id: kitchen
      name:
        concierge: Kitchenette
        raw: Kitchen
      look:
        concierge: A glossy little kitchenette.
        raw: A hot plate, a red kettle, two cups upside down to dry.
      use:
        concierge: "You open the cupboards: neat cups, fine tea. Nothing out of place."
        raw: Tea, two cups, biscuits gone soft. Nothing out of place.
    - id: window
      name: Window
      look:
        concierge: The city glitters below.
        raw: The city under its smog.
    - id: books
      name: Books
      look:
        concierge: Books, beautifully kept.
        raw: Manuals, radio catalogues, poetry.
    - id: bed
      name: Bed
      look:
        concierge: Crisp linen, neatly made.
        raw: Her bed, made in a hurry, the quilt folded back.
    - id: armchair
      name:
        concierge: Armchair
        raw: Her chair
      look:
        concierge: Deep green velvet. Inviting.
        raw: The seat still holds her shape.
    - id: records
      name:
        concierge: Record player
        raw: Records
      look:
        concierge: A glossy turntable.
        raw: Records, real ones. She lets me borrow them.
    - id: lamp
      name:
        concierge: Floor lamp
        raw: Lamp
      look:
        concierge: Brass, warm light.
        raw: The fringe is mended with thread.
    - id: shelf
      name: Radios
      look:
        concierge: Restored radios, like a museum.
        raw: More radios, half of them in pieces.
    - id: bench
      name: Workbench
      look: Her workbench.
      zoom: athena-bench
    - id: timetable
      name: Timetable
      story: athena_timetable
      item: athena_patrol_sheet

- id: athena-bench
  new: false
  name:
    concierge: Athena's workbench
    raw: Her workbench
  kind: interior
  private: true
  greeting: A private home, Luna.
  assist: This is Athena's home, Luna. I cannot see or hear you in here.
  closeup: athena-home
  size: the bench top 1.8 m wide, seen from the front and a little above
  look:
    concierge: >
      Her workbench polished walnut: a restored radio glowing, a clean white note propped against it, a receipt under
      a glass paperweight, a clean rectangle in the dust and a cable unplugged, a brass lamp, a gleaming oscilloscope,
      a drawer with a brass pull.
    raw: >
      A scarred workbench: an old valve radio with its back off, a folded note propped against it, a curled receipt
      under a dark glass paperweight, a clean rectangle in the dust and a cable unplugged, an angled lamp, an
      oscilloscope with its green trace, a shallow drawer.
  spots:
    - id: tools
      name: Soldering iron
      look:
        concierge: A soldering iron, cold, on its stand.
        raw: Her soldering iron. Cold. She always switches it off.
    - id: radio
      name: Radio
      story: athena_radio
    - id: gap
      name: Workbench
      story: athena_gap
    - id: cable
      name: Cable
      story: athena_gap
    - id: lamp
      name: Lamp
      story: athena_lamp
    - id: scope
      name: Oscilloscope
      look:
        concierge: Its line rises and falls, calm as breathing.
        raw: Still on. Whatever it was listening to, it still is.
    - id: drawer
      name: Drawer
      story: athena_drawer
      when: not athena_drawer_open
    - id: drawer-open
      name: Drawer
      story: athena_drawer
      when: athena_drawer_open
    - id: valves
      name: Valves
      story: athena_valves
      when: athena_drawer_open
    - id: wire
      name: Wire
      look:
        concierge: Coils of copper wire, wound neatly.
        raw: Copper wire, wound tight. She wastes nothing.
      when: athena_drawer_open
    - id: letters
      name: Letters
      story: athena_letters
      when: athena_drawer_open
    - id: note
      name: Note
      story: athenas_note
      item: athena_note
    - id: receipt
      name: Receipt
      story: athena_receipt
      item: athena_repair_slip
```

## Script

```ink
=== athena_bench ===
= look
{ raw_view:
    Her workbench. Radios in pieces, a soldering iron cold on its stand.
- else:
    A handsome workbench, every radio restored like a museum piece.
}
-> END
= use
Better not touch her work. She knows where everything is. #luna
-> END

=== athena_gap ===
= look
A clean rectangle in the dust, and a lead, unplugged. Something portable stood here.
-> END
= use
The lead goes nowhere now. Whatever it fed, she took it, or someone did.
-> END

=== athenas_note ===
// her note: reading it is what the opening turns on. It stays close up until she puts it down. Taken, she keeps it; it
// never goes on CO-net
= look
~ athena_note_read = true
# read: athena-note
Athena's writing, quick and slanted: she was pleased with herself.
Better than fine. That's what you always say. #luna
What are you up to, Athena? #luna
-> END
= take
{ not athena_note_read:
    ~ athena_note_read = true
    # read: athena-note
    It's for you, in Athena's hand.
}
~ carried += athena_note
~ taken += athena_note
You fold the note and keep it. Hers and yours, not CO's.
-> END

=== athena_timetable ===
= look
~ athena_patrol_sheet_seen = true
# read: athena-timetable
Times, in her hand. Columns of them, and gaps.
-> END
= take
~ athena_patrol_sheet_seen = true
~ carried += athena_patrol_sheet
~ taken += athena_patrol_sheet
You unpin the sheet and fold it away.
-> END

=== athena_receipt ===
= look
~ athena_repair_slip_seen = true
# read: athena-receipt
Her portable computer. Still at Radio Repair? #luna
-> END
= take
~ athena_repair_slip_seen = true
~ carried += athena_repair_slip
~ taken += athena_repair_slip
You slide the receipt from under the paperweight.
-> END

=== athena_radio ===
= look
{ raw_view:
    Its back is off. Valves glowing, half of them new.
- else:
    Restored like a museum piece, its dial glowing.
}
-> END
= use
Better not touch her work. She knows where everything is. #luna
-> END

=== athena_lamp ===
= look
Her lamp, still on.
-> END
= use
You leave it on. She'll be back. #luna
-> END

=== athena_drawer ===
= look
{ athena_drawer_open:
    Valves, wire, fuses. And letters, tied with string.
- else:
    A shallow drawer under the bench, a brass pull.
}
-> END
= use
{ athena_drawer_open:
    ~ athena_drawer_open = false
    You push the drawer shut.
- else:
    ~ athena_drawer_open = true
    The drawer slides out.
}
-> END

=== athena_valves ===
= look
Spare valves for her radios, each standing in its place.
-> END
= use
-> take
= take
Her spares. I don't need them. #luna
-> END

=== athena_letters ===
= look
Old letters, tied with string. Hers.
-> END
= use
Letters to her, years old. Nothing to do with today. #luna
-> END
= take
-> use
```
