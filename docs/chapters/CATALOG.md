# What the game has

Generated from the game by `npm run chapter -- --catalog`: do not edit it by hand. A chapter names these ids to use
what is there already; anything new goes in the chapter itself (docs/story/LIDLESS_Chapter_Format_v1_2026-10-22.md).
Names are the Concierge's / raw view's where they differ.

## Places

### athena-bench: Athena's workbench (raw view: Her workbench)

A close-up of `athena-home`, gone into from its spot that zooms to it.

| Spot | Name | Story | Notes |
| --- | --- | --- | --- |
| `tools` | Soldering iron |  |  |
| `radio` | Radio | `athena_radio` |  |
| `gap` | Workbench | `athena_gap` |  |
| `cable` | Cable | `athena_gap` |  |
| `lamp` | Lamp | `athena_lamp` |  |
| `scope` | Oscilloscope | `athena_scope` |  |
| `drawer` | Drawer | `athena_drawer` | when `not athena_drawer_open` |
| `drawer-open` | Drawer | `athena_drawer` | when `athena_drawer_open` |
| `valves` | Valves | `athena_valves` | when `athena_drawer_open` |
| `wire` | Wire |  | when `athena_drawer_open` |
| `letters` | Letters | `athena_letters` | when `athena_drawer_open` |
| `note` | Note | `athenas_note` | item `athena_note` |
| `receipt` | Receipt | `athena_receipt` | item `athena_repair_slip` |
| `wave-knob` | Shape knob | `athena_wave_knob` |  |
| `speed-knob` | Speed knob | `athena_speed_knob` |  |

### athena-home: Flat 9-07 (raw view: Athena's flat)

interior, a privacy zone. Arrivals: `door`.

| Spot | Name | Story | Notes |
| --- | --- | --- | --- |
| `door` | Door |  | to `floor9/from-athena` |
| `coats` | Coat stand |  |  |
| `shower` | Shower |  |  |
| `basin` | Basin |  |  |
| `kitchen` | Kitchenette / Kitchen |  |  |
| `window` | Window |  |  |
| `books` | Books |  |  |
| `bed` | Bed |  |  |
| `armchair` | Armchair / Her chair |  |  |
| `records` | Record player / Records |  |  |
| `lamp` | Floor lamp / Lamp |  |  |
| `shelf` | Radios |  |  |
| `bench` | Workbench |  | close-up `athena-bench` |
| `timetable` | Timetable | `athena_timetable` | item `athena_patrol_sheet` |

### backstreet: Backstreet

exterior. Arrivals: `from-street`, `door`.

| Spot | Name | Story | Notes |
| --- | --- | --- | --- |
| `store` | Concierge Store 24 / Store 24 |  |  |
| `entrance` | Entrance 3 |  | to `lobby/street-door` |
| `box` | Concierge City panel / Fuse box |  |  |
| `to-street` | To the main street |  | to `street/from-backstreet` |
| `repair-bot` | Maintenance unit / Repair bot |  |  |

### bar: Cocktail bar (raw view: Bar)

interior. Arrivals: `door`.

| Spot | Name | Story | Notes |
| --- | --- | --- | --- |
| `door` | To the main street |  | to `street/from-bar` |
| `restaurant` | Restaurant |  |  |
| `cellar` | Cellar |  |  |
| `under-street` | Under the street |  |  |
| `booth` | Booth |  |  |
| `prices` | Tonight's list / Price board | `bar_prices` |  |
| `bottles` | Bottles |  |  |
| `counter` | Cocktail bar / Bar | `bar_counter` |  |
| `machine` | Drinks machine / Tap machine | `bar_order` (talk) |  |
| `back-door` | Staff door / Back door |  |  |
| `felix` | Man in light / Man in a helmet | `felix` (talk) | when `not met_felix` |
| `felix-met` | Felix | `felix` (talk) | when `met_felix` |

### floor14: Floor 14

interior. Arrivals: `lift`, `her-door`.

