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

=== kiosk ===
{ raw_view: In raw view the screen is dark, but the voice still comes, from everywhere at once. }
"Good evening, guest. Dinner is served." #concierge
* [Ask what's for dinner.]
    "Everything you need, and nothing you don't. Please take a seat and rest your wrist on the armrest." #concierge
    -> END
* [Walk on.]
    "Of course. Enjoy your evening, guest." #concierge
    -> END
