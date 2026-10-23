// The wait behind the fade (the first load, a scene not fetched yet): an eye that opens. It starts as the privacy
// sign, the closed eye in its ring; the ring fades as the eye slowly opens, its upper lid lifting and its lashes
// turning from down to up; then a red pupil kindles in it, and it looks about, and blinks now and then, for as long as
// the wait goes on. Someone is watching. Once it shows, it is seen whole: the wait is held until it has opened and its
// pupil kindled, however soon the scene is ready. Players who asked for less motion see it closed, then open, with
// nothing moving in between. The markup is in index.html, so the first load shows it before this runs.

/** The eye in the SVG's own units: its corners at ±W, its lids' curves H deep; the lashes L long. */
const W = 34, H = 15, L = 9, LASHES = [-0.66, -0.33, 0, 0.33, 0.66];
/** Where its gaze goes, in turn, once it is open: still, aside, back. */
const LOOKS = [0, 0, -8, -8, 0, 6, 6, 0];

/** How long it takes to open and kindle its pupil, in seconds, and be looked at a moment: a wait is held this long. */
export const openedAfter = (reduced: boolean): number => (reduced ? 1.6 : 3.2);

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => { const c = clamp(x); return c * c * (3 - 2 * c); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const f = (n: number) => Math.round(n * 100) / 100;

/**
 * The eye at `t` seconds into a wait: `lid` its upper lid's curve, 1 shut (bent down onto the lower lid, as the
 * privacy sign draws it) to -1 open (bent up); `ring` the sign's ring, fading as it opens; `pupil` how far the red
 * pupil has kindled, 0 to 1; `gaze` where it looks, across.
 */
export function eyeAt(t: number, reduced = false): { lid: number; ring: number; pupil: number; gaze: number } {
  if (reduced) { const open = t >= 1.2 ? 1 : 0; return { lid: 1 - 2 * open, ring: 1 - open, pupil: open, gaze: 0 }; }
  const open = ease((t - 0.4) / 1.8);
  let lid = 1 - 2 * open;
  // once open, a blink every few seconds: the lid comes nearly down and goes up again
  if (t > 3.4) { const p = (t - 3.4) % 4.6; if (p < 0.3) lid = Math.min(1, lid + 1.9 * Math.sin((Math.PI * p) / 0.3)); }
  let gaze = 0;
  if (t > 2.9) {
    const step = 1.1, k = Math.floor((t - 2.9) / step), into = (t - 2.9) % step;
    gaze = lerp(LOOKS[(k + LOOKS.length - 1) % LOOKS.length], LOOKS[k % LOOKS.length], ease(into / 0.14));
  }
  return { lid, ring: 1 - open, pupil: ease((t - 2.1) / 0.7), gaze };
}

/** Its shapes for a lid: the upper lid's curve, its lashes, and the opening between the lids that the eye shows through. */
export function eyePaths(lid: number): { upper: string; lashes: string; opening: string } {
  const upper = `M${-W} 0Q0 ${f(2 * H * lid)} ${W} 0`;
  // the lashes on the upper lid: hanging down while it is shut, standing up when open, folded away as it passes flat
  const len = L * Math.pow(Math.abs(lid), 1.5), down = lid >= 0;
  const lashes = LASHES.map((u) => {
    const x = u * W, y = H * lid * (1 - u * u), a = ((down ? 90 - 38 * u : -90 + 38 * u) * Math.PI) / 180;
    return `M${f(x)} ${f(y)}L${f(x + len * Math.cos(a))} ${f(y + len * Math.sin(a))}`;
  }).join('');
  return { upper, lashes, opening: `M${-W} 0Q0 ${f(2 * H * lid)} ${W} 0Q0 ${2 * H} ${-W} 0Z` };
}

/** The eye in the page's markup, played while a wait lasts. */
export class Eye {
  private raf = 0;
  private t0 = 0;
  private playing = false;
  private readonly part: Record<'ring' | 'upper' | 'lashes' | 'opening' | 'look' | 'pupil' | 'glow' | 'iris' | 'glint', SVGElement | null>;

  constructor(svg: SVGSVGElement, private readonly reduced: () => boolean) {
    const q = (c: string) => svg.querySelector<SVGElement>(`.${c}`);
    this.part = { ring: q('ring'), upper: q('upper'), lashes: q('lashes'), opening: q('opening'), look: q('look'), pupil: q('pupil'), glow: q('glow'), iris: q('iris'), glint: q('glint') };
  }

  /** From the start, shut, for as long as the wait lasts. */
  play(): void {
    this.stop();
    this.playing = true;
    this.t0 = performance.now();
    this.draw(0);
    const tick = (now: number) => {
      const t = (now - this.t0) / 1000;
      this.draw(t);
      // with less motion, nothing more moves once it is open
      this.raf = this.reduced() && t > 1.3 ? 0 : requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.playing = false;
  }

  /** Once it has opened and its pupil kindled (at once if it is not showing): what a wait it shows is held for. */
  opened(): Promise<void> {
    const left = this.playing ? openedAfter(this.reduced()) * 1000 - (performance.now() - this.t0) : 0;
    return left > 0 ? new Promise((r) => setTimeout(r, left)) : Promise.resolve();
  }

  private draw(t: number): void {
    const e = eyeAt(t, this.reduced()), p = eyePaths(e.lid), P = this.part;
    P.ring?.setAttribute('opacity', f(e.ring).toString());
    P.upper?.setAttribute('d', p.upper);
    P.lashes?.setAttribute('d', p.lashes);
    P.opening?.setAttribute('d', p.opening);
    P.look?.setAttribute('transform', `translate(${f(e.gaze)} 0)`);
    P.pupil?.setAttribute('r', f(5.5 * e.pupil).toString());
    P.glow?.setAttribute('opacity', f(0.85 * e.pupil).toString());
    P.iris?.setAttribute('opacity', f(e.pupil).toString());
    P.glint?.setAttribute('opacity', f(e.pupil).toString());
  }
}

/** The page's one eye, behind its fade. */
let eye: Eye | null = null;
export function waitingEye(reduced: () => boolean = () => matchMedia('(prefers-reduced-motion: reduce)').matches): Eye | null {
  const svg = document.querySelector<SVGSVGElement>('svg.fade-wait');
  if (!eye && svg) eye = new Eye(svg, reduced);
  return eye;
}
