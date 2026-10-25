// The sounds' loudness ramps: a bed that holds at one level must not be handed a fresh ramp every frame (that stutters a
// phone's audio thread). These tests fake the sliver of Web Audio the Sounds class touches and count the ramps.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sounds, type Layer } from './sound';

/** A gain param that records every ramp and value set, so a test can count them. */
class FakeParam {
  value = 0;
  ramps: number[] = [];
  cancelScheduledValues = vi.fn();
  setValueAtTime = vi.fn((v: number) => { this.value = v; return this; });
  linearRampToValueAtTime = vi.fn((v: number) => { this.value = v; this.ramps.push(v); return this; });
}

class FakeGain {
  gain = new FakeParam();
  connect = vi.fn((n: unknown) => n);
}

class FakeSource {
  buffer: unknown = null;
  loop = false;
  playbackRate = { value: 1 };
  connect = vi.fn((n: unknown) => n);
  start = vi.fn();
  stop = vi.fn();
}

/** Enough of an AudioContext for setLayer/frameLayers: a clock, gains and sources. */
class FakeCtx {
  currentTime = 0;
  destination = {};
  createGain = vi.fn(() => new FakeGain());
  createBufferSource = vi.fn(() => new FakeSource());
}

/** A Sounds with a fake context, master and one decoded buffer for every layer, ready for setLayer. */
function readied(): { s: Sounds; ctx: FakeCtx; voice: (l: Layer) => FakeGain } {
  const s = new Sounds();
  const ctx = new FakeCtx();
  const inner = s as unknown as {
    ctx: FakeCtx; master: FakeGain; buffers: Map<string, unknown>; voices: Map<Layer, { gain: FakeGain }>;
  };
  inner.ctx = ctx;
  inner.master = new FakeGain();
  // every file decodes to a truthy buffer, so a layer can start
  inner.buffers = { get: () => ({}), set: () => undefined } as unknown as Map<string, unknown>;
  return { s, ctx, voice: (l) => inner.voices.get(l)!.gain };
}

describe('layer ramps', () => {
  let r: ReturnType<typeof readied>;
  beforeEach(() => { r = readied(); });

  it('ramps once when a bed starts, and holds without rescheduling', () => {
    r.s.setLayer('bed-city', 1);
    r.s.frameLayers();
    const g = r.voice('bed-city');
    expect(g.gain.ramps.length).toBe(1); // came in

    // many more frames at the very same level: no new ramp
    for (let i = 0; i < 120; i++) { r.s.setLayer('bed-city', 1); r.s.frameLayers(); }
    expect(g.gain.ramps.length).toBe(1);
  });

  it('ramps again only when the wanted level changes', () => {
    const g = r.voice.bind(null);
    r.s.setLayer('lift-move', 0.5); r.s.frameLayers();
    r.s.setLayer('lift-move', 0.5); r.s.frameLayers();
    expect(g('lift-move').gain.ramps.length).toBe(1);
    r.s.setLayer('lift-move', 0.9); r.s.frameLayers(); // changed → one more
    expect(g('lift-move').gain.ramps.length).toBe(2);
  });

  it('fades a layer out once when it is no longer asked for', () => {
    r.s.setLayer('dryer-air', 1); r.s.frameLayers();
    const g = r.voice('dryer-air');
    expect(g.gain.ramps.at(-1)).toBeGreaterThan(0);
    // stop asking: it should ramp to 0 once, then stay
    r.s.frameLayers();
    r.s.frameLayers();
    expect(g.gain.ramps.at(-1)).toBe(0);
    const n = g.gain.ramps.length;
    r.s.frameLayers();
    expect(g.gain.ramps.length).toBe(n); // already at 0, no churn
  });
});
