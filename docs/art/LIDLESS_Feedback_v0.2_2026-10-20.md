# LIDLESS — Feedback v0.2
**20 October 2026 · stored, not started: work begins when the director says go**

## What the director asked for

1. **The bathrobe is off.** Screenshot: `docs/art/feedback/2026-10-20-bathrobe-raw.png` (raw view, in her flat).
2. **The cardigan: her head is too small and her feet too big.** Likely in all the new outfits, not only the cardigan.
3. **She cannot run in any of the new outfits.**
4. **No way to change into her ordinary, outdoor clothes at home.**
5. **No underwear outfit.**
6. **Her pace is too slow:** the player sits and waits for her to get somewhere.
7. **A new character study:** `art/reference/luna/body-raw-ar-study.webp`.
8. **To discuss:** tile scenes together so she can walk further, or keep switching between scenes. The director likes
   the parallax look and would like to see more of it.

## Notes and plan

Times are my own working time.

1. **Bathrobe.** It reads as a wrap top over a separate flared skirt that kicks out at the knee, with her bare legs
   swinging out from under it and large slippers: more a dress than a robe. Redraw its parts with `parts.pieces`
   describing a robe, one garment whose skirt hangs straight and closed from the sash, and check its proportions (2).
   About 15 minutes.
2. **Proportions.** The outfits take her head from her coat outfit (`parts.same`) and are sized by its torso, but their
   sheets draw the torso and shoulders broader and the shoes bigger, so against the body her head reads small and her
   feet big. Measure each outfit's standing frame against her coat's (the head's height and the foot's length against
   her height), scale the pieces to match, and make the pipeline print those ratios and flag any more than about 5% off,
   so the next outfit cannot drift. About 30 minutes for all of them.
3. **Running.** The new outfits were rigged walking only (`parts.gaits: ["walk"]`). Render the jog and the run for every
   outfit. An outfit then takes about twice the memory (on a phone about 25 to 50 MB, with only her coat and what she
   wears loaded). About 20 minutes.
4. **Outdoor clothes at home.** The wardrobe leaves her coat out because a coat is painted on the hook by the door, and
   she would be wearing it and seeing it there. Add "Outdoor clothes" (her coat) to the wardrobe, and give the hook its
   coat as a small layer of its own, hidden while she wears it. About 20 minutes.
5. **Underwear.** A new outfit from the new study: plain black underwear in raw view, the same cut in the Concierge's
   as the study's AR side has it. Underwear, not nudity. Worn at home only: like the bathrobe, she will not go out in it.
   About 20 minutes.
6. **Pace.** On the main street she walks about 90 px a second, so a screen takes about 11 seconds. She jogs only past
   2.5 of her heights (about 310 px) and runs past 5 (about 620 px). Make the walk brisker (`cadence` 1.1 to about 1.3
   strides a second) and have her jog and run sooner (past about 1.5 and 3 heights), with running in every outfit (3),
   then tune on the phone. A tap across the street should take about 3 seconds. About 10 minutes.
7. **The study.** Labelled Lux, her earlier name. Raw view is natural and imperfect: green eyes, freckles, messy
   ash-brown hair, small breasts, visible ribs, fine body hair, bruises, natural nails. The Concierge's is perfected and
   synthetic: pink eyes, fuller glossy lips, smooth hairless skin, black hair with pink and teal streaks, larger lifted
   breasts, a flatter stomach and a narrower waist, polished black nails. Use it for the underwear outfit and to check
   her proportions in every outfit. Open: its raw hair is browner and messier than her ash-blonde ponytail, and it shows
   no goggle in raw view; her sprites keep their current face and hair until the director says otherwise.
8. **Tiling or switching scenes.** Recommendation:
   - **Wider scenes for the outdoors**, two to three screens, each painted as one panorama and split into the same
     parallax layers. The camera then scrolls and every layer slides at its own speed across the whole width, not just
     the 18 px lean. Interiors stay one-screen cutaways, and scenes still join at doors and street ends. The engine and
     the editor already handle wide scenes.
   - **Not separate scenes tiled edge to edge.** Their layers would have to line up at every seam in both views, two
     scenes would be in memory at once, and the far city would show the cut from one picture to the next.
   - **Cost**, for the main street at about 2.5 screens: extend its picture left and right (`extend`), redraw raw view
     from it, split it again, and move hotspots and lights. About 1.5 hours and $2 of generation. On a phone the
     background takes about 2.5 times the memory, still under 200 MB with Luna.
   - **The pace first** (6). Without it, a wide street is a long wait.

## Open questions for the director

- Tiling or switching (8): wider outdoor scenes as recommended, tiles, or one screen each?
- Underwear: at home only, as assumed?
- Coming home, should she still take her coat off by herself, or only when the player changes?
