// The interface's sounds: a short cue for each thing the HUD does (a tap, her window out of the air, a page, the verbs
// out, the Concierge's chime, her notebook, an old machine's keys), from Kenney's CC0 packs (public/assets/sounds). Played
// through Web Audio, so a tap answers at once. A browser lets nothing sound before the player first touches the game, so
// they are fetched and readied then; with the setting off, nothing sounds.
//
// A tap on any button sounds, unless what it did has a sound of its own: the tap waits a moment, and another cue in that
// moment takes its place. A button can name its own cue (`data-cue`), or none (`data-cue="none"`).

export type Cue =
  | 'tap' | 'choose' | 'verbs-out' | 'verbs-in' | 'window-open' | 'window-close' | 'page' | 'pause' | 'resume' | 'confirm' | 'deny'
  | 'things' | 'hold' | 'inspect' | 'co-open' | 'co-message' | 'co-ask' | 'glitch' | 'book-open' | 'book-close' | 'book-page'
  | 'key' | 'enter' | 'boot';

/** Each cue: its files (one picked at random, or all at once with `together`), how loud, and how much its pitch varies. */
const CUES: Record<Cue, { files: string[]; gain: number; vary?: number; together?: boolean }> = {
  'tap': { files: ['tap'], gain: 0.32, vary: 0.06 },
  'choose': { files: ['choose'], gain: 0.28, vary: 0.04 },
  'verbs-out': { files: ['verbs-out'], gain: 0.3 },
  'verbs-in': { files: ['verbs-in'], gain: 0.26 },
  'window-open': { files: ['window-open'], gain: 0.3 },
  'window-close': { files: ['window-close'], gain: 0.26 },
  'page': { files: ['page'], gain: 0.22, vary: 0.05 },
  'pause': { files: ['pause'], gain: 0.36 },
  'resume': { files: ['resume'], gain: 0.32 },
  'confirm': { files: ['confirm'], gain: 0.3 },
  'deny': { files: ['deny'], gain: 0.34 },
  'things': { files: ['things'], gain: 0.3 },
  'hold': { files: ['hold'], gain: 0.34 },
  'inspect': { files: ['inspect'], gain: 0.22 },
  'co-open': { files: ['co-open'], gain: 0.2 },
  'co-message': { files: ['co-message'], gain: 0.2 },
  'co-ask': { files: ['co-ask'], gain: 0.22 },
  'glitch': { files: ['glitch-1', 'glitch-2'], gain: 0.3, together: true },
  'book-open': { files: ['book-open'], gain: 0.7 },
  'book-close': { files: ['book-close'], gain: 0.42 },
  'book-page': { files: ['book-page-1', 'book-page-2'], gain: 0.75, vary: 0.04 },
  'key': { files: ['key'], gain: 0.16, vary: 0.12 },
  'enter': { files: ['enter'], gain: 0.22 },
  'boot': { files: ['boot'], gain: 0.34 },
};

/** How long a tap waits for a cue of its own to take its place, in milliseconds. */
const TAP_WAIT = 30;

export class Sounds {
  /** The setting: with it off, nothing sounds. */
  enabled = true;
  private ctx: AudioContext | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private tapTimer = 0;
  private lastAt = new Map<Cue, number>();

  /**
   * Ready to sound: at the player's first touch, a click or a key, its audio started and its files fetched from
   * `assets`; and from then a tap on any button sounds.
   */
  start(assets: string): void {
    const begin = () => {
      window.removeEventListener('pointerdown', begin, true);
      window.removeEventListener('keydown', begin, true);
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        void this.ctx.resume();
        const files = [...new Set(Object.values(CUES).flatMap((c) => c.files))];
        for (const f of files) void this.load(`${assets}/sounds/${f}.wav`, f);
      } catch {
        // no audio here: the game plays on in silence
      }
    };
    window.addEventListener('pointerdown', begin, true);
    window.addEventListener('keydown', begin, true);
    // a tap on a button: its own cue, or the tap, unless what it did sounds itself
    document.addEventListener('click', (e) => {
      const b = (e.target as Element | null)?.closest?.('button');
      if (!b) return;
      const cue = b.dataset.cue;
      if (cue === 'none') return;
      if (cue && cue in CUES) this.play(cue as Cue);
      else this.tap();
    }, true);
  }

  private async load(url: string, name: string): Promise<void> {
    try {
      const data = await (await fetch(url)).arrayBuffer();
      const buf = await new Promise<AudioBuffer>((ok, fail) => this.ctx!.decodeAudioData(data, ok, fail));
      this.buffers.set(name, buf);
    } catch {
      // that one stays silent
    }
  }

  /** The tap, a moment late: if something else sounds in that moment, it sounds instead. */
  private tap(): void {
    window.clearTimeout(this.tapTimer);
    this.tapTimer = window.setTimeout(() => this.sound('tap'), TAP_WAIT);
  }

  /** A cue, now: in place of a tap waiting to sound. The same cue twice at once sounds once. */
  play(cue: Cue): void {
    window.clearTimeout(this.tapTimer);
    this.sound(cue);
  }

  private sound(cue: Cue): void {
    const ctx = this.ctx;
    if (!this.enabled || !ctx) return;
    const now = performance.now();
    if (now - (this.lastAt.get(cue) ?? -1e9) < 40) return;
    this.lastAt.set(cue, now);
    const c = CUES[cue], files = c.together ? c.files : [c.files[Math.floor(Math.random() * c.files.length)]];
    try {
      for (const f of files) {
        const buf = this.buffers.get(f);
        if (!buf) continue;
        const src = ctx.createBufferSource(), gain = ctx.createGain();
        src.buffer = buf;
        src.playbackRate.value = 1 + (Math.random() * 2 - 1) * (c.vary ?? 0);
        gain.gain.value = c.gain;
        src.connect(gain).connect(ctx.destination);
        src.start();
      }
    } catch {
      // a sound that cannot play is no reason to stop the game
    }
  }
}

/** The game's one set of sounds. */
export const sounds = new Sounds();
