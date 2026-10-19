# Asset contract

Every visual in Lidless is a **sprite set**: a folder with a `sprite.json` and up to seven PNG maps.
Only `albedo.raw.png` is required. The engine fills in sensible defaults for anything left out,
so a first asset can be a single image and gain maps as the pipeline matures.

A level is **960×540** level pixels, drawn at twice that on desktops (see Resolution). A standing adult is about
**240 px** tall, drawn smaller in the painted scenes (`actorScale`).

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

## Resolution

A level is 960 by 540 level pixels, and every place and size in a scene or a `sprite.json` is in level pixels. The
engine draws it at a render scale: 1 on the low and medium tiers (phones, 960 by 540), 2 on high (desktops, 1920 by
1080), and the browser fits that to the screen. `?q=medium` or `?q=high` forces a tier.

Art can carry more detail than a level pixel: a recipe's `res` is texels per level pixel, written into the
`sprite.json`. The street and Lux's home are built at 2 and Lux at 1.25 (her 64 frames then fit in 2048 by 2048,
drawn at about one texel per screen pixel on the street at render scale 2). The size and place of the sprite stay in
level pixels whatever its `res`; the build divides the texels by it. At render scale 1, art at 2 is shrunk by
averaging, so phones show the same picture, only softer, from the same files.

Flat vector art (`look: vector`, or `flatMaps` in the recipe) has only colour and glow maps: it has no relief or shine
of its own to light, and one set of flags for all of it, so its `sprite.json` carries the flags instead of a
`meta.png`. That is three or four maps instead of eight or nine, which pays for the extra resolution: Lux at 1.25 takes
less memory than she did at 1 with all her maps.

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

