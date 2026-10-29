// The ways between places in a session: going through a way out (a door, the end of the street, a lift's floor, a
// place on the map) behind the fade, and what is noticed and run as she arrives; up close to a thing and back (a
// close-up is a scene of its own); and the ways she knows, marked on screen.

import { waitingEye } from './eye';
import type { Game, Arrival } from './game';
import type { Way } from './hud';
import { inView, pick, placeIn, type Hotspot } from './level';
import type { Travel } from './map';
import { outfitAfter } from './outfits';
import { isDoor } from './pose';
import { sounds } from './sound';
import { noticedOnLeaving } from './privacy';
import type { SceneFile } from './scenefile';

export class Ways {
  /** Going from one place to another, or in close and back: what she would do meanwhile waits. */
  travelling = false;
  /** In a close-up: where she stood in the place, to go back to. */
  private zoomedFrom: { scene: string; x: number; facing: 1 | -1 } | null = null;
  /** When she came into the place she is in. */
  private enteredAt = 0;

  constructor(private readonly g: Game) {}

  /** She has come into a place (or a close-up of one): the clock of her stay starts; out of a close-up, she is back. */
  entered(file: SceneFile): void {
    this.enteredAt = this.g.clock();
    if (!file.closeup) this.zoomedFrom = null;
  }

  /** Where she is, for the map and her save: in a close-up, where she stood in the place. */
  here(): { scene: string; x: number; facing: 1 | -1 } {
    const g = this.g;
    return this.zoomedFrom ?? { scene: g.scene.file.id, x: g.world.heroX, facing: g.world.facing };
  }

  /**
   * She goes through a way out (a door, the end of the street), or somewhere on the map: fade out, go to the other
   * scene, arriving at one of its places or at x, fade in. For the story (`story`), whatever she wears, and the
   * conversation goes on there. Through a door where she stands (`through`), her back to us as the screen fades.
   */
  async go(exit: { scene: string } & Arrival, story = false, through = false): Promise<void> {
    const g = this.g;
    if (this.travelling || (!story && g.talk.open)) return;
    // a place she will not leave yet (her messages first): she says why, and stays
    const held = g.scene.file.stay;
    if (!story && held && g.dialogue.test(held.when)) {
      this.stop();
      return g.say(pick(held.say, g.raw));
    }
    this.travelling = true;
    this.stop();
    // dressed in what she does not go out in, she stays
    const outfits = g.setup.world.hero.outfits;
    if (outfits && g.scene.file.wardrobe && !story) {
      const to = await g.scenes.file(exit.scene).catch(() => null);
      if (to && outfitAfter(outfits, g.dressing.outfit, true, !!to.wardrobe) === null) {
        this.travelling = false;
        return g.say(outfits[g.dressing.outfit]?.stay ?? 'Not dressed like this.');
      }
    }
    g.controls.setVerb(null);
    g.hud.closeAll();
    g.turns.going = through && this.doorHere();
    // going in at a door: it opens behind the fade, and shuts as she arrives on the other side
    const atDoor = g.turns.going;
    if (atDoor) sounds.play('door-open');
    // coming out of a privacy room with its door in sight: a long stay, or coming too often, is noticed
    const left = g.scene.file, seen = left.noticed ? noticedOnLeaving(left.noticed, g.clock() - this.enteredAt, g.progress.visits[left.id] ?? [], g.progress.arrived) : null;
    // what she was looking at, and who she was talking to, stay behind
    g.ui.hideCaption();
    if (g.talk.open && !story) { g.talk.hide(); g.endTalk(); }
    // a conversation going on there: whoever she talked to here is left behind
    if (story) g.partner = null;
    g.setup.fade.classList.add('on');
    await new Promise((r) => setTimeout(r, g.setup.reduceMotion ? 0 : 260));
    // a scene not ready once the fade is dark: after a moment the eye, opening (eye.ts). One fetched ahead never shows it
    const waiting = setTimeout(() => { g.setup.fade.classList.add('wait'); waitingEye()?.play(); }, 300);
    try {
      await g.enter(exit.scene, exit);
      this.arrive();
      // the way she came out of is known: a door, a lift, wherever she stands now; out of a door she faces us as the
      // screen lifts, and from an end of the street she walks in side on
      for (const h of this.waysHere()) this.find(h);
      g.turns.out = this.doorHere();
      g.controls.syncKeys();
      if (seen && left.noticed) {
        g.co.raiseAttention(1);
        g.hud.toast(seen === 'long' ? left.noticed.long : left.noticed.again);
      }
      g.persist();
    } catch (err) {
      g.ui.showCaption(`That way is not built yet (${err instanceof Error ? err.message : String(err)}).`);
    }
    clearTimeout(waiting);
    g.turns.going = false;
    // a knot of the story's to run as she arrives here (the Concierge's question as she steps out of a friend's flat):
    // not where a conversation brought her, which goes on
    const asked = story ? undefined : g.scene.file.arrive?.find((r) => g.dialogue.test(r.when) && g.dialogue.has(r.story));
    const waited = g.setup.fade.classList.contains('wait');
    // the eye, once it shows, is seen whole: it finishes opening before the fade lifts
    if (waited && !g.setup.fast) await waitingEye()?.opened();
    g.setup.fade.classList.remove('wait', 'on');
    if (atDoor) sounds.play('door-close');
    g.turns.stillSince = g.clock();
    if (asked) g.co.ask(asked.story);
    if (waited) setTimeout(() => { if (!g.setup.fade.classList.contains('wait')) waitingEye()?.stop(); }, 400);
    this.travelling = false;
  }

