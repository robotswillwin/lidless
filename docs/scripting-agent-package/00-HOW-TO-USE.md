# Scripting agent package

Everything a scripting agent needs to write a chapter of Lidless, in one folder. Made by `npm run agent-package`
from the files it copies: do not edit these copies; edit the originals in `docs/`, and make the package again.

## Setting up the agent

1. Upload every file in this folder to the agent's project, as its knowledge.
2. Paste `INSTRUCTIONS.txt` into the project's instructions.

## For each chapter

1. Give the agent a brief: what the chapter is for, what must happen in it, where, and what you have decided for it.
2. It sends `overview.md` first. Read it; tell it to go on, or what to change.
3. It sends one file per place. Save them all in `docs/chapters/<NN>-<name>/`, for example `docs/chapters/01-the-voice-at-three/`.
4. Check it: `npm run chapter -- docs/chapters/<NN>-<name>`. Paste any errors back to the agent, and save what it fixes.
5. When the check shows no errors, the chapter is ready to build.
6. Once it is built, run `npm run agent-package` again and upload the new and changed files (the new chapter, the
   new catalog) to the project, in place of the old ones.

## What is in it

| File | What it is |
| --- | --- |
| `INSTRUCTIONS.txt` | The agent's instructions: paste into the project. |
| `LIDLESS_Game_Bible_v0.4_2026-10-21.md` | The world, the characters and the story so far: canon. |
| `LIDLESS_Director_Decisions_2026-10-22.md` | The director's decisions since the bible: where they differ, these hold. |
| `LIDLESS_Chapter_Format_v1_2026-10-22.md` | How a chapter is written and delivered. |
| `CATALOG.md` | Everything the game has now, by id: places and their spots, people, things, variables, knots. |
| `chapter-00-the-errand-athena-home.md` | The worked example: the opening, written in the format. Its folder is docs/chapters/00-the-errand/. |
| `chapter-00-the-errand-floor9.md` | The worked example: the opening, written in the format. Its folder is docs/chapters/00-the-errand/. |
| `chapter-00-the-errand-home.md` | The worked example: the opening, written in the format. Its folder is docs/chapters/00-the-errand/. |
| `chapter-00-the-errand-lobby.md` | The worked example: the opening, written in the format. Its folder is docs/chapters/00-the-errand/. |
| `chapter-00-the-errand-overview.md` | The worked example: the opening, written in the format. Its folder is docs/chapters/00-the-errand/. |
| `chapter-00-the-errand-street.md` | The worked example: the opening, written in the format. Its folder is docs/chapters/00-the-errand/. |
| `LIDLESS_Vertical_Slice_v0.1_2026-10-21.md` | The proposal for chapter 1, the vertical slice, and the decisions it waits on. |
