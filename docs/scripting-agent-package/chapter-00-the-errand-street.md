# Chapter 0: The main street and the radio repair

## Places

```yaml
- id: street
  new: false
  name: Main street
  kind: exterior
  width: 2.5
  size: 33 m of street, the shop fronts 3 to 6 m high, towers and a viaduct behind
  assist: Radio Repair is right here, guest. Your parcel is expected.
  look:
    concierge: >
      A night street in flat, simple shapes: the radio repair glowing gold with a bar above it, a nutrition station,
      a cocktail bar with a restaurant on the floor above, a corner shop, a public restroom's frosted front; behind, a
      glittering city of violet, blue, pink and cyan neon towers and an elevated viaduct; a glossy street mirroring the
      neon.
    raw: >
      The same street as it is: worn concrete fronts, the shops dim but open, the station a column of pumps and
      gauges, the restroom a concrete front with a steel door; behind, smokestacks and towers drowned in amber-brown
      smog; rain on the wet street.
  arrivals:
    - id: start
      where: in front of the radio repair
    - id: from-radio
      where: at the radio repair's door
  ways:
    - id: radio-door
      name: Radio repair
      where: the shop's door, right of its window
      to: radio
      arrive: door
    - id: restroom-door
      name: { concierge: Rest rooms, raw: Public toilets }
      where: the frosted doors at the far right
      to: restroom
      arrive: door
      look:
        concierge: "A public privacy room: frosted glass, soft light. By law, nothing inside is seen or heard."
        raw: "Public toilets: a concrete front, a steel door, a closed eye stencilled by it. Inside, it can't see you."
  spots:
    - id: kiosk
      name: { concierge: Nutrition station, raw: Feeding station }
      where: on the pavement left of the bar
      size: 1.9 m high, 2.8 m wide with its two seats
      story: station
      map: true
      tag: Nutrition · health
      ask: Dinner is served here every evening, guest. Everything you need, and nothing you don't.
    - id: dock
      name: { concierge: Woman in red, raw: Woman at the station }
      where: in the station's left seat
      when: station_seat == "woman"
      look:
        concierge: A woman in red, dining at the station. She smiles at nothing in particular.
        raw: She's wire-thin, her wrist locked in the station's cuff, head down. The red was never there.
      tag: { concierge: "Guest · dining", raw: her wrist is locked in }
    - id: guardian
      name: { concierge: Civic guardian, raw: Guard unit }
      where: on its beat, between the bench and the restroom
      talk: guardian
      map: false

- id: radio
  new: false
  name: Radio repair
  kind: interior
  arrivals:
    - id: door
      where: just inside the shop's door
  ways:
    - id: door
      name: To the main street
      where: the shop's door
      to: street
      arrive: from-radio
  spots:
    - id: fixer
      name: The fixer
      story: fixer
      look:
        concierge: Silver hair, a tailored knit. He works as if he has all the time in the world.
        raw: Hollow cheeks, burn marks on his hands. The iron never stops.
      tag: { concierge: "Guest · repairs", raw: the radio man }
      ask: He repairs old radios, guest. A charming pastime.
```

## Script

```ink
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
// the main street's nutrition and health station: its voice, and taking a seat
= talk
{ raw_view: In raw view its panel is a grille, and the voice comes from behind it. }
"Good evening, guest. Dinner is served." #concierge
* [Take a seat.]
    -> use
* [What is for dinner?]
    "Everything you need, and nothing you don't. A seat, a moment, and you are on your way." #concierge
    -> END
* [Walk on.]
    "Of course. Enjoy your evening, guest." #concierge
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
    "Please rest your wrist, guest. This will only take a moment." #concierge
}
# wait: 0.8
{ raw_view:
    A pump ticks. A finger's width of the cartridge goes. The cuff lets go.
- else:
    "Your levels are excellent. Enjoy your evening, guest." #concierge
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
```
