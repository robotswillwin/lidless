// The main street, outside the radio shop. Included by main.ink, which declares the variables.

=== fixer ===
{ has_raw: -> after }
{ fixer > 1: He looks up this time. | The fixer doesn't look up from the soldering iron. }
"Shop's closed. Unless you're here about a radio." #fixer
- (talk)
* [I'm not here about a radio.]
    "No. Nobody is, anymore." #fixer
    He sets the iron down and turns on his stool, slowly, like his back has opinions.
    -> offer
* [What's wrong with all these radios?]
    "Nothing. They work fine. It's the stations that went quiet." #fixer
    -> talk
* [Leave him to it.]
    -> END

= offer
"You've got that look. Like you're trying to see past it." #fixer
He taps his temple, just below the visor. A thin scar, and under the skin a bump the size of a grain of rice.
"I can open yours. Not the visor. You. You'd see what's actually out there. The Concierge won't know, as long as you don't stare." #fixer
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
He works fast, with tools older than you: no cable, no code. A needle at your temple, a cold thread sliding along the nerve, then nothing.
"Done. It's not in the chip, it's in you, so there's nothing for them to find. Press it when you want to see. Don't keep it on too long. They notice people who stare." #fixer
~ has_raw = true
~ favours_owed = favours_owed + 1
-> END

= after
"Seen enough yet?" #fixer
- (loop)
+ [Who are the people on the walkway?]
    "What people?" #fixer
    He almost smiles.
    -> loop
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
"Delivery 4471." He weighs it in his hand, doesn't open it, and puts it under the counter. #fixer
~ carried -= parcel
~ parcel_delivered = true
"Tell them it came." #fixer
-> END

=== kiosk ===
{ raw_view: In your opened eye the screen is dark, but the voice still comes, from everywhere at once. }
"Good evening, guest. Dinner is served." #concierge
* [Ask what's for dinner.]
    "Everything you need, and nothing you don't. Please rest your wrist in the cradle." #concierge
    -> END
* [Walk on.]
    "Of course. Enjoy your evening, guest." #concierge
    -> END