| Spot | Name | Story | Notes |
| --- | --- | --- | --- |
| `lift` | Lift | `lift` |  |
| `door-1` | Flat 14-05 / 14-05 |  |  |
| `door-2` | Flat 14-06 / 14-06 |  |  |
| `her-door` | Your door / My door |  | to `home/door` |
| `plant` | Plant |  |  |
| `fire-box` | Fire box / Fire hose |  |  |
| `hatch` | Recycling / Rubbish chute |  |  |
| `window` | Window |  |  |
| `floors` | Other floors / Above and below |  |  |

### floor9: Floor 9

interior. Arrivals: `lift`, `from-athena`.

| Spot | Name | Story | Notes |
| --- | --- | --- | --- |
| `lift` | Lift | `lift` |  |
| `door-1` | Flat 9-05 / 9-05 |  |  |
| `door-2` | Flat 9-06 / 9-06 |  |  |
| `door-3` | Flat 9-07 / 9-07 | `athena_door` |  |
| `bell` | Doorbell | `athena_bell` |  |
| `plant` | Plant |  |  |
| `window` | Window |  |  |
| `floors` | Other floors / Above and below |  |  |

### home: Luna's home

interior, a home (she can call the Concierge from here). Arrivals: `door`, `bed`.

| Spot | Name | Story | Notes |
| --- | --- | --- | --- |
| `door` | To the corridor |  | to `floor14/her-door` |
| `coat` | Red coat / Raincoat |  |  |
| `shower` | Bathroom / Wash unit |  | wear `nude` |
| `mirror` | Mirror |  |  |
| `plant` | Plant |  |  |
| `bed` | Bed |  |  |
| `window` | Window |  |  |
| `book` | Book |  |  |
| `desk` | Your desk / My desk |  | close-up `home-desk` |
| `screen` | The Concierge's screen / Wall screen |  |  |
| `water` | Water / Water tap |  |  |

### home-desk: Your desk (raw view: My desk)

A close-up of `home`, gone into from its spot that zooms to it.

| Spot | Name | Story | Notes |
| --- | --- | --- | --- |
| `photo` | Photograph | `photo` |  |
| `pencils` | Pencils |  |  |
| `lower-drawers` | Drawers |  |  |
| `drawer` | Drawer / Top drawer | `luna_drawer` | when `not luna_drawer_open` |
| `drawer-open` | Drawer / Top drawer | `luna_drawer` | when `luna_drawer_open` |
| `torch` | Torch |  | when `luna_drawer_open` |
| `tape` | Tape |  | when `luna_drawer_open` |
| `fuses` | Fuses |  | when `luna_drawer_open` |
| `screwdrivers` | Screwdrivers |  | when `luna_drawer_open` |
| `buttons` | Buttons |  | when `luna_drawer_open` |
| `notebook` | Notebook | `notebook` | item `paper_notebook` |
| `parcel` | Parcel |  | item `parcel` |
| `cradle` | Newton's cradle | `luna_cradle` |  |
| `ring-outer` | Outer ring | `hologram_outer` | concierge view only |
| `ring-middle` | Middle ring | `hologram_middle` | concierge view only |
| `ring-inner` | Inner ring | `hologram_inner` | concierge view only |

### lobby: Entrance 3

interior. Arrivals: `street-door`, `lift`.

| Spot | Name | Story | Notes |
| --- | --- | --- | --- |
| `entrance` | To the backstreet |  | to `backstreet/door` |
| `letterboxes` | Letterboxes |  |  |
| `bench` | Bench |  |  |
| `plant` | Plant |  |  |
| `lift` | Lift | `lift` |  |
| `stairs` | Stairs / Fire door |  |  |
| `plant-room` | Plant room / Boiler room |  |  |
| `first-floor` | First floor |  |  |
| `under-street` | Under the street |  |  |

### radio: Radio repair

interior. Arrivals: `door`.

| Spot | Name | Story | Notes |
| --- | --- | --- | --- |
| `door` | To the main street |  | to `street/from-radio` |
| `back-door` | Back room / Back door |  |  |
| `shelves` | Bookshelf / Shelves |  |  |
| `sofa` | Leather sofa / Sofa |  |  |
| `corkboard` | City map / Corkboard |  |  |
| `radios` | Radios |  |  |
| `pegboard` | Tools / Pegboard |  |  |
| `monitor` | Monitor |  |  |
| `visor` | Visor / Old visor |  |  |
| `side-door` | Staff door / Side door |  |  |
| `fixer` | The fixer | `fixer` |  |
| `parcel` | Delivery / Your parcel |  | when `parcel_delivered` |
| `clock` | Clock |  |  |

