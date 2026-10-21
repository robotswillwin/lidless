# LIDLESS — Feedback v0.3
**21 October 2026 · saved, waiting for the director's go: nothing below is done yet**

## What the director asked for

1. **Her reflection still has artifacts around her feet when she runs.** Screenshot:
   `docs/art/feedback/2026-10-21-running-reflection-and-bots.webp` (the Concierge's view, main street, running, with
   the cleaner and the delivery bot right behind her).
2. **Too many bots.** They should be rare, not running around all the time, or come in at a later scene or later in the
   game: save some for later.
   - Drones can fly by now and then.
   - Keep the maintenance robot, but give it a small animation, such as welding.
   - All the robots are far too big. New reference: `art/reference/robots/helper-robots-and-drones-v3-small.webp`
     ("small, unobtrusive, everywhere"). Its sizes: cleaner 0.5 m, delivery bot 0.6 m, guardian 1.0 m, maintenance bot
     0.7 m, drones 0.3 m. It also shows three kinds of drone: survey, delivery and inspection.
3. **Remove the bakery, and redo the nutrition station to the new design:**
   `art/reference/nutrition/nutrition-health-station-v1.webp`.
   - The station is a central column with the C, and two chairs built into it, back to back.
   - The port for the right wrist is in the armrest.
   - In AR it is white and calm, with cyan light. In raw view it is worn industrial machinery: pipes, gauges, pumps and
     glowing cartridges.
   - In use: she puts her right wrist on the armrest, it scans her automatically, nutrition and medicine are
     dispensed, and she leaves.
4. **Food.**
   - Food is very expensive overall, and not really needed.
   - Bars are fine. People, especially the richer ones, still drink and smoke; the damage is fixed by their nutrition.
   - Restaurants are on top floors, mainly for the rich or for rare occasions.
   - So the store should not mainly sell food.

## Notes and plan

Times are my own working time.

1. **The reflection.** The fix for the borrowed patches of street is in (commit 61c1d87), so this is something else.
   - **Likely cause:** the robots, now lit like characters, are right behind her. For each bit of wet ground, the
     reflection looks up the column for the nearest character's feet. Under her feet it can find a robot's feet
     instead, behind her at the set's ground line, and mirror around the wrong line.
   - **Check:** reproduce at the director's screen size, with and without a bot behind her. The fix is then to take the
     nearest feet below the pixel, not just the first character up the column.
   - **Time:** about 20 to 30 minutes.
2. **Bots.**
   - **Take off the main street for now:** the cleaner, the delivery bot and the guardian. Their art stays in
     `art/bots/` and `public/assets/bots/` for later scenes.
   - **Drones:** they stay, but pass rarely, every 40 to 120 seconds or so.
   - **Sizes:** rebuild every bot at the reference's size, with Luna at about 1.7 m, or 125 level pixels on the street.
     That gives: cleaner about 37 px, delivery bot about 44 px, guardian about 74 px, maintenance bot about 51 px,
     drone about 22 px. Rebuilding is free.
   - **Welding:** a flickering spark light at the maintenance bot's tool (the engine's fire flicker), with a few
     frames of sparks.
   - **New drones:** the survey, delivery and inspection drones from the reference, if wanted (about $0.15 each, both
     views).
   - **Time:** about 30 to 40 minutes.
3. **The nutrition station and the bakery.** Both are painted into the street's picture.
   - **Art:** repaint the street machine and the woman at it as the new station, her seated in one of its chairs, in
     both views. Repaint the bakery's front as something else (see the questions). Then split the street into its
     layers again.
   - **Story:** the street machine's knot and texts become the chair and the wrist port: "Dinner is served" stays (the
     director said so), "Please rest your wrist in the cradle" goes.
   - **Cost and time:** about $0.30 to $0.60 of image edits, about 45 to 60 minutes.
4. **Food.** Write the rule into the world (bible notes), then:
   - Store 24 sells something other than food. Its texts change; its "Good coffee, brighter days" panel is art.
   - The boarded bar on the main street: bars are fine, so perhaps open in raw view too (a repaint).
   - **Time:** about 10 minutes for texts, 20 to 30 more for art.

## Questions for the director, before starting

1. **The bakery:** what takes its place? An empty front, a pharmacy or health shop, a boutique for AR fashion, a bar?
2. **Store 24:** what does it sell now? Essentials, hygiene, drink and tobacco, AR wardrobe and gifts?
3. **The main street's bar:** open in raw view too (a repaint of its boarded front), or does it stay boarded, with the
   bar above the radio repair as the open one?
4. **The guardian:** taken off with the cleaner and the delivery bot, or keep one standing somewhere?
5. **Luna's wrist:** does she wear a device on her right wrist, or is the cuff on the station's armrest all there is?
6. **The woman at the station:** in raw view still wire-thin, as now?
