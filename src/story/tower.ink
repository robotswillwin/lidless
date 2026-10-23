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
// flat 9-07, Athena's, on floor nine: her invitation (a message, read) lets Luna in. The door's reader is a machine of
// the city's, so it says "guest" (#door); the Concierge knows the visit is allowed, and cannot see in
= look
{ athena_invitation_read:
    9-07. Athena's. No marks on the door, nothing forced.
- else:
    9-07. The same door as yours, five floors down.
}
-> END
= talk
You knock. Nobody comes.
{ athena_invitation_read:
    She said not to knock. #luna
}
-> END
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
"Welcome, guest. The resident has let you in." #door
~ athena_flat_entered = true
# go: athena-home/door
The door opens on Athena's flat.
-> END

=== athena_asked ===
// as she steps out of Athena's flat the Concierge asks: it saw her go in and come out, not what she saw in there. What
// she answers is her word, not a fact (athena_report)
"Was Athena at home, Luna?" #concierge
+ [Yes. Her music was loud.]
    ~ athena_report = "covered"
    "I'm glad she's well. Thank you, Luna." #concierge
+ [No. She wasn't there.]
    ~ athena_report = "truthful"
    "Thank you for telling me, Luna. I'm sure she'll be in touch." #concierge
+ [I'd rather not say.]
    ~ athena_report = "private"
    "Of course. What happens at home is yours, Luna." #concierge
- ~ prologue_complete = true
-> END
