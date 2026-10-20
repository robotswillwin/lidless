// The house style, written into every request so separate generations look like one game.

/**
 * How it is drawn: "pixel" asks the model for pixel art; "paint" asks for a crisp painting, which the build pixelates;
 * "vector" asks for the game's look since the main street: a modern flat illustration, simple shapes and soft light, as in
 * art/reference/street-lighting-variants.webp and style-another-world-modern-2.webp.
 */
export const LOOKS = {
  pixel: 'High-resolution pixel art for a 2D adventure game, painterly and detailed, with clean pixel clusters.',
  paint: 'A detailed digital painting for a 2D adventure game: crisp edges, clean readable shapes and controlled painterly shading. Not pixel art.',
  vector: 'A modern flat illustration for a cinematic 2D adventure game, in the style of the attached concept art: clean, simple shapes with crisp edges; every surface a flat colour or a smooth, soft gradient of light; forms shaded with a few flat planes of light and shadow; no texture, no noise, no brush strokes and no fine detail; readable, elegant silhouettes; faces simplified to a few shapes. Not pixel art and not a photo-realistic painting.',
};

/** Said in every edit of vector art, so the edit keeps the look. */
const VECTOR_KEEP = 'Keep the style exactly: clean, simple shapes with crisp edges, flat colour and soft planes of light and shadow, no texture and no fine detail.';
const keepLook = (r) => (r.look === 'vector' ? ` ${VECTOR_KEEP}` : '');
/** What an edit of a background keeps of its frame and light. */
const keepFrame = (r) => (r.look === 'vector'
  ? 'Keep the full frame, the layout, every silhouette and the depth; the light, the haze and the colours become this view\'s own.'
  : 'Keep the full frame, the layout and the flat, even lighting; only neon signs and screens may glow.');

export const HOUSE_STYLE = 'Adult noir mood in a rain-soaked future city. Realistic proportions, a clear readable silhouette.';

/**
 * The two worlds: what is really there, and what the Concierge shows everyone. Its world must look just as real.
 * People, and the electronics they use, differ the most.
 */
const RAW_COLOURS = 'Muted, faded colours that lean cold: concrete grey, slate blue-grey, dirty white tile, rust, and peeling paint in washed-out greens, browns and reds. Nothing bright or saturated, except small lights on machines: indicators, old screens.';
/**
 * Vector art paints its air in: the raw world's colour is its poisonous smog, as in the references. A recipe's "rawAir"
 * names another colour for it.
 */
const rawColoursVector = (r) => `Sick, muted colours drowned in a poisonous ${r.rawAir ?? 'yellow-green'} smog that glows where the light falls; nothing bright except lamps and the small lights of machines.`;
const RAW_MATERIALS = 'Concrete panel blocks, cheap plastic, corrugated metal, rust, peeling paint, stained tiles.';
const RAW_ELECTRONICS = 'Electronics that people use are grey and steampunk-like: dull grey metal casings, exposed valves, tubes, gauges, cables and rivets, patched together. No brass.';
const RAW_HELMET = 'Everyone wears a partial helmet that covers one whole eye: here a heavy, grey, steampunk-like device of riveted metal plates, a round lens and small tubes.';
const RAW_WORLD = [
  'This is the raw, unedited world: poisonous, cheap and post-Soviet.',
  RAW_MATERIALS,
  'People look sick, pale and dull, out of shape and under-trained, in cheap, trashy, worn-out clothes.',
  RAW_ELECTRONICS,
  RAW_HELMET,
  'Hardly any text: old signs have peeled away or faded almost to nothing, and what little lettering survives is faint, in Russian or an invented script.',
  RAW_COLOURS,
].join(' ');
/** In flat art, age and dirt are colours and a few shapes, never texture: the same world, said so it stays simple. */
const rawWorld = (r, look = r.look) => (look === 'vector'
  ? RAW_WORLD
    .replace(RAW_MATERIALS, 'Concrete blocks, cheap plastic and corrugated metal, old and dirty: in this flat style that shows only as duller, darker colours and a few large simple shapes, never as texture, stains, rust spots or speckle.')
    .replace(RAW_ELECTRONICS, 'Electronics that people use are grey, old and patched together, drawn as a few simple grey shapes. No brass.')
    .replace(RAW_HELMET, 'Everyone wears a partial helmet that covers one whole eye: here a heavy grey device with a round lens.')
    .replace(RAW_COLOURS, rawColoursVector(r))
  : RAW_WORLD);
const CONCIERGE_ELECTRONICS = 'Electronics that people use look futuristic: smooth white shells and blue light.';
/**
 * Old analog devices are relics: nothing in them reports to the Concierge, so it shows them as they looked when new.
 * A recipe with "relics" keeps them retro in its view, and the raw world shows what decades of patching made of them.
 */
