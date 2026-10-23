// What she has done and knows that the story does not keep, kept in her save: the places she has been and what she has
// seen in each (what the map shows, map.ts), the ways in and out she knows (their markers), what she has read in her
// notebook and her messages, how many times she has gone from one place to another and how far each place's rotations
// have turned (rotate.ts), her visits to privacy rooms whose doors the Concierge sees (privacy.ts), and whether the
// story's opening has run.

import { rotateOnArrival } from './rotate';
import type { SaveData } from './save';
import type { SceneFile } from './scenefile';

const sets = (o: Record<string, string[]> | undefined) => new Map(Object.entries(o ?? {}).map(([k, v]) => [k, new Set(v)]));
const lists = (m: Map<string, Set<string>>) => Object.fromEntries([...m].map(([k, v]) => [k, [...v]]));

export class Progress {
  /** The places she has been. */
  readonly been: Set<string>;
  /** In each place, what she has seen of what goes on the map: its ways out, people. */
  private readonly seen: Map<string, Set<string>>;
  /** In each place, the ways in and out she knows (looked at, tried, come out of): their markers show. */
  private readonly found: Map<string, Set<string>>;
  /** What she has read in her notebook (the rest is marked new), and the messages she has read. */
  readonly notesRead: Set<string>;
  readonly messagesRead: Set<string>;
  /** How many times she has gone from one place to another, and how far each place's rotations have turned. */
  arrived: number;
  private rotations: Record<string, number>;
  /** Her visits to privacy rooms whose doors the Concierge sees, by place: her arrival counts then. */
  readonly visits: Record<string, number[]>;
  /** Whether the story's opening has run: a new game begins with it, once. */
  opened: boolean;

  constructor(save: SaveData | null) {
    this.been = new Set(save?.visited ?? []);
    this.seen = sets(save?.seen);
    this.found = sets(save?.found);
    this.notesRead = new Set(save?.read ?? []);
    this.messagesRead = new Set(save?.messagesRead ?? []);
    this.arrived = save?.arrived ?? 0;
    this.rotations = { ...(save?.rotations ?? {}) };
    this.visits = Object.fromEntries(Object.entries(save?.visits ?? {}).map(([k, v]) => [k, [...v]]));
    // a game saved before there was an opening has had its start already
    this.opened = save ? (save.opened ?? true) : false;
  }

  /** A way in or out of a place she now knows: its marker shows there from now on. */
  find(place: string, id: string): void {
    const known = this.found.get(place) ?? new Set<string>();
    known.add(id);
    this.found.set(place, known);
  }

  knows(place: string, id: string): boolean {
    return !!this.found.get(place)?.has(id);
  }

  /** What she has seen in a place of what goes on the map, to add to as more comes into sight. */
  seenIn(place: string): Set<string> {
    const seen = this.seen.get(place) ?? new Set<string>();
    this.seen.set(place, seen);
    return seen;
  }

  hasSeen(place: string, id: string): boolean {
    return !!this.seen.get(place)?.has(id);
  }

  /**
   * She has come to a place from another: her count of arrivals goes up, the place's rotations turn (who sits at the
   * station now), and a privacy room with its door in sight knows of the visit. Returns what the story is to be told:
   * its count of arrivals (`arrivals`, a clock it can count by), and what turned.
   */
  arrive(file: SceneFile, holds: (cond: string) => boolean): Record<string, string | number> {
    this.arrived++;
    const { set, counts } = rotateOnArrival(file.rotate ?? {}, this.rotations, holds);
    this.rotations = counts;
    if (file.noticed) this.visits[file.id] = [...(this.visits[file.id] ?? []), this.arrived].slice(-12);
    return { arrivals: this.arrived, ...set };
  }

  /** What of it goes into her save. */
  toSave(): Pick<SaveData, 'visited' | 'seen' | 'found' | 'read' | 'arrived' | 'rotations' | 'visits' | 'messagesRead' | 'opened'> {
    return {
      visited: [...this.been], seen: lists(this.seen), found: lists(this.found), read: [...this.notesRead],
      arrived: this.arrived, rotations: this.rotations, visits: this.visits, messagesRead: [...this.messagesRead], opened: this.opened,
    };
  }
}
