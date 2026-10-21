// Luna's flat. Included by main.ink, which declares the variables. Each object's knot has a stitch for each verb.

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
= look
{ raw_view:
    You, and the one you're looking for, an arm round your shoulders. The Concierge shows you alone.
- else:
    You, alone, smiling at something out of frame.
}
-> END
