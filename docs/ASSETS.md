# Asset contract

Every visual in Lidless is a **sprite set**: a folder with a `sprite.json` and up to seven PNG maps.
Only `albedo.raw.png` is required. The engine fills in sensible defaults for anything left out,
so a first asset can be a single image and gain maps as the pipeline matures.

The game renders at **960×540** and scales up with sharp pixels. A standing adult is about **240 px** tall.

## The two views

Everyone in this world wears a visor over one eye and sees the **Concierge view**. Raw view is the illegal mod.
Every sprite can look different in each view, as long as both are drawn on the same canvas:

| Situation | `albedo.raw.png` | `albedo.concierge.png` |
| --- | --- | --- |
| Same in both views | the image | leave it out |
| Dressed up by the Concierge (the dock person, the topiaries) | the real look | the Concierge look, same canvas |
| Exists only in Concierge view: generated (the umbrella crowd) | fully transparent | the image |
| Exists only in raw view: edited out by the Concierge | the image | fully transparent |

Raw view is the only way to tell real people and things from generated or augmented ones: everything in Concierge
view looks real, and the renderer lights the Concierge's additions exactly like the real world. A figure that is not in a view leaves no trace there: no shadow, no reflection. The pipeline does this
from the recipe's `exists`: `both` (real, the default), `concierge` (generated) or `raw` (edited out). It writes the
transparent albedo, and it records the value in `sprite.json` for tools.

In a level, a hotspot on such a figure gets `"only": "concierge"` or `"only": "raw"`. It can then be clicked only in
that view.

## Scale

Every scene is drawn at one scale, set by the characters: Lux is 240 px tall, and a doorway is about 220 px, so she
is a little taller than a door, as in most 2D adventures. A set drawn bigger makes her look like a child in it: shrink
it with `asset reframe`, which keeps what is in it and paints the new edges. People in a scene are characters built at
this scale and placed as layers, never painted into a background; only far-off figures, like a crowd behind the
street, may be part of the art.

## Maps

All maps share the sprite's canvas size. Pixels with alpha below 50% are not drawn (hard pixel-art edges).

| File | Channels | Notes |
| --- | --- | --- |
| `albedo.raw.png` | RGBA | Colour in raw view. Alpha = shape. |
| `albedo.concierge.png` | RGBA | Colour in Concierge view. |
| `normal.png` | RGB | Surface direction, x and y in red and green (128 = flat), image y pointing down. The pipeline generates this. |
| `material.png` | RGB | R shine strength, G shine sharpness, B height (for how low lights graze the surface). |
| `meta.png` | RGB | Packed per-pixel flags, see below. Usually generated. |
| `glow.raw.png` | RGB | Light the surface gives off in raw view, at half intensity (255 = 2× bright). |
| `glow.concierge.png` | RGB | Light given off in Concierge view: the real glow plus the Concierge's neon. |

`meta.png`, packed so it survives PNG and browser decoding without an alpha channel:

- **R**: 128 if the pixel casts shadows, +64 if its Concierge colour differs (information for tools; it does not change the lighting), + an object id 0–63 (a light can skip its own object).
- **G**: depth layer × 64 (0 sky, 1 far, 2 middle, 3 near) + reflectivity × 16 (0 dry, 1 wet, 2 puddle) + 1 if its glow is a machine's own light, which keeps its colour in raw view (the recipe's `glow.machine`).
- **B**: light group in raw view × 16 + light group in Concierge view. Groups animate glow and lights: 0 steady, 1 monitor flicker, 2 valves, 3 fire, 4 the machine's eye, 5 neon flicker, 6 hologram, 7 screen, 8 string lights.

Without a `meta.png`, the sprite uses `occluder`, `depth`, `reflectivity` and `object` from `sprite.json`.

## sprite.json

```json
{ "name": "hero", "x": 470, "y": 218, "w": 103, "h": 248, "depth": 3, "parallax": 1,
  "maps": ["albedo.raw", "albedo.concierge", "normal", "material", "meta", "glow.raw", "glow.concierge"],
  "anchor": [51, 248], "exists": "both" }
```

- `x` and `y` place the sprite in the level, in pixels.
- `parallax` is how fast it moves with the camera: 1 moves with the street, 0 is a fixed sky.
- `anchor` is the point inside the sprite that stands on the ground, for anything placed by its feet.
- `exists` says which views it is in. It is information for tools; the albedo alpha decides what is drawn.

## Animated sprites

A sprite with `frames` has every map laid out as a strip: the frames side by side, `w` and `h` being one frame,
with a transparent gutter of `frames.gutter` pixels between them. `anims` names runs of frames:

```json
"frames": { "count": 9, "gutter": 2 },
"anims": { "idle": { "from": 0, "count": 1 }, "walk": { "from": 1, "count": 8, "stride": 150 } }
```

A walk's `stride` is how far the body moves in one full cycle; the game picks the walk frame from the distance walked,
so the planted foot never slides, whatever the walking speed. A loop has `fps` and can have `seq`, the order to play
its frames in, where repeating a frame holds it.

The pipeline makes the frames in two ways, and every frame of a character shares one set of colours, so nothing
flickers:

- **Characters that walk** (`parts`): the image model draws the character as a sheet of separate body parts (head,
  torso, coat, upper arm, forearm, thigh, shin) following a template; the parts are cut out with their joints, posed
  through the walk and baked into frames (`parts --bake`). The left-facing side is the right side mirrored, with
  touch-ups only where the two differ, so it stays the same person. Lux is made this way.
- **Characters that stand** (`touch --frame idle/N`): each frame repaints one area, such as a hand or a face, and
  everything outside it is identical in every frame. The recipe's `anims.idle` sets `fps` and `seq`. The fixer's
  soldering loop is made this way.

## Light language

Every asset follows it, and the pipeline will check it. These are the Concierge view's colours. In raw view the
engine makes every surface cold, turns main lighting a sterile pale white and puts a poisonous yellow-green fog in the
air, so lights and glow maps are authored in Concierge colours, and raw albedo needs no tint of its own. A machine's own light keeps its colour in raw view: give the light `"machine": 1` in `scene.json`,
and its glow the machine flag in `meta.png`.

- **Amber** is human and home: bulbs, valves, an ember, bread. Lit in both views; pale white in raw view.
- **Cyan and violet** are the Concierge: its signs, its eye, the crowd it paints. Concierge view only. Many neon signs on the buildings are its too.
- **Red** is human-made and illegal: the bar, the black market, hacked hardware. Lit in both views; pale white in raw view.

## Scenes

A scene folder holds the sprite sets plus `scene.json` (sprite order back to front, lights, beacons,
steam and smoke, light shafts, drips, the reflection line, traffic) and `zone.png`, a level-sized map of
where it is inside (R), outside (G) and how much static shadow there is (B).

Characters walk in front of the set, so lights and characters need to know which is in front of which:

- A light's `layer` says where it is against the characters. 0 means behind them, such as inside a shop or on a facade:
  a character in front hides its glow in the air, and the light only catches the character's edges, as a rim. 1 means
  among them, such as a street lamp: most of its glow is hidden behind a character. 2 means in front of them. Inside and
  facade lights default to 0, the rest to 1.
- A sprite's `haze` is how much of the glowing air lies in front of it: 1 for the set, 0.1 for characters by default.
  Light shafts and the wide halo around lights follow it too.
- A character takes the zone of the ground it stands on, not of the set behind it: standing in the street in front of
  an open shop, it is outside, lit by the street lights and in the rain.
