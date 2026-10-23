// Scenes on their way in and out of memory. The scene she is in and the one she came from stay on the GPU, so going
// back through a door is only the fade; the files of the scenes her ways out lead to are fetched while she is here, so
// going on is the fade and their decoding, not a download; every other scene is let go, so a phone's memory holds the
// scenes near her and not every one she has been to.

import type { GL } from '../engine/gl';
import { fetchScene, freeScene, loadSceneFile, makeScene, type FetchedScene, type Scene, type SceneFile, type WorldFile } from './scenefile';

/** The scenes a scene's ways out lead to: its doors and the ends of its street. */
export const neighbours = (file: SceneFile): string[] => [...new Set(file.hotspots.flatMap((h) => [...(h.go && h.go.scene !== file.id ? [h.go.scene] : []), ...(h.zoom ? [h.zoom] : [])]))];

/** What is kept as she arrives in `here` from `from`: those two on the GPU, and the files of where she can go next. */
export function keepFor(here: SceneFile, from?: string): { gpu: Set<string>; files: Set<string> } {
  const gpu = new Set([here.id, ...(from && from !== here.id ? [from] : [])]);
  return { gpu, files: new Set([...gpu, ...neighbours(here)]) };
}

export class Scenes {
  private readonly files = new Map<string, Promise<SceneFile>>();
  private readonly fetched = new Map<string, FetchedScene>();
  private readonly built = new Map<string, Promise<Scene>>();
  /** Scenes let go while one of them was still on screen: freed once it is not. */
  private retired: Scene[] = [];

  constructor(private readonly gl: GL, private readonly assets: string, private readonly world: WorldFile, public bust = '') {}

  /** A scene's file, loaded once. */
  file(id: string): Promise<SceneFile> {
    if (!this.files.has(id)) this.files.set(id, loadSceneFile(this.assets, id));
    return this.files.get(id)!;
  }

  /** A scene on the GPU, ready to show: made from its files fetched ahead, where they were. */
  get(id: string): Promise<Scene> {
    if (!this.built.has(id)) {
      const made = this.file(id).then((file) => {
        const fetched = this.fetched.get(id) ?? fetchScene(this.assets, file, this.bust);
        this.fetched.delete(id);
        return makeScene(this.gl, fetched, this.world);
      });
      // a scene that failed to load is tried again the next time
      made.catch(() => { if (this.built.get(id) === made) this.built.delete(id); });
      this.built.set(id, made);
    }
    return this.built.get(id)!;
  }

  /** On the GPU, or on its way there. */
  has(id: string): boolean {
    return this.built.has(id);
  }

  /** Its files fetched ahead, none of it on the GPU: a scene she may go to next. */
  prefetch(id: string): void {
    if (this.built.has(id) || this.fetched.has(id)) return;
    this.file(id).then((file) => {
      if (!this.built.has(id) && !this.fetched.has(id)) this.fetched.set(id, fetchScene(this.assets, file, this.bust));
    }).catch(() => {});
  }

  /** She is in `here`, come from `from`: those two stay on the GPU, where she can go next is fetched, the rest let go. */
  settle(here: Scene, from?: string): void {
    const keep = keepFor(here.file, from);
    for (const [id, p] of this.built) {
      if (keep.gpu.has(id)) continue;
      this.built.delete(id);
      p.then((s) => freeScene(this.gl, s)).catch(() => {});
    }
    for (const id of [...this.fetched.keys()]) if (!keep.files.has(id)) this.fetched.delete(id);
    this.retired = this.retired.filter((s) => (s === here ? true : (freeScene(this.gl, s), false)));
    for (const id of neighbours(here.file)) this.prefetch(id);
  }

  /**
   * Art or scene files changed on the dev server: every scene is made again from its files as it is needed. The one on
   * screen is freed once another has taken its place.
   */
  reset(bust: string, onScreen?: Scene): void {
    this.bust = bust;
    for (const p of this.built.values()) p.then((s) => { if (s === onScreen) this.retired.push(s); else freeScene(this.gl, s); }).catch(() => {});
    this.built.clear();
    this.fetched.clear();
    this.files.clear();
  }
}