  /** Up close to a thing, its close-up a scene of its own; where she stood is kept, to step back to. */
  zoomInto(h: Hotspot): void {
    const g = this.g;
    if (!h.zoom || this.travelling) return;
    if (!g.scene.file.closeup) this.zoomedFrom = { scene: g.scene.file.id, x: g.world.heroX, facing: g.world.facing };
    void this.zoom({ scene: h.zoom, spawn: 'in' });
  }

  /** Back from a close-up to where she stood, facing it. */
  back(): void {
    const f = this.zoomedFrom;
    if (!f || this.g.talk.open || this.travelling) return;
    void this.zoom({ scene: f.scene, x: f.x, facing: f.facing });
  }

  /** Going somewhere on the map: a place (where one arrives there), or a door or a person in it (where she stands to use it). */
  async jump(t: Travel): Promise<void> {
    const g = this.g;
    if (g.talk.open || this.travelling) return;
    const file = await g.scenes.file(t.scene).catch(() => null), h = t.at ? file?.hotspots.find((x) => x.id === t.at) : undefined;
    if (!file) return;
    if (!h) return this.go({ scene: t.scene, spawn: t.spawn && file.spawns[t.spawn] ? t.spawn : Object.keys(file.spawns)[0] });
    const { rect, stand, face } = placeIn(h, g.raw), x = stand ?? rect[0] + rect[2] / 2;
    return this.go({ scene: t.scene, x, facing: face ?? (rect[0] + rect[2] / 2 >= x ? 1 : -1) });
  }

  /** A way's marker tapped: she goes to it and through, as tapping the door itself does; a lift, she uses. */
  take(id: string): void {
    const g = this.g, h = g.scene.file.hotspots.find((x) => x.id === id);
    if (!h || g.talk.open || this.travelling) return;
    g.hud.closePanel();
    g.hud.dismissNote();
    if (g.controls.verb) g.controls.setVerb(null);
    const { rect, stand } = placeIn(h, g.raw);
    g.controls.pending = h.go ? { kind: 'feet', label: '' } : null;
    g.controls.goTo(h.go || stand === undefined ? rect[0] + rect[2] / 2 : stand, h);
  }

  /** A way in or out she now knows: its marker shows, in this place, from now on. */
  find(h: Hotspot): void {
    this.g.progress.find(this.g.scene.file.id, h.id);
  }

