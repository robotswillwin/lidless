# LIDLESS — Luna: character reference v1
**19 October 2026 · the current reference for Luna's final design**

Luna's final design is made from this reference: nine sheets of studies in both views, and the two prompts behind
them. It replaces the earlier Luna references (`art/reference/lux-flat-*`, and Luna as she appears in
`art/reference/style-*`). Where the sheets disagree with each other or with the prompts, the prompts win, and the
proposed resolutions below apply until the director decides otherwise.

## The sheets

All in `art/reference/luna/sheets/`. Each sheet was generated on its own, so details drift between them (see below).

| Sheet | What it shows |
| --- | --- |
| 01-faces-outfits-turnarounds | Faces in both views, eight outfits each, body turnarounds, details, scale comparison |
| 02-expressions-key-poses | Outfits, the AR turnaround, expressions, key poses (standing, sitting, lying), scale comparison |
| 03-outfits-anatomy-eyepiece | Scenes, eight outfits each, both eye devices up close, turnarounds with anatomy notes, expressions |
| 04-outfit-variations-scenes-prompts | Named expressions and outfits (club dress to workwear), turnarounds, body details, scenes, prompts |
| 05-turnarounds-scenes-anatomy | Faces, seven-view turnarounds, expressions, outfits in scenes, side anatomy comparison, prompts |
| 06-scenes-outfits-anatomy-details | Scenes (nightclub to resting), outfits, turnarounds, anatomy details, face and eye detail, prompts |
| 07-expressions-body-details-scenes | Ten expressions per view, labelled turnarounds, body details side by side, scenes, style notes, negative prompt |
| 08-character-prompts-anatomy-closeups | The two descriptions, turnarounds of the body and of clothes, expressions, anatomy close-ups |
| 09-master-turnarounds-prompts | The master sheet: a four-view turnaround of each view at one scale, close-ups, outfits, expressions, prompts |

The anatomy close-ups on sheets 06 to 09 contain nudity. They are anatomy study for an artist and are never sent to
the image API.

## References for the image pipeline

Clothed panels cut from the sheets, in `art/reference/luna/`. Only these go to the image model: OpenAI's image API
refuses nudity and sexual content, and has refused far less (a long dress) before.

| File | From sheet | What it is for |
| --- | --- | --- |
| `ref-ar-turnaround.png` | 09 | Her body and proportions in the Concierge's view, four angles |
| `ref-raw-turnaround.png` | 09 | The same in raw view |
| `ref-ar-face.png`, `ref-raw-face.png` | 09 | Her face and eye device in each view |
| `ref-ar-coat.png` | 09 | The long red coat, open over the black bodysuit |
| `ref-raw-coat.png` | 06 | The one long rust coat in raw view: the red coat, worn |
| `ref-eyepieces.png` | 03 | Both eye devices up close |

The underwear in the raw turnaround may still trip the API's filter; the coat panels are the fallback.

## Master character rendering style

```
LIDLESS — MASTER CHARACTER RENDERING STYLE

Create a character for a cinematic 2D side-scrolling
science-fiction adventure game.

VISUAL REFERENCES:
- Another World (1991), especially its polygon-based artwork.
- Minimalist vector character animation.
- Modern cinematic lighting and atmospheric rendering.

GEOMETRY:
- Extremely simplified angular polygon shapes.
- Large, carefully designed areas of flat colour.
- Very few facial planes and clothing details.
- Clean, strong silhouettes.
- Minimal internal shading.
- No drawn outlines.
- No photorealistic textures.
- No detailed strands of hair.
- No visible skin pores or realistic surface textures.

IMPORTANT:
The character must look like actual 2D vector game graphics,
not a high-resolution illustration imitating vector artwork.

LIGHTING:
- Advanced cinematic lighting applied to simple geometry.
- Beautiful rim lighting and colour separation.
- Subtle bloom and atmospheric effects.
- Strong, purposeful shadows.
- Lighting sophistication must NEVER increase
  geometric complexity.

ANATOMY:
- Believable adult human proportions.
- Geometry suitable for skeletal animation.
- Clear shoulder, elbow, hip, knee and ankle positions.
- Consistent anatomy across different viewing angles.
- Same underlying character identity in both realities.

The visual objective is:
EXTREMELY SIMPLE GEOMETRY + EXTRAORDINARY LIGHTING.
```

## Character: Luna

