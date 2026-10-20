# LIDLESS — Art & Visual Consistency Review
**Early working review v0.1 · 17 October 2026**  
**Audience:** environment artist, character artist, art director, animator, UI designer  
**Status:** Constructive production feedback, not locked canon. Screenshots are work in progress.

## Executive direction
The visual concept is compelling: beautiful, persuasive Concierge View contrasted with the wet, decaying physical city. Main Street and the warm Radio Repair interior are strongest. **The principal issue to fix before adding detail is believable physical scale, perspective, and consistency.** This is the sort of structural error that makes AI-assisted art feel generated even when lighting and textures are attractive. Characters, props and scenery must share one physical world, not merely a colour palette.

## Priority-zero: scale, placement, geometry and visual plausibility
**Radio Repair interior:** the tools and instruments mounted on the wall behind the fixer appear **too large and too high** relative to the human figures, workbench, shelves and reachable working height. Rebuild their dimensions and locations against a consistent real-world scale. Do not just shrink all objects uniformly: decide what each tool is, whether it is hung, shelved or in use, and how someone would reach, hold and operate it. Verify the pegs, hooks, radio chassis, lamp, shelf depths, tools, furniture and door against Luna and the fixer.

**Required art pass for every environment:**
1. Pick a shared character-height reference, camera height, horizon and floor plane; construct a simple perspective/scale overlay.
2. Check all doors, handles, steps, seats, worktops, shelves, windows, signs and small objects against the reference.
3. Confirm every human can touch furniture and objects without impossible arm length or body position. Hands and objects must align in animation.
4. Validate the foreground/midground/background size progression; avoid near and far objects with indistinguishable scale.
5. Check physical anchors across views: the same wall, shop entrance, machine and window should retain dimensions and positions. Appearance changes; geometry should not silently jump unless the altered view intentionally hides/replaces something.
6. Inspect silhouettes and proportions at actual gameplay zoom (not only full-resolution stills). Eliminate implausibly huge tools, thin seats, awkward railings, inconsistent character heights, floating feet and mismatched shadows.
7. Fix foundational scale/composition issues **before** texture, pixelation, bloom or atmospheric polish. High-quality lighting cannot rescue bad geometry.

**Acceptance criterion:** a viewer should be able to infer how the space is physically used; nothing should feel oversized or inaccessible purely because an image generation pass invented a convincing-looking shape.

## Overall strengths to protect
- Warm, inviting Radio Repair shop against rainy, violet-blue Main Street.
- Legible emotional contrast in the woman at the feeding cradle.
- Strong gold-leaf sign, monitor green, human-made radios and analogue detail.
- Architectural correspondence between augmented and raw backstreet and home.
- CO's presence in the sky; the altered sky/moon relationship.
- Atmospheric reflections, wet surfaces, localized glows and sophisticated noir framing.

## Scene notes

### `street` — Main Street
**Keep:** shop frontage/window, warm/cold colour contrast, framing, street machine and looming CO presence.  
**Fix:** the feeding woman's pose must read as a *single physical pose* in both views; the cradle/hand contact and knee positions should align. Clarify the curled sleeper as a person in Raw View without making him an obvious clue in Concierge View. Luna should inherit amber spill near the window and cooler magenta/cyan light outdoors; maintain contact shadow and reflections. The sky-face should look completely credible *inside the illusion*, not like faulty hologram technology. Validate lamppost, railing, vending unit, shop dimensions against Luna's height.  
**Weather consistency:** original canon states augmented streets *look dry* while physical rain is present; plan convincing visual handling of umbrellas and wet pavement rather than treating rain in the two renders as arbitrary.

### `backstreet` — Entrance 3 / Concierge Store 24
**Keep:** clear door, shop, pipes, panel, matching buildings.  
**Fix:** vary Raw View values so kiosk shutter, utilities, entrances and traversable ground remain legible. Add a small number of story-bearing details (neighbour, service bot, human maintenance, lit window) instead of generic clutter. Check shop window/storefront, signage, door dimensions, handle heights and drainpipe widths. Props added to one view need a classified reason to be absent or altered in the other.

