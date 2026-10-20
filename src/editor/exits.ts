// Making an exit's way back. What is missing here is made at once, a change to undo like any other. What is missing in
// the other scene is made by saving this one and opening that one with it made, as an unsaved change there to place,
// undo or save.

import { NW } from '../engine/renderer';
import { openScene, save, syncScroll, updatePlay } from './files';
import { alongWalk, joinOf, makeHere, makeThere, missingThere } from './join';
import { ed, redraw, remember, setStatus, snapshot } from './state';

export async function joinUp(i: number): Promise<void> {
  const here = ed.file, h = here.hotspots[i], there = h?.go ? ed.others[h.go.scene] : undefined;
  if (!h?.go || !there || h.go.scene === here.id) return;
  const j = joinOf(h, here, there), us = here.name || here.id, them = there.name || there.id, before = snapshot();
  const madeHere = makeHere(h, here, j);
  remember(before);
  if (madeHere) updatePlay();
  if (!missingThere(j)) {
    redraw.overlay();
    redraw.side();
    return setStatus(madeHere ? `Made “${j.backTo}” here, where the way back from ${them} arrives` : `Arrives at “${j.arrive}” in ${them}`);
  }
  // this scene saved first, so leaving it loses nothing
  await save();
  if (ed.dirty) return;
  await openScene(there.id);
  // worked out again on the scene as it is on disk
  const start = snapshot(), made = makeThere(h, here, ed.file, joinOf(h, here, ed.file));
  remember(start);
  ed.sel = made.madeBack || !made.madeArrive ? { kind: 'hotspot', i: made.back } : { kind: 'spawn', id: j.arrive };
  // the camera over it
  ed.camX = Math.max(0, Math.min(ed.file.size[0] - NW, alongWalk(ed.file.hotspots[made.back], ed.file) - NW / 2));
  syncScroll();
  updatePlay();
  redraw.overlay();
  redraw.side();
  const parts = [made.madeBack && `the way back to ${us}`, made.madeArrive && `“${j.arrive}”, the place she arrives at`].filter(Boolean);
  setStatus(`${parts.length ? `Made ${parts.join(' and ')}` : `The way back to ${us} arrives at “${j.backTo}” there`}. Place ${parts.length > 1 ? 'them' : 'it'}, then save`);
}
