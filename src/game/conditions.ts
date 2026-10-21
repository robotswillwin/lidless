// Conditions on the story's state, written in scene files and the notebook: whether a thing is there, a way is open, a
// note is written. A small language over the story's variables:
//
//   has_raw                    true when the variable is: true, a number other than 0, a word, a list with something in it
//   !has_raw, not has_raw      not
//   favours_owed >= 1          comparisons: == != < <= > >=, against numbers, true or false, or "words"
//   carried has valve          a list holds an item; carried has (valve, radio) holds them all
//   a && b, a and b            both
//   a || b, a or b             either
//   ( ... )                    grouping
//
// Variables are the story's (src/story/main.ink declares them). A condition that cannot be read is an error, reported
// with what is wrong, so a scene file with a typo in one is caught by its check and the editor's lint.

/** A list as the story keeps it: Ink's InkList has items by name. Arrays of names are lists too. */
export interface ListLike {
  ContainsItemNamed(name: string): boolean;
  Count: number;
}

/** What the story says a variable is now; undefined if it has none by that name. */
export type Read = (name: string) => unknown;

type Node =
  | { k: 'var'; name: string }
  | { k: 'lit'; v: number | string | boolean }
  | { k: 'not'; a: Node }
  | { k: 'and' | 'or'; a: Node; b: Node }
  | { k: 'cmp'; op: string; a: Node; b: Node }
  | { k: 'has'; a: Node; items: string[] };

const isList = (v: unknown): v is ListLike => !!v && typeof v === 'object' && typeof (v as ListLike).ContainsItemNamed === 'function';

/** Whether a value counts as true: a list with something in it, a number other than 0, a word, true. */
export function truthy(v: unknown): boolean {
  if (isList(v)) return v.Count > 0;
  if (Array.isArray(v)) return v.length > 0;
  return Boolean(v);
}

function tokens(src: string): string[] {
  const out: string[] = [], re = /\s*(&&|\|\||==|!=|<=|>=|[()!<>,]|"[^"]*"|'[^']*'|-?\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_.]*)/y;
  let at = 0;
  while (at < src.length) {
    if (/^\s*$/.test(src.slice(at))) break;
    re.lastIndex = at;
    const m = re.exec(src);
    if (!m) throw new Error(`cannot read "${src.slice(at).trim()}" in the condition "${src}"`);
    out.push(m[1]);
    at = re.lastIndex;
  }
  return out;
}

function parse(src: string): Node {
  const t = tokens(src);
  let i = 0;
  const peek = () => t[i], take = () => t[i++];
  const expect = (s: string) => { if (take() !== s) throw new Error(`"${s}" expected in the condition "${src}"`); };
  const or = (): Node => { let a = and(); while (peek() === '||' || peek() === 'or') { take(); a = { k: 'or', a, b: and() }; } return a; };
  const and = (): Node => { let a = not(); while (peek() === '&&' || peek() === 'and') { take(); a = { k: 'and', a, b: not() }; } return a; };
  const not = (): Node => (peek() === '!' || peek() === 'not' ? (take(), { k: 'not', a: not() }) : cmp());
  const cmp = (): Node => {
    const a = atom(), op = peek();
    if (op === 'has') {
      take();
      const items: string[] = [];
      if (peek() === '(') { take(); do { items.push(name()); } while (peek() === ',' && take()); expect(')'); } else items.push(name());
      return { k: 'has', a, items };
    }
    if (['==', '!=', '<', '<=', '>', '>='].includes(op)) { take(); return { k: 'cmp', op, a, b: atom() }; }
    return a;
  };
  const name = (): string => { const n = take(); if (!n || !/^[A-Za-z_]/.test(n)) throw new Error(`a name expected in the condition "${src}"`); return n; };
  const atom = (): Node => {
    const s = take();
    if (s === undefined) throw new Error(`the condition "${src}" ends too soon`);
    if (s === '(') { const e = or(); expect(')'); return e; }
    if (s === 'true' || s === 'false') return { k: 'lit', v: s === 'true' };
    if (/^-?\d/.test(s)) return { k: 'lit', v: Number(s) };
    if (/^["']/.test(s)) return { k: 'lit', v: s.slice(1, -1) };
    if (/^[A-Za-z_]/.test(s) && !['and', 'or', 'not', 'has'].includes(s)) return { k: 'var', name: s };
    throw new Error(`unexpected "${s}" in the condition "${src}"`);
  };
  const e = or();
  if (i < t.length) throw new Error(`unexpected "${t[i]}" in the condition "${src}"`);
  return e;
}

const cache = new Map<string, Node>();
const compiled = (src: string): Node => {
  let n = cache.get(src);
  if (!n) cache.set(src, (n = parse(src)));
  return n;
};

function value(n: Node, read: Read): unknown {
  switch (n.k) {
    case 'var': return read(n.name);
    case 'lit': return n.v;
    case 'not': return !truthy(value(n.a, read));
    case 'and': return truthy(value(n.a, read)) && truthy(value(n.b, read));
    case 'or': return truthy(value(n.a, read)) || truthy(value(n.b, read));
    case 'has': {
      const l = value(n.a, read);
      return n.items.every((it) => (isList(l) ? l.ContainsItemNamed(it) : Array.isArray(l) ? l.includes(it) : false));
    }
    case 'cmp': {
      const a = value(n.a, read), b = value(n.b, read), num = (v: unknown) => (typeof v === 'boolean' ? Number(v) : v);
      const x = num(a) as number | string, y = num(b) as number | string;
      switch (n.op) {
        case '==': return x === y;
        case '!=': return x !== y;
        case '<': return x < y;
        case '<=': return x <= y;
        case '>': return x > y;
        default: return x >= y;
      }
    }
  }
}

/** Whether a condition holds; none (undefined or empty) always does. Throws on one it cannot read. */
export function holds(cond: string | undefined, read: Read): boolean {
  if (!cond || !cond.trim()) return true;
  return truthy(value(compiled(cond), read));
}

/** What is wrong with a condition, in words, or null if it can be read. */
export function conditionProblem(cond: string): string | null {
  try { compiled(cond); return null; } catch (e) { return e instanceof Error ? e.message : String(e); }
}

/** The story's variables a condition reads (not the items a list is asked about). */
export function variablesIn(cond: string): string[] {
  const out = new Set<string>();
  const walk = (n: Node): void => {
    if (n.k === 'var') out.add(n.name);
    else if (n.k === 'not') walk(n.a);
    else if (n.k === 'and' || n.k === 'or' || n.k === 'cmp') { walk(n.a); walk(n.b); }
    else if (n.k === 'has') walk(n.a);
  };
  walk(compiled(cond));
  return [...out];
}
