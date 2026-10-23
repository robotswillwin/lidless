// Athena's flat, 9-07 (scene athena-home): a private home, the Concierge outside it. Her note, the timetable pinned over
// her bench, a receipt under a paperweight, and where something portable stood. The papers' words are their close-ups'
// own (public/assets/closeups.json), set over the blank paper in her hand or in type. Included by main.ink.

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

// Her workbench up close (scene athena-bench): her radio, her lamp, a drawer to open
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

=== athena_scope ===
// her oscilloscope, still on: its big dial turns the line through its shapes (athena_scope_wave), and the game draws
// the line live on its screen. A bonus: nothing waits on it
= use
{ athena_scope_wave:
- "square":
    ~ athena_scope_wave = "triangle"
    Click. The steps sharpen into peaks.
- "triangle":
    ~ athena_scope_wave = "saw"
    Click. It climbs, drops, and climbs again.
- "saw":
    ~ athena_scope_wave = "sine"
    Click. Back to the slow wave.
- else:
    ~ athena_scope_wave = "square"
    You turn the big dial. Click: the wave squares off.
}
-> END