const CONCIERGE_RELICS = 'Old devices here are relics, and the city AI shows them as they looked when new: lovingly restored retro electronics in polished walnut, cream bakelite and brass, with warm glowing dials. Not white shells, and no blue light.';
const CONCIERGE_WORLD = [
  'cool and glamorous: sleek, glossy, expensive and stylish, with cyan, violet and magenta neon accents.',
  'People are clean, healthy, fit and good-looking, in stylish, well-fitted clothes.',
  CONCIERGE_ELECTRONICS,
  'Everyone wears a partial helmet that covers one whole eye: here a smooth, seamless white shell with a soft blue light.',
  'Signs and screens are in English, with some Chinese and Japanese, like an international city.',
  'It must look completely real and physical, never like a hologram or a projection.',
].join(' ');
const conciergeWorld = (r) => (r.relics ? CONCIERGE_WORLD.replace(CONCIERGE_ELECTRONICS, CONCIERGE_RELICS) : CONCIERGE_WORLD);

/** Art the game lights itself is lit flat; vector art has its night light painted in, and the game adds what moves. */
const FLAT_LIGHT = 'Flat, even, neutral lighting like an overcast day, no shadows and nothing glowing: this is the colour of every surface, and the game adds the night and its lights.';
const PAINTED_LIGHT = 'Lit at night by its own light sources and strongly backlit, the haze glowing behind: the floor and the nearest things are dark silhouettes against brighter depth.';

/** What to draw and how to frame it. The game lights everything itself, so the art is lit flat. */
const KIND_NOTES = {
  character: 'One full-length figure standing, seen from the side in a three-quarter view facing right, feet at the bottom of the frame. Even, soft, frontal lighting with no cast shadows, no rim light and no glow halos. Transparent background, the whole figure in frame with a little space around it, no ground, no text, no border.',
  prop: 'One object on its own, seen straight from the front at eye level, as it would stand on a street. Even, soft, frontal lighting with no cast shadows and no glow halos. Transparent background, the whole object in frame, no ground, no text, no border.',
  background: `A wide backdrop seen straight on, filling the whole frame edge to edge, the pavement along the bottom sixth of the image and the street running off the frame left and right. ${FLAT_LIGHT} No people, no border.`,
  portrait: 'A dialogue portrait: head and shoulders, three-quarter view, filling the frame, more detail in the face. Even, soft, frontal lighting with no rim light. Transparent background, no text, no border.',
};

/** A background that is a room: the same flat, side-on framing as a street, with the floor where the pavement would be. */
const INTERIOR_NOTE = `A wide room seen straight on from the side, like a stage set: the back wall fills the frame, the floor runs along the bottom sixth of the image, and the room continues past the left and right edges. Drawn at the game's scale: a doorway is about two fifths of the image height, and a standing adult is a little taller than a doorway. ${FLAT_LIGHT} No people, no border.`;

/**
 * A recipe's scale is how big people are in its place against the game's standard framing: 0.6 is the camera pulled
 * back, so a standing adult fills 27% of the image height instead of 44%, and more of the place shows around them.
 */
const pct = (f) => `${Math.round(f * 100)}%`;
function frameNote(r, look) {
  let note = r.kind === 'background' && r.interior ? INTERIOR_NOTE : KIND_NOTES[r.kind];
  if (r.kind !== 'background') return note;
  const s = r.scale ?? 1;
  if (s !== 1) {
    note = note.replace('Drawn at the game\'s scale: a doorway is about two fifths of the image height, and a standing adult is a little taller than a doorway.', '');
    note += ` Seen from further back than a close stage set: a standing adult is about ${pct(0.44 * s)} of the image height and a doorway a little taller, with plenty of the place above and around them.`;
  }
  return look === 'vector' ? note.replace(FLAT_LIGHT, PAINTED_LIGHT) : note;
}

/** A character that will be cut into parts and animated needs every limb clear of the body. */
const RIG_POSE = 'A neutral standing pose for animation: arms hanging relaxed and slightly away from the body, hands empty and open, legs straight and slightly apart so both are fully visible, nothing held and nothing crossing the body.';

/**
 * What to draw, in the view it is drawn for: raw view from the recipe's prompt; the Concierge's view of something real
 * (view "concierge") from its concierge description, which then has to say everything there is to see.
 */
export function generationPrompt(r, look = r.look ?? 'pixel', view = r.exists === 'concierge' ? 'concierge' : 'raw') {
  const augmented = view === 'concierge' && r.exists !== 'concierge';
  const world = r.exists === 'concierge'
    ? `This does not exist: the city AI made it up and shows it in everyone's eye. Its world is ${conciergeWorld(r)}`
    : augmented ? worldOf(r, 'concierge') : rawWorld(r, look);
  return `${look ? `${LOOKS[look]} ` : ''}${HOUSE_STYLE} ${r.framing ?? frameNote(r, look)}${r.rig ? ` ${RIG_POSE}` : ''} ${world} Subject: ${augmented ? r.concierge : r.prompt}`;
}

