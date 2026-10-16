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
  'Cold, drab, faded colours: concrete grey, steel and slate blue-grey, dirty white tile. Nothing warm. The only bright colours are small lights on machines: indicators, old screens.',
].join(' ');
const CONCIERGE_WORLD = [
  'cool and glamorous: sleek, glossy, expensive and stylish, with cyan, violet and magenta neon accents.',
  'People are clean, healthy, fit and good-looking, in stylish, well-fitted clothes.',
  'Electronics that people use look futuristic: smooth white shells and blue light.',
  'Everyone wears a partial helmet that covers one whole eye: here a smooth, seamless white shell with a soft blue light.',
  'Signs and screens are in English, with some Chinese and Japanese, like an international city.',
  'It must look completely real and physical, never like a hologram or a projection.',
].join(' ');

/** What to draw and how to frame it. The game lights everything itself, so the art is lit flat. */
const KIND_NOTES = {
  character: 'One full-length figure standing, seen from the side in a three-quarter view facing right, feet at the bottom of the frame. Even, soft, frontal lighting with no cast shadows, no rim light and no glow halos. Transparent background, the whole figure in frame with a little space around it, no ground, no text, no border.',
  prop: 'One object on its own, seen straight from the front at eye level, as it would stand on a street. Even, soft, frontal lighting with no cast shadows and no glow halos. Transparent background, the whole object in frame, no ground, no text, no border.',
  background: 'A wide backdrop seen straight on, filling the whole frame edge to edge, the pavement along the bottom sixth of the image and the street running off the frame left and right. Flat, even, neutral lighting like an overcast day, no shadows and nothing glowing: this is the colour of every surface, and the game adds the night and its lights. No people, no border.',
  portrait: 'A dialogue portrait: head and shoulders, three-quarter view, filling the frame, more detail in the face. Even, soft, frontal lighting with no rim light. Transparent background, no text, no border.',
};

/** A character that will be cut into parts and animated needs every limb clear of the body. */
const RIG_POSE = 'A neutral standing pose for animation: arms hanging relaxed and slightly away from the body, hands empty and open, legs straight and slightly apart so both are fully visible, nothing held and nothing crossing the body.';

export function generationPrompt(r, look = r.look ?? 'pixel') {
  const world = r.exists === 'concierge'
    ? `This does not exist: the city AI made it up and shows it in everyone's eye. Its world is ${CONCIERGE_WORLD}`
    : RAW_WORLD;
  return `${look ? `${LOOKS[look]} ` : ''}${HOUSE_STYLE} ${KIND_NOTES[r.kind]}${r.rig ? ` ${RIG_POSE}` : ''} ${world} Subject: ${r.prompt}`;
}

/** Put in front of the prompt when reference images go with it. */
export const REFERENCE_NOTE = 'The attached images are style references for this game: match their rendering, palette, contrast, mood and level of detail, and keep any character from them that matches the description. Do not copy their layout or lighting: draw only what is described below.';

export function conciergePrompt(r) {
  return [
    'Edit this image into the city AI\'s augmented view of the same subject.',
    'Keep the pose, the framing and the outline exactly the same, aligned pixel for pixel; change only surfaces, colours and details.',
    `The augmented world is ${CONCIERGE_WORLD}`,
    `Change: ${r.concierge}`,
    r.kind === 'background'
      ? 'Keep the full frame, the layout and the flat, even lighting; only neon signs and screens may glow.'
      : 'Keep the transparent background and the even frontal lighting.',
  ].join(' ');
}
