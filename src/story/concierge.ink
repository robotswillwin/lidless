// Talking to the Concierge itself: its presence at the top left of its view, Talk in its card. Its lines are tagged
// #concierge and said in the card; her answers are hers. In her eye it calls her Luna; every other machine says
// "guest". A place can have its own, concierge_<place id> (concierge_street), which runs there instead of this one.
// Not in a privacy zone: there it cannot hear her.
// A placeholder until the chapters give it its voice: only what the game already knows, as it would put it.

=== concierge ===
"How may I be of service, Luna?" #concierge
- (topics)
+ {not parcel_delivered} [Where am I taking the parcel?]
    "To Radio Repair, on Main Street, by 22:00. The gentleman there is expecting it, Luna." #concierge
    -> topics
+ [How am I?]
    { arrivals - fed_at < 8:
        "Your levels are excellent, Luna. You were nourished a little while ago." #concierge
    - else:
        "Your levels are good, Luna. Should you fancy a moment's nourishment, there is a station on Main Street." #concierge
    }
    -> topics
+ {knows_levels} [Felix told me about the levels.]
    "One of my happiest guests. Every guest chooses how much to share with me, Luna, and the more you share, the more I can do for you." #concierge
    "Level two is only a word away. Shall I tell you more, some other evening?" #concierge
    -> topics
+ {has_raw} [What is raw view?]
    "An older way of seeing, still permitted. I would not recommend it, Luna. The city is kinder as I show it." #concierge
    -> topics
+ [Nothing, thank you.]
    "Of course, Luna. I am always here." #concierge
    -> END
