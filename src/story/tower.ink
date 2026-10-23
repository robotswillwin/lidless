// Luna's tower, Entrance 3 (scenes lobby, floor9, floor14), and its lift.

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