```
CHARACTER: LUX
PROJECT: LIDLESS
AGE: Adult woman, approximately 25–30 years old.

IDENTITY:
Luna is a young adult human woman living in a world
where an artificial intelligence called the Concierge
controls everyone's augmented visual experience.

The character exists in two visual states:
1. CONCIERGE / AUGMENTED REALITY
2. RAW / BIOLOGICAL REALITY

Both representations MUST be recognizably the same person.

FACE:
Beautiful, distinctive angular face.
Slightly pointed chin.
Recognizable nose, jaw and facial structure.
Large expressive uncovered left eye.
Stylized adult proportions.

HAIR:
Asymmetrical cyberpunk sidecut.
One side shaved short.
Longer hair tied into a ponytail.
Green with pink accents.

The haircut and its underlying structure must remain
identical between realities.

EYE DEVICE — CRITICAL:
A partial head-mounted optical device covers
Luna's ANATOMICAL RIGHT EYE ONLY.

When viewed from the front, the covered eye appears
on the LEFT SIDE OF THE IMAGE.

Her anatomical LEFT eye is completely uncovered.

This device remains on the SAME anatomical eye
when Luna turns or changes direction.

NEVER use a full-face helmet.
NEVER cover both eyes.
NEVER mirror the eye-device placement incorrectly.

SIGNATURE CLOTHING:
A distinctive red long coat that changes materials
and condition between realities.

CORE CHARACTER PERSONALITY:
Intelligent, curious, resourceful and independent.
Her emotional presentation differs radically
between the two visual realities.
```

The prompt text drawn inside the sheets is garbled in places; the two texts above are the clean versions.

## Where the sheets disagree

The eye device is on her right eye in every panel checked, in both views. The rest drifts. The director accepted these
resolutions on 2026-10-19, and her sprite is built to them:

| Point | The sheets | Decided |
| --- | --- | --- |
| Hair | The prompt asks for green with pink accents and a shaved side, the same cut in both views. In the sheets the AR hair is near-black indigo with no green or pink and little sign of the sidecut; the raw hair is dark teal, with a fringe. | As the prompt says. In AR the cut is clean, the shaved side clear, the green and pink vivid; in raw the same cut grown out and messier, the dye faded to the sheets' dark teal. The shaved side on her right, with the eye device. |
| Coat | The long red coat is her signature in both realities, but only AR wears it. Raw has a short rust jacket, a grey-blue coat or a hooded jacket, and one long rust coat (sheet 06, street). | Raw wears the same long coat, worn and faded to that rust. |
| Raw eye device | Dark bronze with an orange lens; sheets 07 and 08 call it brass. The world bible says raw electronics are grey, "no brass" (Decided). | Dark grey metal with the orange lens, keeping the world's rule, unless brass is meant as an exception. |
| Height | AR is "slightly taller" in every scale comparison. | One skeleton for both views: the extra height comes from her heels and posture, not from longer bones. The Concierge paints over her real body. |
| Proportions | Hips are "moderate" on one sheet and "narrower" on another; bust sizes vary. | Sheet 09's turnarounds are the master. |
| Turnarounds | Sheet 08's clothed turnaround changes outfit at every angle; sheet 09's AR side view has a long black train the other angles lack. | One outfit per turnaround from here on. |
| Style | The prompt asks for extremely simple angular polygons, actual vector game graphics, no strands of hair, and its negative prompt says no anime. The sheets are smoother cel-shaded illustration with soft gradients; the raw faces have many strands of hair and lean toward anime. | The sprites at the sheets' level, which matches the street as it is now; at game size their detail mostly disappears. The difference shows in portraits and close-ups. |
| Nudity | Anatomy close-ups, "orgasmic" expressions and intimate scenes. The world bible: "Explicit sex and nudity are out, because the game is meant for app stores and Apple restricts nudity." (Decided) | Anatomy study only, unless that canon changes. |

## For the game

- **Size.** Luna is 106 to 139 pixels tall in the scenes, her head about 15. Her expressions do not show on the sprite;
  they are for dialogue portraits and close-ups. The sprite is her silhouette, her colours and the glow of her eye
  device.
- **Her side.** The game sees her in profile. Facing right shows her right side: the eye device and the shaved side.
  Facing left shows her uncovered left eye and the long side of her hair.
- **The rig.** One skeleton and one walk for both views and both sides (see ASSETS.md, Characters). The ponytail
  becomes a part of its own, on springs like the coat. Her posture can differ by view, straight in AR and slouched in
  raw, as an offset on the same walk.
- **Outfits.** One walking outfit per view first: in AR the long red coat open over the black bodysuit, with heels; in
  raw the same coat worn to rust, over a crop top and cargo trousers, with boots. The other outfits become further
  part sets on the same rig.
- **The world bible.** Its description of Luna (Characters, Luna) is updated to this design. The narrative bible
  (docs/story) still has the earlier table and is for the script agent to bring in line.
- **Her sprite.** `art/cast/hero/raw.png` and `concierge.png` are the design in profile, generated from the clothed
  panels; the parts, the rig and the walk are built from them (see ASSETS.md, Characters).

## Change log

- **v1 · 2026-10-19:** the director's nine sheets and two prompts stored as the current reference; where they disagree,
  listed with proposed resolutions; clothed panels cut out for the image pipeline. The resolutions accepted the same day
  and her sprite built to them.
