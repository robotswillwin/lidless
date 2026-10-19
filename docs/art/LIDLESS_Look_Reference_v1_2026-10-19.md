# LIDLESS — The flat look: look reference v1
**19 October 2026 · the current reference for how the game looks**

The director chose the flat look for the game: flat, simple shapes with the drama in the light, glow and reflections.
It replaces the painted street of the earlier references (`art/reference/street-*`, `style-*`). One reason for it is
the next step: flat shapes come apart cleanly, so a scene's foreground and background can be split into layers that
move at their own speed (parallax).

## The pictures

In `art/reference/look/`, the main street in both views, as the director proposed it:

| File | What it shows |
| --- | --- |
| `flat-street-concierge.webp` | The Concierge's street: a warm bar upstairs, the radio shop glowing gold, a red neon ホテル, a city of violet, blue, pink and cyan towers, a train on the viaduct, the dining machine with its blue ring. |
| `flat-street-raw.webp` | The same street in raw view: the same building dim and worn, smokestacks and refinery towers in amber-brown smog, the machine rusted, with pipes. |

Lux walks along the bollards in both, about a fifth of the picture tall.

## What makes the look

- **Shapes.** Large flat areas of colour, a few tones per surface, crisp edges, little texture. Buildings are blocks,
  towers are slabs, plants and people are silhouettes or simple figures.
- **Light.** The light is where the detail goes: glowing windows, lamps throwing cones through the air, neon, and long
  vertical reflections on the wet ground. The engine adds what moves: rain, drips, steam, light shafts, bloom, the
  traffic, the beacons, and the lights on the characters.
- **The two views.** The same buildings in the same places. The Concierge's view is saturated violet, blue, pink and
  cyan, warm and clean; raw view is the same street in amber-brown smog, industrial and rusted.

## The street in the game

`art/street/vista.json` is built from the two pictures at twice the level's resolution (see ASSETS.md, Resolution).
What the scene's story needs was painted back in the same style, and everything else is as proposed:

| Added | Why |
| --- | --- |
| The woman at the dining machine: in raw, wire-thin, her wrist locked in its cradle; to the Concierge, a woman in a red dress, dining | A story beat (hotspot `dock`) |
| A man asleep on the shop's step, raw view only | Hotspot `sleeper` |
| The shop's gold-leaf sign: RADIO REPAIR, and РЕМОНТ РАДИО in raw | Hotspot `sign`; the world bible's hand-made lettering on the radio repair shop |
| The Concierge's face on the tall billboard, and in raw a faded poster of a stern man, ПОРЯДОК | Hotspot `sky` |
| A pale moon in the raw smog | Hotspot `moon` |
| Raw lettering: the corner sign reads ОТЕЛЬ, the dining machine's screen shows no text | The world bible: raw view's signs are faint Russian or gone (Decided) |

Lux is drawn at the size the pictures show her, walking along the bollards (`actorScale` 0.46, walk line 452).

## Open points

- **Raw colour.** The raw picture is warm amber and brown. The world bible describes raw view as cold, lit a sterile
  white, with the colour in a yellow-green fog. The street keeps the picture's colours; the bible's description is the
  director's to update or keep.
- **Lux.** In the pictures she wears the long red coat closed, the same in both views. Her sprite follows her character
  reference (`LIDLESS_Lux_Character_Reference_v1_2026-10-19.md`) until the director decides otherwise.
- **Other places.** Lux's home, the backstreet and the radio repair are still in the earlier, more painted look.

## Layers, later

The street divides naturally into planes: the sky and the far towers; the viaduct and its train; the near street with
the shop, the lamp, the bollards and the dining machine; and the wet ground with its reflections. Each plane can be
drawn on its own with these pictures as reference, and a layer's `parallax` in its sprite sets how fast it moves with
the camera.

## Change log

- **v1 · 2026-10-19:** the director's two pictures stored as the reference for the look; the main street built from
  them, with what its story needs painted back in.
