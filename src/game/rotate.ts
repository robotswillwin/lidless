// What a scene shows by turns: each time she comes back, who sits at the station is someone else, or nobody. A rotation
// is a story variable the game sets as she arrives, to the next of its values, so the scene's layers and hotspots (and
// the story) read it as they read any other. With `from`, it turns only once that condition holds: until then the
// story's own value stands (the woman stays at the station until Luna can see her as she is).

export interface Rotation {
  values: string[];
  from?: string;
}

/** As she arrives: the value each rotation turns to, and how many times each has turned, this arrival with them. */
export function rotateOnArrival(rotations: Record<string, Rotation>, counts: Record<string, number>, holds: (cond: string) => boolean): { set: Record<string, string>; counts: Record<string, number> } {
  const set: Record<string, string> = {}, next = { ...counts };
  for (const [name, r] of Object.entries(rotations)) {
    if (!r.values.length || (r.from && !holds(r.from))) continue;
    const n = (next[name] ?? 0) + 1;
    next[name] = n;
    set[name] = r.values[(n - 1) % r.values.length];
  }
  return { set, counts: next };
}
