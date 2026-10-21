import { describe, expect, it } from 'vitest';
import { commandOf, type Command } from './dialogue';
import { direct, type Stage } from './direct';

describe('a story line\'s commands', () => {
  it('are done one after another, each waited for, with their arguments read', async () => {
    const done: string[] = [];
    const later = (s: string) => new Promise<void>((r) => setTimeout(() => { done.push(s); r(); }, 5));
    const stage: Stage = {
      walk: (to) => later(`walk ${to}`), face: (d) => void done.push(`face ${d}`), wear: (o) => later(`wear ${o}`),
      go: (scene, spawn) => later(`go ${scene} ${spawn ?? '-'}`), fade: (s) => later(`fade ${s}`), view: (raw) => void done.push(`view ${raw}`),
      sleep: (ms) => later(`sleep ${ms}`), closeup: (name) => later(`closeup ${name ?? 'off'}`), terminal: (id) => later(`terminal ${id}`),
    };
    const tags = ['walk: desk', 'face: left', 'wear: clothes', 'go: street / from-radio', 'go: home', 'fade: 1.2', 'view: raw', 'wait: 0.5', 'closeup: station', 'closeup: off', 'terminal: relay7'];
    await direct(tags.map(commandOf).filter((c): c is Command => !!c), stage);
    expect(done).toEqual(['walk desk', 'face -1', 'wear clothes', 'go street from-radio', 'go home -', 'fade 1.2', 'view true', 'sleep 500', 'closeup station', 'closeup off', 'terminal relay7']);
  });
});
