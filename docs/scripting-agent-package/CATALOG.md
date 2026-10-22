# What the game has

Generated from the game by `npm run chapter -- --catalog`: do not edit it by hand. A chapter names these ids to use
what is there already; anything new goes in the chapter itself (docs/story/LIDLESS_Chapter_Format_v1_2026-10-22.md).
Names are the Concierge's / raw view's where they differ.

## Places

### backstreet: Backstreet

exterior. Arrivals: `from-street`, `door`.

| Spot | Name | Story | Notes |
| --- | --- | --- | --- |
| `store` | Concierge Store 24 / Store 24 |  |  |
| `entrance` | Entrance 3 |  | to `home/door` |
| `box` | Concierge City panel / Fuse box |  |  |
| `to-street` | To the main street |  | to `street/from-backstreet` |
| `repair-bot` | Maintenance unit / Repair bot |  |  |

### home: Luna's home

interior, a privacy zone. Arrivals: `door`.

| Spot | Name | Story | Notes |
| --- | --- | --- | --- |
| `door` | Door |  | to `backstreet/door` |
| `coat` | Red coat / Raincoat |  |  |
| `shower` | Bathroom / Wash unit |  | wear `nude` |
| `mirror` | Mirror |  |  |
| `plant` | Plant |  |  |
| `bed` | Bed |  |  |
| `window` | Window |  |  |
| `book` | Book |  |  |
| `photo` | Photograph | `photo` |  |
| `screen` | The Concierge's screen / Wall screen |  |  |
| `terminal` | Terminal |  |  |
| `valve` | Curio / Radio valve |  | item `valve` |
| `radio` | Retro speaker / Transistor radio | `radio` |  |
| `parcel` | Parcel |  | item `parcel` |
| `water` | Water / Water tap |  |  |

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

exterior. Arrivals: `start`, `from-backstreet`, `from-radio`, `from-restroom`.

| Spot | Name | Story | Notes |
| --- | --- | --- | --- |
| `to-backstreet` | To the backstreet |  | to `backstreet/from-street` |
| `sky` | The Concierge / Poster |  |  |
| `moon` | The moon |  | raw view only |
| `sign` | Shop sign |  |  |
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

## People who speak

Speaker tags in the story so far: `#concierge`, `#fixer`, `#guardian`, `#luna`, `#station`. A line without a tag is narration.

## Things she can carry

| Thing | Name | Note |
| --- | --- | --- |
| `parcel` | Parcel | Delivery 4471 · to Radio Repair, by 22:00 / for the radio man. don't open it. |
| `matches` | Matches | Open flame · not permitted indoors / three left. real fire. it hates that. |
| `cigarettes` | Cigarettes | Combustion product · harmful to your wellbeing / two left. a week's credits, these. |
| `map` | Map | Hand-drawn · information out of date / drawn by hand. no names on it. |
| `valve` | Valve | Vintage · decorative curio / for the radio. the left one's dead. |

## The story's state

| Variable | Starts as | What it is |
| --- | --- | --- |
| `raw_view` | `false` | set by the game when a conversation starts and at every choice: true while Luna sees raw view |
| `has_raw` | `false` | read by the game: true once the fixer has switched on raw view in her eyepiece, which unlocks the view switch |
| `favours_owed` | `0` | favours she owes the fixer, for raw view among them: he names each when he needs it |
| `conditions` | `""` | read by the game: what the city is like now, a variant the scenes have ("rain", "fog", "outage"); "" as they are |
| `credits` | `312` | Her credits: digital, her allowance, on her account. The Concierge's greeting shows them in its view |
| `arrivals` | `0` | set by the game: how many times she has gone from one scene to another, all told (a clock the story counts by) |
| `fed_at` | `-100` | when she last fed at a nutrition station (arrivals then): she does not need to again for a while |
| `station_seat` | `"woman"` | who sits at the main street's station: the street turns it each time she comes back (its scene file's `rotate`) |
| `carried` | `(matches, cigarettes, map)` | The things she can carry: public/assets/items.json says how each looks and what it is called. What she carries now, and what she has picked up anywhere, which is gone from where it was (the game adds to both as she takes a thing) |
| `taken` | `()` | The things she can carry: public/assets/items.json says how each looks and what it is called. What she carries now, and what she has picked up anywhere, which is gone from where it was (the game adds to both as she takes a thing) |
| `parcel_delivered` | `false` | the errand the game begins with: the parcel on her desk, to the radio repair by ten |
| `radio_heard` | `false` | her radio, mended: what she heard under the static |
| `relay7_root` | `false` | what she found on the old machine, Relay 7 (public/assets/terminals/relay7.json, `# terminal: relay7`): placeholders, until the story has the machine. Root's password found, the handover read, the night operator's notes read |
| `relay7_handover` | `false` | what she found on the old machine, Relay 7 (public/assets/terminals/relay7.json, `# terminal: relay7`): placeholders, until the story has the machine. Root's password found, the handover read, the night operator's notes read |
| `relay7_pattern` | `false` | what she found on the old machine, Relay 7 (public/assets/terminals/relay7.json, `# terminal: relay7`): placeholders, until the story has the machine. Root's password found, the handover read, the night operator's notes read |

Lists: `Things` (parcel, matches, cigarettes, map, valve).

## Knots

`fixer`, `station`, `guardian`, `radio`, `photo`, `concierge`.

## Outfits

`coat` (Coat), `clothes` (Outdoor clothes), `underwear` (Underwear), `nude` (Undressed), `party` (Party dress).

## Close-ups and machines

Close-ups: `station`. Machines: `relay7`.

## Journal and notebook pages

Journal: `objectives` (Objectives), `people` (People), `evidence` (Evidence). Notebook: `seen` (what I saw), `think` (what I think), `questions` (ask it (carefully)).
