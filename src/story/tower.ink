// Luna's tower, Entrance 3 (scenes lobby, floor9, floor14), and its lift.

=== lift ===
// the tower's lift: a machine of the city, it calls her "guest" (#lift). It offers every floor but the one she is on
// (scene_now, set by the game), and its doors open there
= talk
-> use
= use
"Good evening, guest. Which floor?" #lift
+ {scene_now != "lobby"} [Ground floor]
    # go: lobby/lift
    The doors open on the lobby.
    -> END
+ {scene_now != "floor9"} [Floor 9]
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
