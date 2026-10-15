// The house style, written into every request so separate generations look like one game.

export const HOUSE_STYLE = [
  'High-resolution pixel art for a 2D adventure game, painterly and detailed, with clean pixel clusters.',
  'Adult noir mood in a rain-soaked future city. Realistic proportions, a clear readable silhouette.',
  'Even, soft, frontal lighting with no cast shadows, no rim light and no glow halos: the game lights the sprite itself.',
  'Transparent background. The whole subject in frame with a little space around it, nothing cut off, no ground, no text, no border.',
].join(' ');

/** The two worlds: what is really there, and what the Concierge shows everyone. Its world must look just as real. */
const RAW_WORLD = [
  'This is the raw, unedited world: poisonous, cheap and post-Soviet.',
  'Concrete panel blocks, cheap plastic, corrugated metal, rust, peeling paint, stained tiles, worn and patched clothes.',
  'Cold, drab, faded colours: concrete grey, steel and slate blue-grey, dirty white tile. Nothing warm. The only bright colours are on machines: indicator lights, old screens.',
].join(' ');
const CONCIERGE_WORLD = 'cool and sexy: sleek, glossy, expensive and seductive, with cyan, violet and magenta neon accents. It must look completely real and physical, never like a hologram or a projection.';

const KIND_NOTES = {
  character: 'One full-length figure standing, seen from the side in a three-quarter view facing right, feet at the bottom of the frame.',
  prop: 'One object on its own, seen straight from the front at eye level, as it would stand on a street.',
  background: 'A wide flat backdrop layer, seen straight on, edges running off the frame left and right.',
  portrait: 'A dialogue portrait: head and shoulders, three-quarter view, filling the frame, more detail in the face.',
};

export function generationPrompt(r) {
  const world = r.exists === 'concierge'
    ? `This does not exist: the city AI made it up and shows it in everyone's eye. Its world is ${CONCIERGE_WORLD}`
    : RAW_WORLD;
  return `${HOUSE_STYLE} ${KIND_NOTES[r.kind]} ${world} Subject: ${r.prompt}`;
}

export function conciergePrompt(r) {
  return [
    'Edit this image into the city AI\'s augmented view of the same subject.',
    'Keep the pose, the framing and the outline exactly the same, aligned pixel for pixel; change only surfaces, colours and details.',
    `The augmented world is ${CONCIERGE_WORLD}`,
    `Change: ${r.concierge}`,
    'Keep the transparent background and the even frontal lighting.',
  ].join(' ');
}