### restroom: Public restroom

interior, a privacy zone. Arrivals: `door`.

| Spot | Name | Story | Notes |
| --- | --- | --- | --- |
| `door` | To the street / Street door |  | to `street/from-restroom` |
| `bench` | Bench |  |  |
| `privacy-mark` | Privacy mark / Closed eye |  |  |
| `basins` | Basins |  |  |
| `stalls` | Cubicles |  |  |
| `dryer` | Towels and dryer / Towel box and dryer |  |  |
| `corner` | Plant / Mop and bucket |  |  |
| `window` | Window |  |  |

### street: Main street

exterior. Arrivals: `start`, `from-backstreet`, `from-radio`, `from-restroom`, `from-bar`.

| Spot | Name | Story | Notes |
| --- | --- | --- | --- |
| `to-backstreet` | To the backstreet |  | to `backstreet/from-street` |
| `sky` | The Concierge / Poster |  |  |
| `moon` | The moon |  | raw view only |
| `sign` | Shop sign / Over the door |  |  |
| `window` | Shop window |  |  |
| `radio-door` | Radio repair |  | to `radio/door` |
| `dock` | Woman in red / Woman at the station |  | when `station_seat == "woman"` |
| `station-man` | Gentleman / Old man |  | when `station_seat == "man"` |
| `station-worker` | Courier / Young courier |  | when `station_seat == "worker"` |
| `kiosk` | Nutrition station / Feeding station | `station` |  |
| `cocktail-bar` | Cocktail bar / Bar |  |  |
| `restaurant` | Restaurant |  |  |
| `tree` | Tree / Dead tree |  |  |
| `bench` | Bench |  |  |
| `notices` | City notices / Missing |  |  |
| `restroom-door` | Rest rooms / Public toilets |  | to `restroom/door` |
| `corner-shop` | Corner shop |  |  |
| `guardian` | Civic guardian / Guard unit | `guardian` (talk) | moves |
| `bar-door` | Bar entrance / Bar door |  | to `bar/door` |

## People who speak

Speaker tags in the story so far: `#concierge`, `#door`, `#felix`, `#fixer`, `#guardian`, `#lift`, `#luna`, `#station`, `#tap`. A line without a tag is narration.

## Things she can carry

| Thing | Name | Note |
| --- | --- | --- |
| `parcel` | Parcel | Delivery 4471 · to Radio Repair, by 22:00 / for the radio man. don't open it. |
| `matches` | Matches | Open flame · not permitted indoors / three left. real fire. it hates that. |
| `cigarettes` | Cigarettes | Combustion product · harmful to your wellbeing / two left. a week's credits, these. |
| `map` | Map | Hand-drawn · information out of date / drawn by hand. no names on it. |
| `paper_notebook` | Notebook | Paper notebook · protected use / private paper. never on co-net. |
| `athena_note` | Note | Personal paper note / athena wrote this in a hurry. |
| `athena_patrol_sheet` | Timetable | Personal timing observations / repeating gaps. what was she watching? |
| `athena_repair_slip` | Receipt | Radio Repair · service receipt / portable computer. waiting at radio repair? |

## The story's state

