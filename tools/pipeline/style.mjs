// The house style, written into every request so separate generations look like one game.

export const HOUSE_STYLE = [
  'High-resolution pixel art for a 2D adventure game, painterly and detailed, with clean pixel clusters.',
  'Adult noir mood in a rain-soaked future city. Realistic proportions, a clear readable silhouette.',
  'Muted, grounded colours with small accents. Amber is human-made light; cyan and violet belong to the city AI; red is illegal.',
  'Even, soft, frontal lighting with no cast shadows, no rim light and no glow halos: the game lights the sprite itself.',
  'Transparent background. The whole subject in frame with a little space around it, nothing cut off, no ground, no text, no border.',
].join(' ');

const KIND_NOTES = {
  character: 'One full-length figure standing, seen from the side in a three-quarter view facing right, feet at the bottom of the frame.',
  prop: 'One object on its own, seen straight from the front at eye level, as it would stand on a street.',
  background: 'A wide flat backdrop layer, seen straight on, edges running off the frame left and right.',
  portrait: 'A dialogue portrait: head and shoulders, three-quarter view, filling the frame, more detail in the face.',
};

export function generationPrompt(r) {
  const world = r.exists === 'concierge'
    ? 'This does not exist: the city AI made it up and shows it in everyone\'s eye. Immaculate, flattering and a little too perfect, with cyan and violet accents, yet as solid and believable as a real person.'
    : 'This is the raw, unedited world: real materials, wear and dirt.';
  return `${HOUSE_STYLE} ${KIND_NOTES[r.kind]} ${world} Subject: ${r.prompt}`;
}

export function conciergePrompt(r) {
  return [
    'Edit this image into the city AI\'s dressed-up view of the same subject.',
    'Keep the pose, the framing and the outline exactly the same, aligned pixel for pixel; change only surfaces, colours and details.',
    'In this view everything is immaculate, flattering and a little too perfect, with cyan and violet accents.',
    `Change: ${r.concierge}`,
    'Keep the transparent background and the even frontal lighting.',
  ].join(' ');
}
