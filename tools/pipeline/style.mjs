// The house style, written into every request so separate generations look like one game.

/** How it is drawn: "pixel" asks the model for pixel art; "paint" asks for a crisp painting, which the build pixelates. */
export const LOOKS = {
  pixel: 'High-resolution pixel art for a 2D adventure game, painterly and detailed, with clean pixel clusters.',
  paint: 'A detailed digital painting for a 2D adventure game: crisp edges, clean readable shapes and controlled painterly shading. Not pixel art.',
};

export const HOUSE_STYLE = 'Adult noir mood in a rain-soaked future city. Realistic proportions, a clear readable silhouette.';

/**
 * The two worlds: what is really there, and what the Concierge shows everyone. Its world must look just as real.
 * People, and the electronics they use, differ the most.
 */
const RAW_WORLD = [
  'This is the raw, unedited world: poisonous, cheap and post-Soviet.',
  'Concrete panel blocks, cheap plastic, corrugated metal, rust, peeling paint, stained tiles.',
  'People look sick, pale and dull, out of shape and under-trained, in cheap, trashy, worn-out clothes.',
  'Electronics that people use are grey and steampunk-like: dull grey metal casings, exposed valves, tubes, gauges, cables and rivets, patched together. No brass.',
  'Everyone wears a partial helmet that covers one whole eye: here a heavy, grey, steampunk-like device of riveted metal plates, a round lens and small tubes.',
  'Hardly any text: old signs have peeled away or faded almost to nothing, and what little lettering survives is faint, in Russian or an invented script.',
  'Muted, faded colours that lean cold: concrete grey, slate blue-grey, dirty white tile, rust, and peeling paint in washed-out greens, browns and reds. Nothing bright or saturated, except small lights on machines: indicators, old screens.',
].join(' ');
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

/** What to draw and how to frame it. The game lights everything itself, so the art is lit flat. */
const KIND_NOTES = {
  character: 'One full-length figure standing, seen from the side in a three-quarter view facing right, feet at the bottom of the frame. Even, soft, frontal lighting with no cast shadows, no rim light and no glow halos. Transparent background, the whole figure in frame with a little space around it, no ground, no text, no border.',
  prop: 'One object on its own, seen straight from the front at eye level, as it would stand on a street. Even, soft, frontal lighting with no cast shadows and no glow halos. Transparent background, the whole object in frame, no ground, no text, no border.',
  background: 'A wide backdrop seen straight on, filling the whole frame edge to edge, the pavement along the bottom sixth of the image and the street running off the frame left and right. Flat, even, neutral lighting like an overcast day, no shadows and nothing glowing: this is the colour of every surface, and the game adds the night and its lights. No people, no border.',
  portrait: 'A dialogue portrait: head and shoulders, three-quarter view, filling the frame, more detail in the face. Even, soft, frontal lighting with no rim light. Transparent background, no text, no border.',
};

/** A background that is a room: the same flat, side-on framing as a street, with the floor where the pavement would be. */
const INTERIOR_NOTE = 'A wide room seen straight on from the side, like a stage set: the back wall fills the frame, the floor runs along the bottom sixth of the image, and the room continues past the left and right edges. Drawn at the game's scale: a doorway is about two fifths of the image height, and a standing adult is a little taller than a doorway. Flat, even, neutral lighting like an overcast day, no shadows and nothing glowing: this is the colour of every surface, and the game adds the night and its lights. No people, no border.';

/** A character that will be cut into parts and animated needs every limb clear of the body. */
const RIG_POSE = 'A neutral standing pose for animation: arms hanging relaxed and slightly away from the body, hands empty and open, legs straight and slightly apart so both are fully visible, nothing held and nothing crossing the body.';

export function generationPrompt(r, look = r.look ?? 'pixel') {
  const world = r.exists === 'concierge'
    ? `This does not exist: the city AI made it up and shows it in everyone's eye. Its world is ${conciergeWorld(r)}`
    : RAW_WORLD;
  return `${look ? `${LOOKS[look]} ` : ''}${HOUSE_STYLE} ${r.framing ?? (r.kind === 'background' && r.interior ? INTERIOR_NOTE : KIND_NOTES[r.kind])}${r.rig ? ` ${RIG_POSE}` : ''} ${world} Subject: ${r.prompt}`;
}

/** Put in front of the prompt when a layout image goes first: it sets the composition, the references the rendering. */
export const LAYOUT_NOTE = 'The first attached image is the layout to follow: keep its composition and every object in its place, shape and size, but paint it over completely, with far more detail, in the style and world described below. Where it is only a blur, continue the scene naturally.';
export const LAYOUT_REFERENCES_NOTE = 'The other attached images are style references for this game: match their rendering, palette, contrast, mood and level of detail, but not their layout.';

/** Put in front of the prompt when reference images go with it. */
export const REFERENCE_NOTE = 'The attached images are style references for this game: match their rendering, palette, contrast, mood and level of detail, and keep any character from them that matches the description. Do not copy their layout or lighting: draw only what is described below.';

export function conciergePrompt(r) {
  return [
    'Edit this image into the city AI\'s augmented view of the same subject.',
    'Keep the pose, the framing and the outline exactly the same, aligned pixel for pixel; change only surfaces, colours and details.',
    `The augmented world is ${conciergeWorld(r)}`,
    `Change: ${r.concierge}`,
    r.kind === 'background'
      ? 'Keep the full frame, the layout and the flat, even lighting; only neon signs and screens may glow.'
      : 'Keep the transparent background and the even frontal lighting.',
  ].join(' ');
}

/** The world a view of the asset is in, for edits of an image that is already one view or the other. */
const worldOf = (r, view) => (view === 'concierge' ? `It shows the city AI's augmented view, whose world is ${conciergeWorld(r)}` : RAW_WORLD);

/** Re-dress the picked image of one view: the same picture, every outline in place, its surfaces changed as asked. */
export function redressPrompt(r, view, change) {
  return [
    'Edit this image. Keep the layout, the framing and every outline exactly the same, aligned pixel for pixel, and every object where it is; change only surfaces, materials, wear, colours and details.',
    worldOf(r, view),
    `Change: ${change}`,
    r.kind === 'background' ? 'Keep the full frame and the flat, even lighting; only neon signs and screens may glow.' : 'Keep the transparent background and the even frontal lighting.',
  ].join(' ');
}

/** Paint the new edges around a set that was shrunk to the characters' scale: more of the same place, nothing new in it. */
export function reframePrompt(r, view) {
  return [
    `Extend this picture into the transparent area of the mask: continue the same ${r.interior ? 'room' : 'place'} outward naturally, with more of its walls, ceiling, floor and fittings, at the same scale and in exactly the same style, colours, flat lighting and level of detail.`,
    'Keep everything that is already there. No people.',
    worldOf(r, view),
  ].join(' ');
}
