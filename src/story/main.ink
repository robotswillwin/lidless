// The whole story: the variables the game reads and sets, and one file per scene.
// Lines are tagged with who speaks them (#luna, #fixer, #concierge, …); untagged lines are narration. A tag `name: value`
// is something the game does before the line is said: walk, face, wear, go, fade, view, wait (see dialogue.ts).
// An object can have a knot of its own, a stitch for each verb (look, talk, use, take, ask) and use_<thing> for using a
// thing she carries on it: a scene's hotspot names it with `story`.

INCLUDE street.ink
INCLUDE home.ink

// set by the game when a conversation starts and at every choice: true while Luna sees raw view
VAR raw_view = false
// read by the game: true once the fixer has switched on raw view in her eyepiece, which unlocks the view switch
VAR has_raw = false
VAR favours_owed = 0
// read by the game: what the city is like now, a variant the scenes have ("rain", "fog", "outage"); "" as they are
VAR conditions = ""

// Her credits: digital, her allowance, on her account. The Concierge's greeting shows them in its view
VAR credits = 312

// The things she can carry: public/assets/items.json says how each looks and what it is called. What she carries now,
// and what she has picked up anywhere, which is gone from where it was (the game adds to both as she takes a thing)
LIST Things = parcel, matches, cigarettes, map, valve
VAR carried = (matches, cigarettes, map)
VAR taken = ()

// the errand the game begins with: the parcel on her desk, to the radio repair by ten
VAR parcel_delivered = false
// her radio, mended: what she heard under the static
VAR radio_heard = false

-> END
