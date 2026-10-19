// The camera: where it wants to be in a scene, and how it follows there. The game and the scene editor share it.

import { NW } from '../engine/renderer';

/** What the camera needs to know of a scene. */
export interface CameraScene {
  size: [number, number];
  /** In a scene no wider than the screen: how far it moves each way as the hero walks from one end to the other. */
  drift?: number;
  walk: { x0: number; x1: number };
}

/**
 * Where the camera wants to be, in level pixels from the scene's start. Across a scene wider than the screen: the hero
 * in the middle, the scene's ends never past the screen's. In one no wider: a little way toward her, the scene's drift at
 * the ends of the walk line and none in the middle; each layer then moves at its own parallax. `still` keeps it there,
 * for players who asked for less motion.
 */
export function cameraTarget(scene: CameraScene, heroX: number, still = false): number {
  if (scene.size[0] > NW) return Math.max(0, Math.min(scene.size[0] - NW, heroX - NW / 2));
  const drift = still ? 0 : scene.drift ?? 0, { x0, x1 } = scene.walk;
  return drift && x1 > x0 ? drift * Math.max(-1, Math.min(1, (heroX - (x0 + x1) / 2) / ((x1 - x0) / 2))) : 0;
}

/**
 * Follows its target: briskly across a wide scene, gently in one that only drifts. It moves by fractions of a pixel, so
 * a slow camera glides (the renderer puts pixel art on whole pixels), and settles: an easing that never quite arrives
 * would keep the layers creeping by fractions of a pixel.
 */
export class Camera {
  x = 0;

  /** At the target at once, as on arriving in a scene. */
  jump(target: number): void {
    this.x = target;
  }

  follow(target: number, dt: number, wide: boolean): number {
    this.x += (target - this.x) * Math.min(1, dt * (wide ? 5 : 1.5));
    if (Math.abs(target - this.x) < 0.01) this.x = target;
    return this.x;
  }
}
