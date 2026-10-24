// Luna's flat. Included by main.ink, which declares the variables. Each object's knot has a stitch for each verb.

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
Good morning, CO. #luna
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
