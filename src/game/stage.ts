// How a session does what a story's line asks before it is said (direct.ts names the commands): she walks to a thing or
// a point and the line waits until she is there, turns, changes, goes somewhere; the screen fades; the view switches; a
// close-up shows, or a paper is read until she puts it down; an old machine's screen opens; she calls the Concierge.

import type { Stage } from './direct';
import type { Game } from './game';
import { placeIn } from './level';

export function storyStage(g: Game): Stage {
  const stage: Stage = {
    walk: async (to) => {
      const h = g.scene.file.hotspots.find((x) => x.id === to), place = h ? placeIn(h, g.raw) : null;
      const x = place ? place.stand ?? place.rect[0] + place.rect[2] / 2 : Number(to);
      if (!Number.isFinite(x)) return;
      g.directing = true;
      g.controls.goTo(x);
      // until she is there (or gives up, at the end of the walk line)
      const until = performance.now() + 15000;
      while (g.world.moving && performance.now() < until) await stage.sleep(50);
      g.directing = false;
      if (place) g.world.facing = place.face ?? (place.rect[0] + place.rect[2] / 2 >= g.world.heroX ? 1 : -1);
    },
    face: (dir) => { g.world.facing = dir; },
    wear: (outfit) => g.dressing.change(outfit),
    go: async (scene, spawn) => g.ways.go({ scene, spawn: spawn ?? Object.keys((await g.scenes.file(scene)).spawns)[0] }, true, true),
    fade: async (seconds) => {
      g.setup.fade.classList.add('on');
      await stage.sleep(260 + seconds * 1000);
      g.setup.fade.classList.remove('on');
      await stage.sleep(260);
    },
    view: (raw) => { if (raw !== g.raw) g.toggleView(true); },
    sleep: (ms) => new Promise((r) => setTimeout(r, g.setup.fast ? Math.min(ms, 50) : ms)),
    closeup: (name) => g.hud.showCloseup(name),
    terminal: (id) => g.terminal(id),
    call: () => g.co.callSoon(),
    read: (name) => g.hud.readCloseup(name),
  };
  return stage;
}
