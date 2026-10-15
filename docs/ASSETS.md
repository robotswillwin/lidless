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

## Light language

Every asset follows it, and the pipeline will check it. These are the Concierge view's colours. In raw view the
engine turns main lighting a sterile pale white and the air a sickly sepia, so lights and glow maps are authored in
Concierge colours. A machine's own light keeps its colour in raw view: give the light `"machine": 1` in `scene.json`,
and its glow the machine flag in `meta.png`.

- **Amber** is human and home: bulbs, valves, an ember, bread. Lit in both views; pale white in raw view.
- **Cyan and violet** are the Concierge: its signs, its eye, the crowd it paints. Concierge view only. Many neon signs on the buildings are its too.
- **Red** is human-made and illegal: the bar, the black market, hacked hardware. Lit in both views; pale white in raw view.

## Scenes

A scene folder holds the sprite sets plus `scene.json` (sprite order back to front, lights, beacons,
steam and smoke, light shafts, drips, the reflection line, traffic) and `zone.png`, a level-sized map of
where it is inside (R), outside (G) and how much static shadow there is (B).
