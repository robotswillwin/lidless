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

Every scene is drawn at one scale, set by the characters and one camera. The camera's eye is at Lux's eye height,
1.6 m, looking straight at the back wall: there a metre is 110 px, and on the walk line, 1.4 m in front of it, 141 px,
which makes Lux (1.7 m) 240 px tall and a 2.05 m door about 225 px. She is a little taller than a door because she is
nearer, as in most 2D adventures.

Rooms are built from a blockout: `asset blockout` draws the recipe's `blockout`, boxes in metres, in that perspective,
and `asset redress --from <recipe dir>/layout.png` paints over it keeping every object where and how big it is, so a
bench is at hip height and tools are within reach. (Given as a mere layout reference with `generate --layout`, the image
model re-composes and drifts back to its own scale.) `layout-check.png` shows Lux and the fixer standing in the
blockout, and the blockout also places hotspots and lights: `toScene` in tools/pipeline/blockout.mjs turns a point
in metres into scene pixels. A set drawn too big can also be shrunk with `asset reframe`, which keeps what is in it and
paints the new edges. People in a scene are characters built at
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
| `normal.concierge.png`, `material.concierge.png` | RGB | The same for the Concierge's look, when it differs: its smooth white walls are not lit with the cracks of the real ones, nor a dressed-up character with its raw clothes. The pipeline derives each view's surface from that view's own picture. |
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

- A light's `layer` says where it is against the characters. 0 (the default) means behind them, such as a lamp on the
  back wall or a facade: a character in front hides its glow in the air, and the light only catches the character's
  edges, as a rim, with a soft fill. 1 means among them, such as a street lamp or the tubes on a room's ceiling: it lights
  them like everything else. 2 means in front of them. A room whose only lights are behind its people makes them look cut
  out: what hangs overhead belongs in layer 1.
- A sprite's `haze` is how much of the glowing air lies in front of it: 1 for the set, 0.1 for characters by default.
  Light shafts and the wide halo around lights follow it too.
- A character takes the zone of the ground it stands on, not of the set behind it: standing in the street in front of
  an open shop, it is outside, lit by the street lights and in the rain.
- People are drawn after the set, the nearest last, by where their feet are: a character standing further back is
  covered by one walking in front. Someone sitting at a machine on the back wall must sit behind the walk line, so the
  hero passes in front of them; put the machine where their hands can reach it.
- Each character casts a soft shadow on the ground under its feet, as wide as its `footprint` (half-width in pixels,
  0.3 of its width by default; a scene layer can set it, 0 for none). The look's "Shadow under them" sets how dark.
- Wet ground mirrors the set around the scene's reflection line (`mirror`), and each character around its own feet, so
  the walk line can run in front of the set's ground line and reflections still start at the boots.
- The look's "Edges taking the light around" softens a character's outline into what is behind it, so it sits in the
  picture rather than on it.
- A scene's `ambient` and `exposure` (stops) can each be one number or one per view: a dark raw room can be a white
  apartment to the Concierge.

### Painted scenes

The main street is the first scene in the current look: flat, simple shapes with the drama in the light, like a modern
Another World (`art/reference/street-lighting-variants.webp`, `style-another-world-modern-2.webp`). Its background is
one picture per view with its night light painted in, and the engine adds what moves and what lights the characters.

- `baked: 1` shows the set as painted: the scene's lights add only a little to it, and its painted reflections are not
  mirrored again; only the characters are. The lights are there for the characters: put them on the painted lamps,
  signs and windows, with a soft fill in the scene's colour (layer 1) so the hero reads against the city, and keep
  their `haze` low, or the painted glow doubles up. A lamp keeps the colour it is given in raw view.
- `actorScale` is how big people are drawn: 0.44 on the street and in her home, the camera pulled back, so Lux is
  about 106 pixels tall, as tall as the Lux in the concept panel. Her pace on screen goes with its square root. Under 1 the engine averages the sprite's pixels, so she shrinks
  smoothly; over 1 is a closeup.
- The look panel (L) tunes painted scenes like any other: its Ambient sets how bright the painted set and its people
  are shown, its Lights what the lamps add, and haze, glow, bloom, light shafts, grain and the rest work as usual. The
  project look keeps grain and colour fringes low and the characters' edge wrap small, which would wash out a small figure.
