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

=== radio ===
= look
{ raw_view:
    A transistor radio with its back off, a screwdriver beside it. {radio_heard: It works now. Mostly.|Weeks of work. It almost works.}
- else:
    A decorative retro speaker. It plays whatever the Concierge thinks you'd like.
}
-> END
= use
{ raw_view:
    { radio_heard:
        Static, and under it the voice again. Too faint to make out a word.
    - else:
        { carried has valve:
            -> use_valve
        - else:
            Static. One valve's dead, the one on the left. It needs another.
        }
    }
- else:
    Soft music, chosen for you.
}
-> END
= use_valve
{ radio_heard:
    It already has one.
    -> END
}
You prise out the dead valve and press the new one in. # wait: 0.4
~ carried -= valve
~ radio_heard = true
It warms. Static, a long hiss, and then, under it, almost, a voice. Not the Concierge's. #luna
-> END

=== photo ===
// a projection: in raw view its frame is empty (decision 31). What it shows in the Concierge's view is still the
// director's to decide; nothing is built on it
= look
{ raw_view:
    An empty frame. The picture was only ever the Concierge's.
- else:
    You, alone, smiling at something out of frame.
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
