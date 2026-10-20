// The whole story: the variables the game reads and sets, and one file per scene.
// Lines are tagged with who speaks them (#luna, #fixer, #concierge, …); untagged lines are narration.

INCLUDE street.ink

// set by the game when a conversation starts and at every choice: true while Luna sees raw view
VAR raw_view = false
// read by the game: true once the fixer has opened her eye, which unlocks the view switch
VAR has_raw = false
VAR favours_owed = 0

-> END
