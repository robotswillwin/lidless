// What the game keeps of its maps: where a tap takes her (`Travel`), and which hotspots count as places on a map
// (`onMap`: ways out, people, and things marked for it; `noticeSpots` records them as seen). The chapter's city map
// itself is citymap.ts.

import type { Hotspot } from './level';

/** Where tapping takes her: a scene, arriving at one of its places to arrive, or at a hotspot (where she stands to use it). */
export interface Travel { scene: string; spawn?: string; at?: string }

/** A hotspot worth a place on the map: a way out, someone to talk to, or a thing marked for it. */
export const onMap = (h: Hotspot): 'door' | 'person' | 'thing' | null => (h.map === false ? null : h.go ? 'door' : h.talk ? 'person' : h.map ? 'thing' : null);
