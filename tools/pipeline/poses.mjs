// Pose guides: a grey mannequin in each frame of an animation, in the character's own proportions and place in the
// image, so an image model can draw the character in exactly that pose. One set of key poses serves every human.

import sharp from 'sharp';

/**
 * The walk, 8 frames starting as the near leg touches down in front. Classic keys: contact, down, passing, up, then
 * the same for the far leg. Degrees; positive swings a hanging limb forward (toward +x). Knee and elbow are relative
 * to the bone above them. The far limbs run four frames behind the near ones.
 */
export const WALK = {
  thigh: [21, 15, 0, -13, -21, -13, 4, 18],
  knee: [-5, -18, -5, -10, -10, -40, -60, -25],
  arm: [-18, -10, 0, 10, 18, 10, 0, -10],
  elbow: [10, 12, 12, 18, 25, 18, 12, 12],
  lean: 3,
};

function rotate([x, y], [px, py], deg) {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), dx = x - px, dy = y - py;
  return [px + c * dx + s * dy, py - s * dx + c * dy];
}

/**
 * The walk is seen closer to profile than a three-quarter standing pose: hips and shoulders are drawn in toward the
 * body's centre line, with each limb moving along with its hip or shoulder, so the legs pass instead of crossing.
 */
function profile(J0) {
  const J = { ...J0 }, pull = (root, chain, centre, keep) => {
    const dx = (J0[root][0] - centre) * (keep - 1);
    for (const n of [root, ...chain]) J[n] = [J0[n][0] + dx, J0[n][1]];
  };
  for (const s of ['Front', 'Back']) {
    pull(`hip${s}`, [`knee${s}`, `ankle${s}`, `toe${s}`], J0.pelvis[0], 0.3);
    pull(`shoulder${s}`, [`elbow${s}`, `wrist${s}`, `hand${s}`], J0.neck[0], 0.45);
  }
  return J;
}

/** Joints for one walk frame: legs from the hips, the upper body leaning about the pelvis, then the feet planted on the ground. */
function walkFrame(J0, k) {
  const J = profile(J0), out = { ...J }, far = (k + 4) % 8, lean = (p) => rotate(p, J.pelvis, -WALK.lean);
  for (const n of ['neck', 'crown', 'shoulderBack', 'elbowBack', 'wristBack', 'handBack', 'shoulderFront', 'elbowFront', 'wristFront', 'handFront']) out[n] = lean(J[n]);
  const leg = (side, f) => {
    const hip = J[`hip${side}`], thigh = WALK.thigh[f], knee = WALK.knee[f];
    out[`knee${side}`] = rotate(J[`knee${side}`], hip, thigh);
    for (const n of [`ankle${side}`, `toe${side}`]) out[n] = rotate(rotate(J[n], hip, thigh), out[`knee${side}`], knee);
  };
  const arm = (side, f) => {
    const sh = out[`shoulder${side}`], a = WALK.arm[f], e = WALK.elbow[f];
    out[`elbow${side}`] = rotate(out[`elbow${side}`], sh, a);
    for (const n of [`wrist${side}`, `hand${side}`]) out[n] = rotate(rotate(out[n], sh, a), out[`elbow${side}`], e);
  };
  // WALK.arm is written for the near arm, already swinging against the near leg
  leg('Front', k); leg('Back', far); arm('Front', k); arm('Back', far);
  // plant: the lowest foot back on the ground line, which brings the body down on the bent knee and up on the straight one
  const ground = Math.max(J.toeFront[1], J.toeBack[1], J.ankleFront[1], J.ankleBack[1]);
  const low = Math.max(out.toeFront[1], out.toeBack[1], out.ankleFront[1], out.ankleBack[1]);
  for (const n of Object.keys(out)) out[n] = [out[n][0], out[n][1] + ground - low];
  return out;
}