### `home` — Luna's apartment
**Keep:** clean white comfort vs damp room, matched layout and window.  
**Fix:** give Luna personal possessions so this is a home rather than a showroom; use a few real objects that persist across views (photograph, keepsake, tool, note). Check mattress width, stool height, sink/fixtures, window sill and Luna's reach against her sprite. Use the same room geometry between views. The augmented room should feel genuinely appealing, not antiseptic; Raw View needs readable local light and human texture, not only dark decay.

### `radio` — interior
**Keep:** inviting amber workshop, dense analogue culture, fixer/Luna staging and dialogue scene.  
**Top-priority fix:** wall tools **too big and too high**; shelf and bench proportions inconsistent with humans. Adjust work zone ergonomics before further decoration. Check that radios can sit on benches, the fixer can grip the object he holds, lamp lights fall on the right surfaces, and the room architecture matches both views. In Raw View, retain warm physical sources (real desk lamp, green oscilloscope, functioning bulb), though the furnishings may be worn and equipment patched. Raw is *real*, not inherently colourless.

## Characters: one shared sprite/rendering system
- Agree on canonical standing height, head-to-body ratio, limb proportions, walking stride and camera-angle conventions.
- Current Luna/fixer often differ in sharpness, palette and painterly treatment; unify silhouette and pixel-cluster density.
- Avoid high-frequency speckle that reads like downsampled photography. Simplify clothing into deliberate shape families and selective accents.
- Maintain consistent feet-to-ground, shadows, reflections, visor side and proportions through scenes and both views.
- Make animation and action poses physically believable; hands must actually reach knobs, objects and cradles.
- Keep adults attractive or frightening through silhouette, clothing, posture and expression rather than extreme anatomy.
- Establish low-res sprite tests for youth, adults, older adults, robots, modified humans and horror forms before scaling production.

## Resolution and compositing
Test one controlled lower-resolution character/environment pass on Main Street, *without* simply applying a blocky filter to detailed concept art. Choose a logical pixel density, edge policy, palette/contrast treatment and animation sampling. Keep rain/fog/bloom/reflection post effects sophisticated if needed, but preserve coherent underlying scale and physical grounding. Review at native gameplay presentation and on smaller displays.

## Lighting and contrast
Create scene lighting guides with physical-source positions, colour temperatures, falloff and actor integration. In Raw View, machines and lamps retain real colours; avoid near-identical green-grey washes across all rooms. Reserve the striking revelation of a beautiful **physical** laboratory for later: the inventor's space is clean, cared for and well lit in Raw View, while a deliberately falsified storage/sewer appearance hides it in Concierge View.

## Dialogue UI and game readability
The current panel uses italic narration, speaker label and numbered choices: strong basic hierarchy. Check type size/contrast on actual screen sizes. The large dark rectangle can obscure performance and foreground detail; investigate visual integration while retaining clear focus and accessibility. Use consistent hotspot identification and depth priorities; world richness must not prevent finding doors, machines and useful objects.

## Concrete review checklist / sign-off
- [ ] Human-height and camera overlay established for every scene.
- [ ] Radio tool wall rescaled and reorganised to reachable heights.
- [ ] Bench, chairs, door furniture, radios and fixtures plausible at character scale.
- [ ] Repeated props and physical architecture line up across both views.
- [ ] Character proportions, lighting, feet and reflections consistent.
- [ ] The woman's wrist-cradle interaction remains physically identical in both views.
- [ ] Raw View varies in lighting and remains navigable.
- [ ] Hero and interactive hotspots readable at intended game resolution.
- [ ] Dialogue leaves key characters visible and text legible.
- [ ] Each scene tells something specific about its inhabitants.

## Suggested production sequence
**Pass 1 — Physical correction:** geometry, scale, ergonomics, floor, pose contact.  
**Pass 2 — Character system:** sprites, animation, shadows, light response.  
**Pass 3 — View continuity:** physically identical anchors and explained AR replacement.  
**Pass 4 — Gameplay readability:** hotspots, contrast, dialogue.  
**Pass 5 — Visual polish:** rain, atmospheric effects, colour, subtle motion, detail.

## Change log
- **v0.1 · 2026-10-17:** First separate artist-facing review based on uploaded screenshots of the four opening locations. Explicitly elevates oversized/high radio-room tools and cross-scene scale consistency to highest priority.