Without a `meta.png`, the sprite uses `occluder`, `depth`, `reflectivity`, `object`, `groupRaw`, `groupConcierge`
and `machine` (1 for a machine's own light) from `sprite.json`.

## sprite.json

```json
{ "name": "hero", "x": 470, "y": 218, "w": 103, "h": 248, "depth": 3, "parallax": 1,
  "maps": ["albedo.raw", "albedo.concierge", "normal", "material", "meta", "glow.raw", "glow.concierge"],
  "anchor": [51, 248], "exists": "both" }
```

- `x` and `y` place the sprite in the level, `w` and `h` are its size, in level pixels.
- `res` is texels per level pixel, 1 if left out (see Resolution).
- `parallax` is how fast it moves with the camera: 1 moves with the street, 0 is a fixed sky, over 1 is nearer than
  the street (see Layers and parallax).
- `anchor` is the point inside the sprite that stands on the ground, for anything placed by its feet.
- `exists` says which views it is in. It is information for tools; the albedo alpha decides what is drawn.

## Animated sprites

A sprite with `frames` has every map laid out as a grid: the frames in rows of `frames.cols` (all in one row without
it), at most 2048 texels wide so phones can load them, `w` and `h` being one frame, with a transparent gutter of
`frames.gutter` texels between them. The engine finds each frame from the size of the texture itself. `anims` names
runs of frames:

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

### Kinds of light: presets

Lights of the same kind share their settings: `public/assets/presets.json` has the kinds (a street lamp, a shop window,
a bare bulb, a neon sign, a billboard hologram, a screen, an old monitor, a machine's eye, fire, the city's glow, the
smog's glow, moonlight), each with its height, reach, colour, strength, zone, layer against the characters, cone, haze,
flicker and the views it shines in, and the effects it brings along when it is placed (a street lamp its light shaft).
A light in a scene names its kind and keeps only what it does its own way:

```json
{ "x": 444, "y": 291, "preset": "street-lamp" },
{ "x": 570, "y": 380, "preset": "street-lamp", "parallax": 0.6, "z": 14, "r": 110, "i": 1 }
```

Changing a kind in `presets.json` changes every light of that kind in every scene. `null` turns off something the kind
has (`"cone": null`). A light with no preset has all its settings itself. In the scene editor, **+ Light** places a
light of its own or one of a kind; a light's panel shows the kind it is, what it does its own way and **Back to the
preset**. The main street's lights are all of a kind.

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

### Characters: parts, rig and animation

Lux's design comes from [art/LIDLESS_Lux_Character_Reference_v1_2026-10-19.md](art/LIDLESS_Lux_Character_Reference_v1_2026-10-19.md):
her study sheets in `art/reference/lux/sheets/`, and the clothed panels cut from them (`art/reference/lux/ref-*.png`),
the only ones to send to the image API.

A character that walks is built from parts, so a person can take over any step later:

| Folder | What is in it | Made by |
| --- | --- | --- |
| `art/cast/<name>/raw.png`, `concierge.png` | the design, standing in profile, in each view | `generate`, `redress` |
| `art/cast/<name>/parts/<set>-sheet.png` | the parts sheet of each set (an outfit seen from one side) | `parts` |
| `art/cast/<name>/parts/<set>/` | the parts cut from it, with their joints in `parts.json` | `parts --recut` |
| `art/cast/<name>/rig/` | the parts as the rig uses them (to the recipe's proportions, the foot split from the shin), `rig.json`, and `<name>.blend` | `rig` |
| `art/cast/<name>/rig/anims/` | the rendered frames: `idle/`, `walk/`, and `idleLeft/`, `walkLeft/`, one PNG per view and frame. Not kept in git: `rig --render-only` makes them again from the .blend | `rig` |
| `public/assets/cast/<name>/` | the sprite the game loads | `build` |

`npm run asset -- rig <recipe>` rigs the parts in Blender (tools/blender/rig.py): one skeleton for both outfits and
both sides, the walk keyed from the gait (feet planted, the legs reaching them), the coat as two chains of springs
the legs push and drag, the forearms trailing the upper arms, and every set rendered to rig/anims/. Joints are meshes
blended into the next bone, so knees, elbows and ankles bend instead of breaking.

The ponytail is a part of its own (`parts.extra: ["ponytail"]` in the recipe): drawn as a separate piece on the
parts sheet, hung from a joint at the back of the head, and swung in Blender by a chain of springs that each step's
bounce sets going, the tip later than the root. The head is drawn behind the torso, its neck carried on a little below
its cut so it tucks under the collar: no gap opens between them however she moves. A lower leg drawn whole, the bare leg
into the boot, is split at the ankle into a shin and a foot so the foot can roll. `parts.proportionsByView` gives one
view's own proportions where it has them (the Concierge's longer, sleeker ponytail).

Standing, she breathes: a loop of 16 frames (`idleCycle` in tools/pipeline/parts.mjs) in which her chest rises and her
torso tips back a touch, her head, arms and free knee follow, and in Blender her ponytail and coat sway on their
springs; the recipe's `anims.idle.fps` (5) sets its pace.

To change the walk by hand: open `art/cast/hero/rig/hero.blend` in Blender, pose the `rig` armature (frames 0 to 15
are her idle loop, the 16 after it one cycle of the walk; markers name them), save, and run
`npm run asset -- rig art/cast/hero.json --render-only`,
then `build`. The walk is animated once and every outfit and side follows. Redrawing a part means replacing its image
in the parts folder and running `parts --recut`, then `rig`. Set pieces (sleeping, eating, showering) are fixed-frame
loops instead: a picture as frame 0 and a few frames where only part of it changes (`touch --frame`).

### Painted scenes

The main street is the first scene in the current look, the flat look (`art/reference/look/`, and
docs/art/LIDLESS_Look_Reference_v1_2026-10-19.md): flat, simple shapes with the drama in the light, so that a scene can
later be split into layers that move at their own speed. Its background is one picture per view with its night light
painted in, and the engine adds what moves and what lights the characters.

- `baked: 1` shows the set as painted: the scene's lights add only a little to it, and its painted reflections are not
  mirrored again; only the characters are, unless its look mirrors the set (see Reflections, below). The lights are
  there for the characters: put them on the painted lamps,
  signs and windows, with a soft fill in the scene's colour (layer 1) so the hero reads against the city, and keep
  their `haze` low, or the painted glow doubles up. A lamp keeps the colour it is given in raw view.
- `actorScale` is how big people are drawn: on the street 0.46, walking along the bollards (walk line 452) at the size
  the look reference shows her; in her home 0.44, the right size for its door and furniture. Characters are
  sampled smoothly and shrunk by averaging what each screen pixel covers, their colours bled a few pixels past their
  edges by the build, so a small figure keeps clean edges and does not sparkle or boil as she walks. Her pace on screen goes with its square root. Under 1 the engine averages the sprite's pixels, so she shrinks
  smoothly; over 1 is a closeup.
- The look panel (L) tunes painted scenes like any other: its Ambient sets how bright the painted set and its people
  are shown, its Lights what the lamps add, and haze, glow, bloom, light shafts, grain and the rest work as usual. The
  project look keeps grain and colour fringes low and the characters' edge wrap small, which would wash out a small figure.
  What a scene needs its own way goes in its scene file's `look`, tuned with the panel's **This scene**: only those
  settings, over the game's look.
- The painted art's own neon, windows and lamps glow (`glow: auto` in its recipe), so bloom and light shafts have
  something to work with; the street adds haze under its lamps, light shafts, drips from the shop's awning and steam.
- The look's **Drawn colours** (`actorPaint` 1) shows the scene's people in their own drawn colours times the light
  of **Their light** (`actorRed`, `actorGreen`, `actorBlue`), one per view (the street: a touch of violet in the
  Concierge's, warm and dimmer in raw), with the lamps near them adding their light. Flat-shaded figures then read as
  in the concept art instead of dimmed by the night.
- A painted scene's colours are final: the game's built-in grade and film curve are left out for it, its colours pass
  straight through with a soft shoulder over the light the game adds, so the street and its people come out as drawn
  and bloom comes from the lights, not from every bright painted pixel.
- The look's **Depth of field** off (`depthOfField` 0) keeps far shapes sharp; **Rain in raw view** (`rain`, 0 to 1)
  sets how hard it rains, a drizzle at 0.2. The street and the home set all of these in their own `look`.
- A light with `raw: 1` exists only in raw view, as `ar: 1` only in the Concierge's: the moon, a machine's own eye.
- Its hotspots and lights were placed on the picture by a coordinate grid over the built albedo maps.

Small places, such as Lux's flat, are drawn as a cutaway of their building, like a doll's house with its front wall
gone (`art/home/cutaway.json`): her floor lit in the middle of the frame, the neighbours' flats dim above and below, the
city on either side. The scene walks her along her floor; the city at the sides is outside (`zones`), so the rain
falls there, and rings from the rain only show on ground that reflects.

How the street was made: the Concierge's picture of the look reference, scaled to 1920 by 1080, was imported, and
`touch` took Lux out of it and added what the scene's story needs: the woman in red at the dining machine, the shop's
gold-leaf sign, the Concierge's face on the billboard. Raw view was then redrawn from it with `redress --from
concierge.png`: the same shapes, lined up within a pixel, dim and worn in amber-brown smog, with the sign reading
РЕМОНТ РАДИО, a faded ОТЕЛЬ, a poster where the face hangs and the woman wire-thin at the machine; `touch` added the
sleeper. The proposed raw picture itself, with its grime and pipes, had far too much detail for the look. The earlier
streets are in git's history.

Later, for the moving camera: the painted reflections were taken out of the wet ground (`asset ground`, below) for
the engine's live ones, and the woman at the dining machine and the machine itself were shrunk to Lux's scale. They
had been painted about a third too big for someone kneeling on her walk line: `touch` painted the corner without them,
and the two were cut out of the pictures from before by traced outlines, shrunk by 0.78 around the machine's foot and
laid back, with the hotspots, the machine's lights and the end of the walk line moved to match.

**Reflections.** Wet ground mirrors what is above it around the scene's reflection line (`mirror`): the characters
always, each around its own feet, and the set where the art has no reflections painted in. The look sets it, per
scene and per view, in the panel's Reflections group: **Reflections** (`reflect`), how strongly; **Mirror the set**
(`mirrorSet`), 1 for a painted scene whose ground had its reflections taken out; **Reach up** (`reflectReach`), 1 a
mirror, more showing taller things squeezed into the ground, as a low camera over a wet street sees them; **Streaks**
(`reflectStreak`) and **Diffuse** (`reflectDiffuse`), how far the reflections are smeared up and down (a wet street)
and sideways, in pixels: the set is softened at half resolution with a wide Gaussian, the people over their own
pixels. Smeared 16 pixels or more sideways, the floor is glossy: the people are smudged into it with everything
else instead of mirrored on their own, and it shows colour and light rather than shapes. Live reflections are made
from the picture as it is on screen, so they follow each layer's parallax: painted ones stayed put while what they
reflected slid. The street, in raw view, is a wet street in the rain (strength 0.9, reach 3.5, streaks 28, diffuse
3); in the Concierge's, a shiny floor of smudged colour and ambience (strength 0.22, reach 1.4, streaks 70, diffuse
40), reaching up less so the tall city is not squeezed into stripes. Sharp mirrors with ripples broke into
horizontal lines; soft ones only waver. `npm run asset -- ground <recipe> --from <y>` takes painted reflections out of a
picture's ground below the line, in both views: each stretch of each row keeps the colour of its darkest pixels,
smoothed up and down by `--smooth` (20 level pixels), so the broad pools of light stay and the streaks go, and the
lines painted across the ground (planks, ripples) too: kept row by row, they had shown as horizontal bands. Then
split or build again.

In flat art, raw view is as simple as the Concierge's: age and dirt are duller colours and a few simple shapes, never
texture. The pipeline's description of the raw world says so for `look: vector`, and a recipe's `rawAir` names the
colour of its raw smog (yellow-green unless it says otherwise; the street's is amber-brown).

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
landed. `parts.gait` changes it (`GAIT` in tools/pipeline/parts.mjs: stride 1.35 leg lengths, arms swinging 10°,
elbows softly bent, the torso leaning 3° forward from upright whatever angle the parts sheet drew it at, the feet's time
on the ground centred a little behind the hip so she is carried over them), and `gait.idle` her stance, upright: weight
on the near leg, the far leg free with its heel
lifted. The world's `hero.cadence` (strides a second, 1.1) sets her pace from her stride at her size in each scene, so
the walk never turns into a scurry when she is drawn small.

A character is softened into the scene: the pixels she only partly covers take the rest of their colour from the set
around her. The look's "Edges taking the light around" (0.15) and "Glow over them" (0.03) stay low: more of the scene's
air over her made her read as far away.

### Layers and parallax

A scene is drawn from its layers, back to front, then its people, nearest last, then any layer marked `front` (a
railing or a wall's edge nearer than the walk line). A layer's `parallax` is how fast it moves with the camera: 1
with the street Lux walks on, under 1 further away (0 stays put, like a sky), over 1 nearer.

- **Wide scenes**, wider than the screen, scroll: the camera follows her and each layer moves at its parallax.
- **One-screen scenes** can have the camera follow her a little: with `drift` in the scene file, it moves up to
  `drift` pixels each way as she walks from one end of the walk line to the other, gently, after her. Every layer then
  moves at its parallax, the street (1) the most and the far city the least, as through a real camera. Players who ask
  for less motion get a still camera.
- **Things on a far layer** take its parallax too, so they move with it: lights, light shafts and beacons (`parallax`
  on each), the flying traffic (`traffic.parallax`) and hotspots (`parallax`, so a click finds them where they are).
- **Overscan:** every layer that moves needs art past the screen's edges, as far as it moves: the street the whole
  drift, a layer at 0.3 a third of it. `split` gives every layer its `margin`.
- Pixel art is placed at whole pixels of the render, to stay crisp; flat art and characters, sampled smoothly, move by
  fractions of a pixel, so a slow camera glides instead of stepping. Flat layers over the first one blend their edges
  by how much of each pixel they cover, so a thin thing such as the lamp's pole slides smoothly instead of its edges
  jumping a pixel at a time (which flickers). A set with anything else in it stays cut out.

**Movers.** Things that move through a scene on their own go in the scene file's `movers`: an `asset`; the layer it
is drawn `after`, by its asset, so the nearer layers cover it and it moves with that layer's parallax; where it can be
seen, `x0` to `x1` in that layer's pixels, as it comes out from behind something at one end and goes behind something
at the other; its `speed` in pixels a second; the `wait` between passes, in seconds, at random between two numbers;
and `dir`, 1 always to the right, -1 always to the left, 0 (the default) each way in turn. Its sprite is drawn as
built going right and mirrored going left, and its `y` is where its sprite.json puts it unless the mover gives one.
The street's train runs along the viaduct after the middle layer, between the building at the viaduct's left end
and the billboard's tower at its right, every 10 to 25 seconds, each way in turn. How it was made: `touch` painted
the two trains out of both views of the street's picture, and the long one was cut out of the pictures from before,
both views, by a traced outline of its back end, roof and nose (`art/street/train/`); built at the size it was
painted (`art/street/train.json`, `height` 22 with the build's 2-texel border at `res` 2), it is the train in both
directions.

**Splitting a picture into layers.** A background drawn as one picture is cut into layers with `split`, by the
recipe's `split`: its `layers`, far to near, each with its `parallax` (and `depth`, and what to `fill` behind nearer
things with); `ground`, the walk line, below which everything is the street; `fixes`, rectangles (`rect`) or polygons
(`poly`) moved to a layer, all of what is in them or only what is in the layers `from`; `margin`, how far past the
screen's edges the layers reach; `thin`, the widest thing in front bridged across; `soft`, how wide a nearer thing's
soft edge is; `rim`, how wide a ring of a middle layer around a near thing may be and still join it. All in level
pixels. The street's is an example (`art/street/vista.json`).

1. `npm run asset -- split <recipe> --map` judges the depth of both views with a model that runs on this machine
   (Depth Anything V2 Small, downloaded once into `node_modules/.cache/lidless`, about 100 MB; nothing of it ships),
   groups everything above the ground into as many bands as there are layers, applies the fixes, and writes
   `layers.png`: one colour per layer, far to near blue, green, red, yellow, magenta, cyan. `layers-preview.png` lays
   it over the picture. Depth judges things by their surface, so a room seen through a window comes out further than
   its wall, and it blurs thin things into what is around them: that is what the fixes are for. A near thing's soft
   edge comes out as a thin ring of a layer in between, which would slide out from behind it as its ghost; such rings
   join the near thing (`rim`). The map must not cut through one flat shape, such as a building half in one layer and
   half in another: it tears open as the layers slide. Trace something with
   a shape of its own, such as the street lamp, with a polygon: a rectangle around it takes the lit air along, and
   that slides with it as a box. A map painted over by hand works too, but `--map` makes it again from the recipe.
2. `npm run asset -- split <recipe> --scene <id>` cuts each layer out of both views by the map, with what each one
   needs behind the nearer ones as the camera moves:
   - The layers only ever slide sideways, and only a little against each other, so what shows from behind a nearer
     thing is the rest of its row: something narrow (a post, a lamp's head) is bridged from the colours on either side
     of it, something wide has the colours of its sides carried in as far as the layers can slide, and where it stands
     against something further away, only half way. The furthest layer does the same: the camera never shows more
     than that behind an edge, and the image model's painting there could be anything, even black. Its painting is
     kept only deeper in, which is never seen, and past the screen's edges (below).
   - Past the picture's edges, each row belongs to the layer its edge pixel is in. The nearer layers carry their edge
     colours out there, which is all the camera ever shows of them; the furthest layer uses the model's painting where
     it carries on the picture's edge (it painted black past the street's middle layer, which showed as a crack).
   - A nearer thing's soft edge is part of the picture's pixels around it. In a layer behind it, those would be a faint
     copy of its outline sliding away from it, so they take the colours of the clean pixels next to them.
   - A cut-out's colours run on a little past its edges, so it can be drawn between pixels without dark lines.

   Each layer becomes an asset of its own, `<name>-<layer>`, with its own recipe, built at once; `--scene` puts them in
   that scene's file in place of the picture. A fill made from the same picture, mask and prompt is used again rather
   than paid for twice (`--reuse` keeps the ones there whatever they were made from). From then on the picture is only
   the source of its layers: `build` and `touch` leave it unbuilt, and after changing it, `split` it again.