/** Standing still, seen from the same side as the walk, so stopping does not jump. */
function idleFrame(J0) {
  const J = profile(J0), lean = (p) => rotate(p, J.pelvis, -1);
  for (const n of ['neck', 'crown', 'shoulderBack', 'elbowBack', 'wristBack', 'handBack', 'shoulderFront', 'elbowFront', 'wristFront', 'handFront']) J[n] = lean(J[n]);
  return J;
}

/** The frames of an animation as joints, and for a walk its stride: how far the body moves in one full cycle. */
export function poses(anim, J) {
  if (anim === 'idle') return { frames: [idleFrame(J)], stride: 0 };
  if (anim !== 'walk') throw new Error(`no poses for "${anim}" yet; there are: idle, walk`);
  const frames = Array.from({ length: 8 }, (_, k) => walkFrame(J, k));
  // the near foot is planted from contact (frame 0) to the far leg's contact (frame 4)
  const stride = 2 * (frames[0].toeFront[0] - frames[4].toeFront[0]);
  return { frames, stride };
}

/** The mannequin for one frame, as a PNG: far limbs dark, near limbs light, a nose to show which way it faces. */
export async function guide(P, w, h) {
  const tall = Math.max(P.toeFront[1], P.toeBack[1]) - P.crown[1], u = tall / 100;
  const limb = (a, b, width, fill) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#2a2a30" stroke-width="${width + 6 * u / 4}" stroke-linecap="round"/><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${fill}" stroke-width="${width}" stroke-linecap="round"/>`;
  const legs = (s, fill) => limb(P[`hip${s}`], P[`knee${s}`], 5 * u, fill) + limb(P[`knee${s}`], P[`ankle${s}`], 3.8 * u, fill) + limb(P[`ankle${s}`], P[`toe${s}`], 3 * u, fill);
  const arms = (s, fill) => limb(P[`shoulder${s}`], P[`elbow${s}`], 3.3 * u, fill) + limb(P[`elbow${s}`], P[`wrist${s}`], 2.8 * u, fill) + limb(P[`wrist${s}`], P[`hand${s}`], 2.4 * u, fill);
  const torso = [P.shoulderBack, P.shoulderFront, P.hipFront, P.hipBack].map((p) => p.join(',')).join(' ');
  const head = [(P.neck[0] + P.crown[0]) / 2, P.crown[1] + (P.neck[1] - P.crown[1]) * 0.42], hr = (P.neck[1] - P.crown[1]) * 0.36;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#ffffff"/>
    ${arms('Back', '#707078')}${legs('Back', '#707078')}
    <polygon points="${torso}" fill="#9a9aa2" stroke="#2a2a30" stroke-width="${1.5 * u}" stroke-linejoin="round"/>
    ${limb(P.neck, [(P.shoulderBack[0] + P.shoulderFront[0]) / 2, (P.shoulderBack[1] + P.shoulderFront[1]) / 2], 3 * u, '#9a9aa2')}
    <ellipse cx="${head[0]}" cy="${head[1]}" rx="${hr * 0.85}" ry="${hr}" fill="#c4c4ca" stroke="#2a2a30" stroke-width="${1.5 * u}"/>
    <polygon points="${head[0] + hr * 0.8},${head[1] - hr * 0.1} ${head[0] + hr * 1.15},${head[1] + hr * 0.15} ${head[0] + hr * 0.8},${head[1] + hr * 0.3}" fill="#c4c4ca" stroke="#2a2a30" stroke-width="${u}"/>
    ${legs('Front', '#d6d6dc')}${arms('Front', '#d6d6dc')}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** The prompt that goes with the character and one guide. */
export const animatePrompt = (what) => [
  'The first image shows a game character. The second image is a grey mannequin in one frame of an animation.',
  `Draw the same character in exactly the mannequin's pose: the same face, hair, clothes, colours, proportions and size, at exactly the mannequin's position and height in the frame, ${what}.`,
  'Lighter limbs are nearer to the viewer; darker limbs are farther away, partly behind the body. Clothes and hair move naturally with the pose.',
  'Keep the rendering of the first image: the same detail and palette, and even, soft, frontal lighting with no cast shadows.',
  'Transparent background, no ground, no text, and no mannequin.',
].join(' ');
