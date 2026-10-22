// The main street, outside the radio shop. Included by main.ink, which declares the variables.

=== fixer ===
{ has_raw: -> after }
{ fixer > 1: He looks up this time. | The fixer doesn't look up from the soldering iron. }
"Shop's closed. Unless you're here about a radio." #fixer
- (questions)
* [I'm not here about a radio.]
    "No. Nobody is, anymore." #fixer
    He sets the iron down and turns on his stool, slowly, like his back has opinions.
    -> offer
* [What's wrong with all these radios?]
    "Nothing. They work fine. It's the stations that went quiet." #fixer
    -> questions
* [Leave him to it.]
    -> END

= offer
"You've got that look. Like you're trying to see past it." #fixer
He taps his visor, the old kind, with a worn switch on its side.
"I can switch yours on. Raw view: what's actually out there. It's legal. The Concierge will know. It just won't recommend it." #fixer
- (ask)
* [What does it cost?]
    "A favour. I'll tell you which one when I need it." #fixer
    -> ask
* [What will I see?]
    "Less than you'd like. More than you'll forget." #fixer
    -> ask
* [Do it.]
    -> install
* [Not tonight.]
    "The offer stands. The street isn't getting any prettier." #fixer
    -> END

= install
He plugs an old diagnostic box into your eyepiece and talks to it in numbers. A click behind your eye, then nothing.
"Done. Press it when you want to see. It'll tell you that's unwise. It tells everyone." #fixer
~ has_raw = true
~ favours_owed = favours_owed + 1
-> END

= after
"Seen enough yet?" #fixer
- (loop)
+ [You said I owe you a favour.]
    "You do. When I need it, you'll know." #fixer
    -> loop
+ [Never mind.]
    -> END

= use_parcel
{ parcel_delivered:
    "You already brought it." #fixer
    -> END
}
"Delivery 4471." He weighs it in his hand, doesn't open it, and sets it down on the bench beside him. #fixer
~ carried -= parcel
~ parcel_delivered = true
"Tell them it came." #fixer
-> END

=== station ===
// the main street's nutrition and health station: its voice, out loud (#station: like every machine but the
// Concierge in her eye, it calls her "guest"), and taking a seat
= talk
{ raw_view: In raw view its panel is a grille, and the voice comes from behind it. }
"Good evening, guest. Dinner is served." #station
* [Take a seat.]
    -> use
* [What is for dinner?]
    "Everything you need, and nothing you don't. A seat, a moment, and you are on your way." #station
    -> END
* [Walk on.]
    "Of course. Enjoy your evening, guest." #station
    -> END
= use
// she does not need it often: once in a while, by the story's count of her comings and goings
{ arrivals - fed_at < 6:
    I don't need it right now. #luna
    -> END
}
~ fed_at = arrivals
# closeup: station
{ raw_view:
    The cuff closes round your wrist. Cold metal, then a slow warmth up the arm.
- else:
    "Please rest your wrist, guest. This will only take a moment." #station
}
# wait: 0.8
{ raw_view:
    A pump ticks. A finger's width of the cartridge goes. The cuff lets go.
- else:
    "Your levels are excellent. Enjoy your evening, guest." #station
}
# closeup: off
-> END

=== guardian ===
// the civic guardian on its round: it stops for her
{ raw_view: Its voice comes from a cracked grille in its chest. }
"Good evening, guest. I keep this street safe, so everyone on it can enjoy the evening." #guardian
- (ask)
* [Safe from what?]
    "Accidents, mostly. A loose stone, a step in the dark. Nothing on this street is left to chance." #guardian
    -> ask
* [And if something seems wrong?]
    "Then tell me. Anything odd, anyone in trouble. I will see that the Concierge knows." #guardian
    -> ask
+ [Thank you.]
    "Have a pleasant evening, guest." #guardian
    -> END

=== felix ===
// Felix, outside the cocktail bar: a Level 4 guest, as integrated as anyone she has met, and happy for it (the bible
// v0.4, 2.4: an articulate, sympathetic voice). He tells her what the levels are: his ladder is a proposal until the
// director settles it
{ not met_felix:
    { raw_view: He turns both lenses on you. Something in his helmet ticks. }
    "One eye. Level one, am I right? I remember level one." #felix
    ~ met_felix = true
- else:
    "Level one! Still just the one eye?" #felix
}
- (topics)
* [What level are you?]
    "Four. My body, my feelings, my thoughts: it has all of me. It pays very well." #felix
    -> topics
+ [What are the levels?]
    "One: a roof, a station, a doctor, a few credits. It sees what any camera sees, and not a thought more." #felix
    "Two: your body. Heartbeat, sleep, blood. More credits, and it looks after you before you know you're ill." #felix
    "Three: your feelings. It calms you before you know you're upset." #felix
    "Four: your thoughts. It knows what I want before I do. You can't imagine how restful that is." #felix
    ~ knows_levels = true
    ** [Doesn't that frighten you?]
        "I was lonely for thirty years. Now something hears every thought I have, and never tires of me." #felix
        He raises his glass to nobody in particular.
    ** [And above four?]
        "Above four? I couldn't tell you. You don't see them out at night." #felix
    ** [I see.]
    -- -> topics
* [What are you wearing?]
    { raw_view: A grey suit, frayed at the cuffs, cables down his back. }
    "Light, all of it. It changes with my mood, and I'm always in a good one." #felix
    -> topics
+ [Enjoy your evening.]
    "I always do." #felix
    -> END