  /**
   * The ways in and out on screen, for their markers. A way off the end of the street, to the next place, is always
   * marked, in the bottom corner on that side, while it is in sight. A door that leads somewhere (`go`), or a way she uses to get about (a
   * lift: `kind` way), is marked over its top once she knows it: she has looked at it, tried it, or come out of it.
   * So she finds the ways in herself. None while she travels or talks.
   */
  markers(): Way[] {
    const g = this.g;
    if (this.travelling || g.talk.open || g.hud.concierge.talking || g.directing) return [];
    const f = g.scene.file, W = g.hud.root.clientWidth, out: Way[] = [];
    for (const h of f.hotspots) {
      if (!(h.go || h.kind === 'way') || !inView(h, g.raw) || !g.world.shown(h)) continue;
      const [x, y, w] = g.boxOf(h), [rx, , rw] = placeIn(h, g.raw).rect;
      if (x + w < 0 || x > W) continue;
      const edge = h.go && rx <= 2 ? 'left' : h.go && rx + rw >= f.size[0] - 2 ? 'right' : 'in', label = pick(h.name, g.raw);
      if (edge === 'in' && !g.progress.knows(f.id, h.id)) continue;
      // a door's marker sits over its top; a way off the end of the street has a fixed place, the bottom corner on that
      // side above the ball there (see the CSS), where she never stands: its x and y are not used
      out.push(edge === 'in' ? { id: h.id, label, x: x + w / 2, y: y - 6, edge } : { id: h.id, label, x: 0, y: 0, edge });
    }
    return out;
  }

  /** An exit at an end of the walk line, which walking into with the keyboard takes. */
  exitAt(x: number): Hotspot | undefined {
    const g = this.g;
    return g.scene.file.hotspots.find((h) => { const [rx, , rw] = placeIn(h, g.raw).rect; return h.go && inView(h, g.raw) && g.world.shown(h) && x >= rx - 1 && x <= rx + rw + 1; });
  }

  /** In close, or back: a quick fade, and nothing else happens on the way (no arrival, nothing noticed). */
  private async zoom(to: { scene: string } & Arrival): Promise<void> {
    const g = this.g;
    this.travelling = true;
    this.stop();
    g.controls.setVerb(null);
    g.hud.closeAll();
    g.ui.hideCaption();
    g.setup.fade.classList.add('on');
    await new Promise((r) => setTimeout(r, g.setup.reduceMotion ? 0 : 200));
    try {
      await g.enter(to.scene, to);
      g.turns.stillSince = g.clock();
      g.persist();
    } catch (err) {
      g.ui.showCaption(`That is not built yet (${err instanceof Error ? err.message : String(err)}).`);
    }
    g.setup.fade.classList.remove('on');
    this.travelling = false;
  }

  /** She stops where she is, the finger and the keys let go of. */
  private stop(): void {
    this.g.controls.letGo();
    this.g.world.stop();
    this.g.controls.releaseKeys();
  }

  /**
   * She has come to a place from another: the story's count of arrivals goes up (a clock it can count by), and the
   * place's rotations turn, before it is seen: who sits at the station now.
   */
  private arrive(): void {
    const g = this.g;
    for (const [name, value] of Object.entries(g.progress.arrive(g.scene.file, (c) => g.dialogue.test(c)))) g.dialogue.set(name, value);
  }

  /** The ways out where she stands: a door, a lift, an end of the street. */
  private waysHere(): Hotspot[] {
    const g = this.g;
    return g.scene.file.hotspots.filter((h) => {
      const [rx, , rw] = placeIn(h, g.raw).rect;
      return (h.go || h.kind === 'way') && g.world.heroX >= rx - 20 && g.world.heroX <= rx + rw + 20;
    });
  }

  /** Whether she stands at a door, which she goes in at and comes out of turned (pose.ts). */
  private doorHere(): boolean {
    return this.waysHere().some((h) => isDoor(placeIn(h, this.g.raw).rect, this.g.scene.file.size[0]));
  }
}