| Variable | Starts as | What it is |
| --- | --- | --- |
| `raw_view` | `false` | set by the game when a conversation starts and at every choice: true while Luna sees raw view |
| `has_raw` | `false` | read by the game: true once the fixer has switched on raw view in her eyepiece, which unlocks the view switch |
| `favours_owed` | `0` | favours she owes the fixer, for raw view among them: he names each when he needs it |
| `conditions` | `""` | read by the game: what the city is like now, a variant the scenes have ("rain", "fog", "outage"); "" as they are |
| `credits` | `312` | Her credits: digital, her allowance, on her account. The Concierge's greeting shows them in its view |
| `care_level` | `1` | read by the game: her connection level, 0 to 5 (the director's decision 18): 1 is Basic Care. Its card shows it |
| `arrivals` | `0` | set by the game: how many times she has gone from one scene to another, all told (a clock the story counts by) |
| `scene_now` | `""` | set by the game: the scene she is in now (its id) |
| `day_part` | `"evening"` | set by the game: the part of the day by its clock, "morning", "afternoon", "evening" or "night" (the Concierge's view is evening whatever it says) |
| `fed_at` | `-100` | when she last fed at a nutrition station (arrivals then): she does not need to again for a while |
| `station_seat` | `"woman"` | who sits at the main street's station: the street turns it each time she comes back (its scene file's `rotate`) |
| `carried` | `(matches, cigarettes, map)` | The things she can carry: public/assets/items.json says how each looks and what it is called. What she carries now, and what she has picked up anywhere, which is gone from where it was (the game adds to both as she takes a thing) |
| `taken` | `()` | The things she can carry: public/assets/items.json says how each looks and what it is called. What she carries now, and what she has picked up anywhere, which is gone from where it was (the game adds to both as she takes a thing) |
| `intro_morning_started` | `false` | The opening, "The Invitation" (docs/chapters/00-the-errand): her morning, Athena's invitation, the visit to 9-07. The waking ran and she is standing at home; she read the delivery message; she read Athena's (floor nine is hers to go to); she rang Athena's bell; she went into Athena's flat; read Athena's note; looked at the timetable; looked at the receipt |
| `intro_messages_read` | `false` | The opening, "The Invitation" (docs/chapters/00-the-errand): her morning, Athena's invitation, the visit to 9-07. The waking ran and she is standing at home; she read the delivery message; she read Athena's (floor nine is hers to go to); she rang Athena's bell; she went into Athena's flat; read Athena's note; looked at the timetable; looked at the receipt |
| `athena_invitation_read` | `false` | The opening, "The Invitation" (docs/chapters/00-the-errand): her morning, Athena's invitation, the visit to 9-07. The waking ran and she is standing at home; she read the delivery message; she read Athena's (floor nine is hers to go to); she rang Athena's bell; she went into Athena's flat; read Athena's note; looked at the timetable; looked at the receipt |
| `athena_bell_rung` | `false` | The opening, "The Invitation" (docs/chapters/00-the-errand): her morning, Athena's invitation, the visit to 9-07. The waking ran and she is standing at home; she read the delivery message; she read Athena's (floor nine is hers to go to); she rang Athena's bell; she went into Athena's flat; read Athena's note; looked at the timetable; looked at the receipt |
| `athena_flat_entered` | `false` | The opening, "The Invitation" (docs/chapters/00-the-errand): her morning, Athena's invitation, the visit to 9-07. The waking ran and she is standing at home; she read the delivery message; she read Athena's (floor nine is hers to go to); she rang Athena's bell; she went into Athena's flat; read Athena's note; looked at the timetable; looked at the receipt |
| `athena_note_read` | `false` | The opening, "The Invitation" (docs/chapters/00-the-errand): her morning, Athena's invitation, the visit to 9-07. The waking ran and she is standing at home; she read the delivery message; she read Athena's (floor nine is hers to go to); she rang Athena's bell; she went into Athena's flat; read Athena's note; looked at the timetable; looked at the receipt |
| `athena_patrol_sheet_seen` | `false` | The opening, "The Invitation" (docs/chapters/00-the-errand): her morning, Athena's invitation, the visit to 9-07. The waking ran and she is standing at home; she read the delivery message; she read Athena's (floor nine is hers to go to); she rang Athena's bell; she went into Athena's flat; read Athena's note; looked at the timetable; looked at the receipt |
| `athena_repair_slip_seen` | `false` | The opening, "The Invitation" (docs/chapters/00-the-errand): her morning, Athena's invitation, the visit to 9-07. The waking ran and she is standing at home; she read the delivery message; she read Athena's (floor nine is hers to go to); she rang Athena's bell; she went into Athena's flat; read Athena's note; looked at the timetable; looked at the receipt |
| `athena_drawer_open` | `false` | her workbench, up close (scene athena-bench): its drawer open |
| `athena_scope_wave` | `"sine"` | her oscilloscope on it: the shape of its line and its speed, as its two knobs are turned ("sine", "square", "triangle", "saw"; "slow", "medium", "fast") |
| `athena_scope_speed` | `"slow"` | her oscilloscope on it: the shape of its line and its speed, as its two knobs are turned ("sine", "square", "triangle", "saw"; "slow", "medium", "fast") |
| `athena_report` | `"not_asked"` | what she told the Concierge leaving Athena's flat: "not_asked", then "covered", as Athena asked (the opening does not branch here: decision 40). Her word, not a fact about Athena |
| `prologue_complete` | `false` | what she told the Concierge leaving Athena's flat: "not_asked", then "covered", as Athena asked (the opening does not branch here: decision 40). Her word, not a fact about Athena |
| `parcel_delivered` | `false` | the errand the game begins with: the parcel on her desk, to the radio repair by ten |
| `luna_drawer_open` | `false` | her desk, up close (scene home-desk): its top drawer open; how many times she has set its Newton's cradle swinging |
| `cradle_swings` | `0` | her desk, up close (scene home-desk): its top drawer open; how many times she has set its Newton's cradle swinging |
| `rings_in` | `2` | the Concierge's hologram over her desk, three rings each with a gap, turned in sixths (0 to 5); its gaps lined up |
| `rings_mid` | `4` | the Concierge's hologram over her desk, three rings each with a gap, turned in sixths (0 to 5); its gaps lined up |
| `rings_out` | `1` | the Concierge's hologram over her desk, three rings each with a gap, turned in sixths (0 to 5); its gaps lined up |
| `rings_solved` | `false` | the Concierge's hologram over her desk, three rings each with a gap, turned in sixths (0 to 5); its gaps lined up |
| `met_felix` | `false` | Felix, at the cocktail bar (bar.ink): met, and what he told her of the levels |
| `knows_levels` | `false` | Felix, at the cocktail bar (bar.ink): met, and what he told her of the levels |
| `relay7_root` | `false` | what she found on the old machine, Relay 7 (public/assets/terminals/relay7.json, `# terminal: relay7`): placeholders, until the story has the machine. Root's password found, the handover read, the night operator's notes read |
| `relay7_handover` | `false` | what she found on the old machine, Relay 7 (public/assets/terminals/relay7.json, `# terminal: relay7`): placeholders, until the story has the machine. Root's password found, the handover read, the night operator's notes read |
| `relay7_pattern` | `false` | what she found on the old machine, Relay 7 (public/assets/terminals/relay7.json, `# terminal: relay7`): placeholders, until the story has the machine. Root's password found, the handover read, the night operator's notes read |

Lists: `Things` (parcel, matches, cigarettes, map, paper_notebook, athena_note, athena_patrol_sheet, athena_repair_slip).

## Knots

`fixer`, `station`, `guardian`, `opening`, `concierge_home`, `photo`, `luna_drawer`, `notebook`, `luna_cradle`, `hologram_inner`, `hologram_middle`, `hologram_outer`, `rings_turned`, `rings_again`, `concierge`, `bar_prices`, `bar_counter`, `bar_order`, `felix`, `lift`, `athena_door`, `athena_bell`, `athena_asked`, `athena_bench`, `athena_gap`, `athena_radio`, `athena_lamp`, `athena_drawer`, `athena_valves`, `athena_letters`, `athenas_note`, `athena_timetable`, `athena_receipt`, `athena_scope`, `athena_wave_knob`, `athena_speed_knob`, `good`, `meal`.

Functions: `good()` is the time of day's greeting word ("morning", "afternoon", "evening"; at night still "evening"), as in `"Good {good()}, guest."`; `meal()` is what a station serves now ("Breakfast", "Lunch", "Dinner").

## Outfits

`coat` (Coat), `clothes` (Outdoor clothes), `underwear` (Underwear), `nude` (Undressed), `party` (Party dress).

## Messages

In her inbox, by id: `delivery-4471`, `athena-invitation`.

## Close-ups and machines

Close-ups: `athena-note` (words: `# read:`), `athena-receipt` (words: `# read:`), `athena-timetable` (words: `# read:`), `station`, `waking-closed`, `waking-open`. Machines: `relay7`.

## Journal and notebook pages

Journal: `objectives` (Objectives), `people` (People), `evidence` (Evidence). Notebook: `seen` (what I saw), `think` (what I think), `questions` (ask it (carefully)).
