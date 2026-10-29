// The whole story: the variables the game reads and sets, and one file per scene.
// Lines are tagged with who speaks them (#luna, #fixer, #concierge, …); untagged lines are narration. Speech is written in
// quotes; a #luna line without quotes is what she thinks, shown softer (her picked answers are always said). A tag `name: value`
// is something the game does before the line is said: walk, face, wear, go, fade, view, wait (see dialogue.ts).
// An object can have a knot of its own, a stitch for each verb (look, talk, use, take, ask) and use_<thing> for using a
// thing she carries on it: a scene's hotspot names it with `story`.

INCLUDE street.ink
INCLUDE home.ink
INCLUDE concierge.ink
INCLUDE bar.ink
INCLUDE tower.ink
INCLUDE athena.ink

// set by the game when a conversation starts and at every choice: true while Luna sees raw view
VAR raw_view = false
// read by the game: true once the fixer has switched on raw view in her eyepiece, which unlocks the view switch
VAR has_raw = false
// favours she owes the fixer, for raw view among them: he names each when he needs it
VAR favours_owed = 0
// read by the game: what the city is like now, a variant the scenes have ("rain", "fog", "outage"); "" as they are
VAR conditions = ""

// Her credits: digital, her allowance, on her account. The Concierge's greeting shows them in its view
VAR credits = 312
// read by the game: her connection level, 0 to 5 (the director's decision 18): 1 is Basic Care. Its card shows it
VAR care_level = 1

// set by the game: how many times she has gone from one scene to another, all told (a clock the story counts by)
VAR arrivals = 0
// set by the game: the scene she is in now (its id)
VAR scene_now = ""
// set by the game: the part of the day by its clock, "morning", "afternoon", "evening" or "night" (the Concierge's view
// is evening whatever it says)
VAR day_part = "evening"
// when she last fed at a nutrition station (arrivals then): she does not need to again for a while
VAR fed_at = -100
// who sits at the main street's station: the street turns it each time she comes back (its scene file's `rotate`)
VAR station_seat = "woman"

// The things she can carry: public/assets/items.json says how each looks and what it is called. What she carries now,
// and what she has picked up anywhere, which is gone from where it was (the game adds to both as she takes a thing)
LIST Things = parcel, matches, cigarettes, map, paper_notebook, athena_note, athena_patrol_sheet, athena_repair_slip
VAR carried = (matches, cigarettes, map)
VAR taken = ()

// The opening, "The Invitation" (docs/chapters/00-the-errand): her morning, Athena's invitation, the visit to 9-07. The
// waking ran and she is standing at home; she read the delivery message; she read Athena's (floor nine is hers to go
// to); she rang Athena's bell; she went into Athena's flat; read Athena's note; looked at the timetable; looked at the receipt
VAR intro_morning_started = false
VAR intro_messages_read = false
VAR athena_invitation_read = false
VAR athena_bell_rung = false
VAR athena_flat_entered = false
VAR athena_note_read = false
VAR athena_patrol_sheet_seen = false
VAR athena_repair_slip_seen = false
// her workbench, up close (scene athena-bench): its drawer open
VAR athena_drawer_open = false
// her oscilloscope on it: the shape of its line and its speed, as its two knobs are turned ("sine", "square",
// "triangle", "saw"; "slow", "medium", "fast")
VAR athena_scope_wave = "sine"
VAR athena_scope_speed = "slow"
// what she told the Concierge leaving Athena's flat: "not_asked", then "covered", as Athena asked (the opening does not
// branch here: decision 40). Her word, not a fact about Athena
VAR athena_report = "not_asked"
VAR prologue_complete = false

// the errand the game begins with: the parcel on her desk, to the radio repair by ten
VAR parcel_delivered = false
// her desk, up close (scene home-desk): its top drawer open; how many times she has set its Newton's cradle swinging
VAR luna_drawer_open = false
VAR cradle_swings = 0
// the Concierge's hologram over her desk, three rings each with a gap, turned in sixths (0 to 5); its gaps lined up
VAR rings_in = 2
VAR rings_mid = 4
VAR rings_out = 1
VAR rings_solved = false
// Felix, at the cocktail bar (bar.ink): met, and what he told her of the levels
VAR met_felix = false
VAR knows_levels = false
// what she found on the old machine, Relay 7 (public/assets/terminals/relay7.json, `# terminal: relay7`): placeholders,
// until the story has the machine. Root's password found, the handover read, the night operator's notes read
VAR relay7_root = false
VAR relay7_handover = false
VAR relay7_pattern = false

-> END

// The time of day's greeting word, as the Concierge and every machine say it: at night, still "evening"
=== function good() ===
{ day_part == "night":
    ~ return "evening"
}
~ return day_part

// What a station serves at this time of day
=== function meal() ===
{ day_part:
- "morning": ~ return "Breakfast"
- "afternoon": ~ return "Lunch"
- else: ~ return "Dinner"
}
