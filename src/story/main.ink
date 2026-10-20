// The whole story: the variables the game reads and sets, and one file per scene.
// Lines are tagged with who speaks them (#luna, #fixer, #concierge, …); untagged lines are narration.

INCLUDE street.ink

// set by the game when a conversation starts and at every choice: true while Luna sees raw view
VAR raw_view = false
// read by the game: true once the fixer has opened her eye, which unlocks the view switch
VAR has_raw = false
VAR favours_owed = 0
// read by the game: what the city is like now, a variant the scenes have ("rain", "fog", "outage"); "" as they are
VAR conditions = ""

-> END
