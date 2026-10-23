// What a story's line has the game do before it is said (dialogue.ts names the commands), one command after another.
// The game gives a Stage: how she walks, turns, changes and travels, how the screen fades and the view switches.

import type { Command } from './dialogue';

export interface Stage {
  /** She walks to a thing's place (by its id) or to x, and the line waits until she is there. */
  walk(to: string): Promise<void>;
  face(dir: 1 | -1): void;
  /** She changes, behind a fade: her clothes, or a projection. */
  wear(outfit: string): Promise<void>;
  /** She goes to a scene, arriving at a place there (or its first); the conversation goes on there. */
  go(scene: string, spawn?: string): Promise<void>;
  /** The screen goes dark for so many seconds, and comes back. */
  fade(seconds: number): Promise<void>;
  view(raw: boolean): void;
  sleep(ms: number): Promise<void>;
  /** A close-up over the dimmed scene (a picture in closeups/, as the view on screen has it), or none. */
  closeup(name: string | null): Promise<void>;
  /** An old machine's screen (terminals/<id>.json), until she switches it off. */
  terminal(id: string): Promise<void>;
  /** She calls the Concierge, from a home, once this conversation is over. */
  call(): void;
}

export async function direct(commands: Command[], stage: Stage): Promise<void> {
  for (const c of commands) {
    if (c.name === 'walk') await stage.walk(c.arg);
    else if (c.name === 'face') stage.face(c.arg === 'left' ? -1 : 1);
    else if (c.name === 'wear') await stage.wear(c.arg);
    else if (c.name === 'go') {
      const [scene, spawn] = c.arg.split('/').map((v) => v.trim());
      await stage.go(scene, spawn || undefined);
    } else if (c.name === 'fade') await stage.fade(Number(c.arg) || 0.6);
    else if (c.name === 'view') stage.view(c.arg === 'raw');
    else if (c.name === 'wait') await stage.sleep((Number(c.arg) || 1) * 1000);
    else if (c.name === 'closeup') await stage.closeup(c.arg && c.arg !== 'off' ? c.arg : null);
    else if (c.name === 'terminal') await stage.terminal(c.arg);
    else if (c.name === 'call') stage.call();
  }
}
