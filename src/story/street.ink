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
"Good {good()}, guest. {meal()} is served." #station
* [Take a seat.]
    -> use
* [What is there to eat?]
    "Everything you need, and nothing you don't. A seat, a moment, and you are on your way." #station
    -> END
* [Walk on.]
    "Of course. Enjoy your {good()}, guest." #station
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
    "Your levels are excellent. Enjoy your {good()}, guest." #station
}
# closeup: off
-> END

=== guardian ===
// the civic guardian on its round: it stops for her
{ raw_view: Its voice comes from a cracked grille in its chest. }
"Good {good()}, guest. I keep this street safe, so everyone on it can enjoy the {good()}." #guardian
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

=== junction_box ===
// the street's electrical service box, right of Radio Repair: the city's, and the Concierge keeps her off it. Its door
// is bent at one corner. Kept for chapter 2, the fixer's tap into the street's lines: a blade opens it, later.
= use
"Luna. That cabinet is the city's. Authorised technicians only; please step back from it." #concierge
{ raw_view:
    The bent corner won't take a finger. A blade would.  #luna
- else:
    Fine. It's a box. #luna
}
-> END

=== junction_cable ===
// through the box's bent corner, in raw view: the city's wires tied with string, and a cable that is not the city's.
// `junction_cable_seen` is for a later chapter to pick up (the fixer's line in, or someone else's).
= look
{ raw_view:
    ~ junction_cable_seen = true
    Through the gap: the city's wires, tied off with string. And one thin black cable that isn't the city's, taped to the others, running up. #luna
- else:
    Cabling, neatly bound, as it should be.
}
-> END