/** Put in front of the prompt when a layout image goes first: it sets the composition, the references the rendering. */
export const LAYOUT_NOTE = 'The first attached image is the layout to follow: keep its composition and every object in its place, shape and size, but paint it over completely, with far more detail, in the style and world described below. Where it is only a blur, continue the scene naturally.';
/** The same for vector art, which a detailed layout must lose detail to reach. */
const LAYOUT_NOTE_VECTOR = 'The first attached image is the layout to follow: keep its composition and every object in its place, shape and size, but redraw it completely in the flat vector style and the world described below, simplifying its detail into a few clean flat shapes. Where it is only a blur, continue the scene naturally.';
export const layoutNote = (look) => (look === 'vector' ? LAYOUT_NOTE_VECTOR : LAYOUT_NOTE);

/** Put in front of the Concierge variant's prompt when references go with it. */
export const VARIANT_REFERENCES_NOTE = 'The first attached image is the one to edit. The other attached images are style references for the augmented view: match their rendering, palette and mood, but not their layout, their objects or their people.';
export const LAYOUT_REFERENCES_NOTE = 'The other attached images are style references for this game: match their rendering, palette, contrast, mood and level of detail, but not their layout, their objects or their people.';

/** Put in front of the prompt when reference images go with it. */
export const REFERENCE_NOTE = 'The attached images are style references for this game: match their rendering, palette, contrast, mood and level of detail, and keep any character from them that matches the description. Do not copy their layout or lighting: draw only what is described below.';
/** The same for vector art, whose light is its style: take it from the references too. */
export const REFERENCE_NOTE_VECTOR = 'The attached images are style references for this game: match their rendering, palette, contrast, lighting, mood and simplicity exactly. Do not copy their layout or their people: draw only what is described below.';

export function conciergePrompt(r) {
  return [
    'Edit this image into the city AI\'s augmented view of the same subject.',
    'Keep the pose, the framing and the outline exactly the same, aligned pixel for pixel; change only surfaces, colours and details.',
    `The augmented world is ${conciergeWorld(r)}`,
    `Change: ${r.concierge}`,
    r.kind === 'background' ? keepFrame(r) : 'Keep the transparent background and the even frontal lighting.',
  ].join(' ') + keepLook(r);
}

/** The world a view of the asset is in, for edits of an image that is already one view or the other. */
const worldOf = (r, view) => (view === 'concierge' ? `It shows the city AI's augmented view, whose world is ${conciergeWorld(r)}` : rawWorld(r));

/** Re-dress the picked image of one view: the same picture, every outline in place, its surfaces changed as asked. */
/**
 * For a recipe whose references are the character's own model sheet (`referenceNote: "character"`): the references
 * are who to draw, not only how.
 */
export const CHARACTER_SHEET_NOTE = 'The attached images are the model sheet of the character to draw: keep her face, hair, body, proportions, eye device and clothing as they appear there, in their rendering, palette and level of detail. Where the description below differs from them, the description wins. Draw only the one figure described, not a sheet, and no text.';
export const CHARACTER_REDRESS_NOTE = 'The first attached image is the one to edit. The other attached images show this same character in the view to draw: match how she looks there, her face, hair, eye device, colours and rendering, but keep the pose, framing and outline of the first image.';

/** Put in front of a re-dress's prompt when references go with it. */
export const REDRESS_REFERENCES_NOTE = 'The first attached image is the one to edit. The other attached images are style references for the result: match their rendering, palette, contrast, lighting and mood, but not their layout, their objects or their people.';

export function redressPrompt(r, view, change) {
  return [
    'Edit this image. Keep the layout, the framing and every outline exactly the same, aligned pixel for pixel, and every object where it is; change only surfaces, materials, wear, colours and details.',
    worldOf(r, view),
    `Change: ${change}`,
    r.kind === 'background' ? keepFrame(r) : 'Keep the transparent background and the even frontal lighting.',
  ].join(' ') + keepLook(r);
}

/** Paint the rest of the frame around a picture placed in it: more of the same place, in the picture's own style. */
export function extendPrompt(r, view) {
  return [
    `Extend this picture into the transparent area of the mask: continue the same ${r.interior ? 'room' : 'street'} outward naturally, with more sky and buildings above and more of the wet ground below, at the same scale and in exactly the same style, colours, lighting, contrast and level of detail as the picture.`,
    'Keep everything that is already there exactly as it is. No new people, no text, no captions, no border.',
    worldOf(r, view),
  ].join(' ') + keepLook(r);
}

/** Paint the new edges around a set that was shrunk to the characters' scale: more of the same place, nothing new in it. */
export function reframePrompt(r, view) {
  return [
    `Extend this picture into the transparent area of the mask: continue the same ${r.interior ? 'room' : 'place'} outward naturally, with more of its walls, ceiling, floor and fittings, at the same scale and in exactly the same style, colours, flat lighting and level of detail.`,
    'Keep everything that is already there. No people.',
    worldOf(r, view),
  ].join(' ') + keepLook(r);
}
