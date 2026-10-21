// The game's input: the pointer and the keyboard, turned into what the session does. A finger and a mouse work the same
// way, and nothing needs a mouse to hover: tap to walk, hold down far from her outdoors to run, choose a verb at the ball
// and slide over the scene.
// Arrows or A/D walk (with Shift, run), E switches view, L opens the look panel, Q cycles quality, number keys answer in a
// conversation, and on the dev server ` opens the scene editor.

import type { Game } from './game';

export interface InputExtras {
  /** E switches view even before the story allows it (on the dev server, to look at both views while building). */
  forceView: boolean;
  /** Q: the next quality tier. */
  cycleQuality(): void;
  /** ` (the key left of 1): the scene editor on this scene. Only where there is one: on the dev server. */
  openEditor?: () => void;
}

const walkDir = (k: string): 'left' | 'right' | null => (k === 'ArrowLeft' || k === 'a' || k === 'A' ? 'left' : k === 'ArrowRight' || k === 'd' || k === 'D' ? 'right' : null);

export function bindInput(canvas: HTMLCanvasElement, game: Game, extras: InputExtras): void {
  // the finger is kept while it is down, so sliding over the buttons or off the edge still reaches the scene
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    canvas.setPointerCapture?.(e.pointerId);
    game.pointerDown(e.clientX, e.clientY, e.button);
  });
  canvas.addEventListener('pointermove', (e) => game.pointerMove(e.clientX, e.clientY));
  canvas.addEventListener('pointerup', () => game.pointerUp());
  canvas.addEventListener('pointercancel', () => game.pointerCancel());
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && e.buttons === 0) game.pointerCancel(); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || game.inputLocked) return;
    if (e.key === 'l' || e.key === 'L') return game.look.toggle();
    // the keys a slider or list uses itself stay with it: arrows move a look slider, not the hero; E, Q and L still work
    if (e.target instanceof Element && e.target.closest('.look') && /^(Arrow|Home|End|Page)/.test(e.key)) return;
    if (game.talk.key(e.key)) return e.preventDefault();
    if (!game.talk.open && game.hud.key(e.key)) return e.preventDefault();
    const dir = walkDir(e.key);
    if (dir && !game.talk.open) { game.walkKey(dir, true, e.shiftKey); return e.preventDefault(); }
    if (e.key === 'e' || e.key === 'E') game.toggleView(extras.forceView);
    if (e.key === 'q' || e.key === 'Q') extras.cycleQuality();
    if ((e.key === '`' || e.code === 'Backquote') && extras.openEditor) { e.preventDefault(); extras.openEditor(); }
  });
  document.addEventListener('keyup', (e) => {
    const dir = walkDir(e.key);
    if (dir) game.walkKey(dir, false, e.shiftKey);
  });
  window.addEventListener('blur', () => game.releaseKeys());
}