- The painted art's own neon, windows and lamps glow (`glow: auto` in its recipe), so bloom and light shafts have
  something to work with; the street adds haze under its lamps, light shafts, drips from the shop's awning and steam.
- `actorLight` shows the scene's people in their own drawn colours times a tint, one per view (the street: a touch of
  violet in the Concierge's, olive and dimmer in raw), with the lamps near them adding their light. Flat-shaded figures
  then read as in the concept art instead of dimmed by the night.
- A painted scene's colours are final: the game's built-in grade and film curve are left out for it, its colours pass
  straight through with a soft shoulder over the light the game adds, so the street and its people come out as drawn
  and bloom comes from the lights, not from every bright painted pixel.
- `dof: false` keeps far shapes sharp; `rain` (0 to 1) sets how hard it rains in raw view, a drizzle at 0.2.
- A light with `raw: 1` exists only in raw view, as `ar: 1` only in the Concierge's: the moon, a machine's own eye.
- Its hotspots and lights were placed on the picture by a coordinate grid over the built albedo maps.

Small places, such as Lux's flat, are drawn as a cutaway of their building, like a doll's house with its front wall
gone (`art/home/cutaway.json`): her floor lit in the middle of the frame, the neighbours' flats dim above and below, the
city on either side. The scene walks her along her floor; the city at the sides is outside (`zones`), so the rain
falls there, and rings from the rain only show on ground that reflects.

How the street was made: `npm run asset -- extend` placed the concept panel of the Concierge's view in a 16:9 frame and
had the rest painted around it; `touch` took Lux out of the picture, `redress --ref` made the raw view from it with
the raw panel as reference, and `touch` added the sleeper.

Lux was designed again in the look: `art/cast/lux-concierge.json` generated her Concierge self in profile with the
flat reference figure from the concept art, and `redress` made her raw self from it, the same outline in her worn
raincoat, bun and grey eye device. `parts` drew the raw parts sheet from that (its layout in the recipe's `parts.at`),
`redress --ref` the Concierge sheet from the raw one, `--mirror` and a `touch` of each head the sheets seen from her
left side; then `parts --recut` and `--bake` made the walk.

The parts come off a sheet at whatever sizes the model drew them, a big head and short legs as often as not, and the rig
puts them together as they are. So the recipe's `parts.proportions` gives each part's length as a fraction of her
height, measured on her design: the head from its top to the base of the neck 0.145, the torso from the neck to the
hip joint 0.295, the thigh 0.24, the shin from the knee to the sole 0.32, the upper arm 0.155, the forearm to the
fingertips 0.195, the coat from the hip to the hem 0.34. Baking resizes each part to fit. Her shin part is drawn as a
knee-high boot, so with `boot` (0.235) the lower leg is built as her trouser leg from the knee, carried on from the
thigh, into a boot of that height; stretched whole, the boot and foot came out far too big.

Her walk is built from where her feet go, not from a table of angles. The boot is split at the ankle into a shin and
a foot, the foot knowing where its heel and toe touch the ground. Each foot is planted for the stance part of the cycle,
landing on its heel, rolling flat and pushing off from its toe, and swings forward for the rest; the legs reach the
feet by inverse kinematics, and the hip rides as high as both legs allow, dipping at each heel strike. Baked at 16
frames a cycle, a planted foot moves back exactly a sixteenth of the stride per frame, so in the game it stays where it
landed. `parts.gait` changes it (`GAIT` in tools/pipeline/parts.mjs: stride 1.5 leg lengths, arms swinging 10°,
elbows softly bent, an upright back), and `gait.idle` her stance: weight on the near leg, the far leg free with its heel
lifted. The world's `hero.cadence` (strides a second, 1.0) sets her pace from her stride at her size in each scene, so
the walk never turns into a scurry when she is drawn small.

A character is softened into the scene: the pixels she only partly covers take the rest of their colour from the set
around her, and the look's "Edges taking the light around" (0.3) and "Glow over them" (0.15) let the city's light wrap
her outline and its haze lie over her.
