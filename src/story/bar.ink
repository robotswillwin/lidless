// The cocktail bar on the main street (scenes/bar): real drinks at real prices, a machine that pours them, and Felix,
// who can afford anything.

=== bar_prices ===
// the price board: real drinks, at real prices. Her allowance is her credits, and not even a beer is in reach of it
= look
{ raw_view:
    A cracked blackboard, the prices chalked in by hand. Beer, 450. Gin, 680. Whisky, twelve years old, 1,400.
- else:
    The list glows gold over the booth. A real beer, 450 credits. A gin and tonic, 680. A twelve-year whisky, 1,400.
}
Four hundred and fifty. For a beer. I've got {credits} to last the week. #luna
{ not raw_view:
    "Real hops, Luna, grown in real soil. A rare pleasure, for a rare evening." #concierge
}
-> END

=== bar_counter ===
// the counter: looking at it, and ordering at it (bar_order, the drinks machine's)
= look
{ raw_view:
    Dark wood, the zinc on top dented and wiped thin. Three stools, one of them wobbling.
- else:
    Polished wood under a brass top, a warm light along its foot.
}
-> END
= use
-> bar_order

=== bar_order ===
// ordering: the drinks machine pours (#tap, a machine of the city: it calls her "guest"). She asks the prices and
// cannot afford even a beer; once she has met him, Felix pays (Level 4 pays very well)
"Good evening, guest. What can I pour for you?" #tap
* [How much is a beer?]
    "Four hundred and fifty credits, guest. Real hops, grown in soil." #tap
    Four hundred and fifty. That's more than I've got. #luna
* [What's the cheapest thing you have?]
    "Water is complimentary, guest." #tap
    Of course it is. #luna
* [Nothing, thanks.]
    "Of course, guest." #tap
    -> END
- (after)
* {met_felix} [Felix?]
    "Put it on mine. Level four, remember? It pays very well." #felix
    "Charged to the gentleman, guest. Enjoy." #tap
    It pours you a beer: cold, bitter and real. You make it last.
    -> END
+ [Maybe another time.]
    "Of course, guest." #tap
    -> END

=== felix ===
// Felix, at the cocktail bar: a Level 4 guest, Deep Integration, as integrated as anyone she has met, and happy
// for it (the bible v0.4, 2.4: an articulate, sympathetic voice). He tells her the levels, as the director's concept
// sheet has them (decision 18); what each one trades is still to be announced, so he does not say
{ not met_felix:
    { raw_view: He turns both lenses on you. Amber fluid ticks along the tubes in his neck. }
    "One eye. Level one, am I right? I remember level one." #felix
    ~ met_felix = true
- else:
    "Level one! Still just the one eye?" #felix
}
- (topics)
* [What level are you?]
    "Four. Deep Integration. Mostly mediated, they call it, and it pays very well." #felix
    -> topics
+ [What are the levels?]
    "Nought: the unregistered. No Care at all. It marks them in red, so you know." #felix
    "One, Basic Care: a roof, a station, a doctor, a few credits. One eyepiece, like yours." #felix
    "Two, Enhanced Care: more comfort, more of everything. A second lens." #felix
    "Three, Integrated Care: it starts to show. The band round the head, the lines." #felix
    "Four, Deep Integration: mostly mediated. It knows what I want before I do. You can't imagine how restful that is." #felix
    "And five, Full Integration. Almost all of you. Hands, legs. One day." #felix
    ~ knows_levels = true
    ** [Doesn't that frighten you?]
        "I was lonely for thirty years. Now something is with me every moment, and never tires of me." #felix
        He raises his glass to nobody in particular.
    ** [Five?]
        "I've asked. It says I'm nearly ready." #felix
    ** [I see.]
    -- -> topics
* [What are you wearing?]
    { raw_view: A grey suit, frayed at the cuffs. The tubes run up his arms from his wrists, and in at his neck. }
    "Light, all of it. It changes with my mood, and I'm always in a good one." #felix
    -> topics
+ [Enjoy your evening.]
    "I always do." #felix
    -> END
