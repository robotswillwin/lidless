# Chapter 0: The lobby, and the tower's lift

The ground floor of Luna's tower, Entrance 3, and the tower's lift (`lift`), used from every floor: a machine of the
city's, it calls her guest. In the opening it offers floor nine once she has read Athena's invitation, and keeps her
from the ground floor until she has been to Athena.

## Places

```yaml
- id: lobby
  new: false
  name: Entrance 3
  kind: interior
  greeting: Welcome home, Luna.
  assist: The lift will take you up to fourteen, Luna.
  arrivals:
    - id: street-door
      where: just inside the street door
    - id: lift
      where: out of the lift
  ways:
    - id: entrance
      name: To the backstreet
      to: backstreet
      arrive: door
  spots:
    - id: letterboxes
      name: Letterboxes
      look:
        concierge: "Brushed steel, every box with its glowing number. Yours is empty, as always: post comes to your eye."
        raw: Dented boxes, half of them pried open. Nobody sends paper any more. Almost nobody.
      use:
        concierge: Your box, 14-07, is empty. Your post comes to your eye.
        raw: "You open 14-07: empty. Nobody writes to you on paper."
    - id: bench
      name: Bench
      look:
        concierge: A padded bench. Nobody waits here for long.
        raw: A bench with the stuffing coming out of it.
    - id: plant
      name: Plant
      look:
        concierge: A plant, perfectly green.
        raw: Plastic, under a fur of dust.
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
    - id: stairs
      name:
        concierge: Stairs
        raw: Fire door
      look:
        concierge: A door to the stairs. Fourteen floors up. The lift is quicker.
        raw: A fire door, its glass wired and cracked. Fourteen floors of concrete stairs behind it.
      use:
        concierge: Fourteen floors of stairs. The lift is right there.
        raw: Fourteen floors of concrete. The lift is right there.
    - id: plant-room
      name:
        concierge: Plant room
        raw: Boiler room
      look:
        concierge: Pumps humming under the hall, everything in order.
        raw: Pumps and a boiler older than you, patched and still going.
    - id: first-floor
      name: First floor
      look:
        concierge: The first floor. Quiet, like every floor.
        raw: The first floor's corridor. Doormats, a plant. People live up there.
    - id: under-street
      name: Under the street
      look:
        concierge: Clean water, quiet power, everything where it should be.
        raw: Old pipes and older cables. The city's guts, patched like everything else.
```

## Script

```ink
=== lift ===
// the tower's lift: a machine of the city, it calls her "guest" (#lift). It offers every floor but the one she is on
// (scene_now, set by the game), and its doors open there. In the opening, floor nine is hers once she has read Athena's
// invitation, and before she has been to Athena she will not go down: once she has started her morning, never from an
// older game
= talk
-> use
= use
"Good {good()}, guest. Which floor?" #lift
+ {scene_now != "lobby"} [Ground floor]
    { intro_morning_started and not athena_flat_entered:
        { athena_invitation_read:
            Athena asked me to come down. I'll see her first. #luna
        - else:
            My messages first. #luna
        }
        -> END
    }
    # go: lobby/lift
    The doors open on the lobby.
    -> END
+ {scene_now != "floor9" and (athena_invitation_read or not intro_morning_started)} [Floor 9]
    # go: floor9/lift
    The doors open on the ninth floor.
    -> END
+ {scene_now != "floor14"} [Floor 14, home]
    # go: floor14/lift
    The doors open on fourteen.
    -> END
+ [Not now.]
    "Of course, guest." #lift
    -> END
```
