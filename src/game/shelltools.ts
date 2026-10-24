// The old machine's text tools, as plain functions: base64, tr and the Caesar shift, md5, diff, cal, a calculator (bc and
// expr), factor, hex dumps and cut. What a story hides on a machine can be hidden with them (a password in base64, a note
// in ROT13, a changed log only diff shows), and a player who knows Unix reaches for them first. shell.ts calls them.

/** Text as base64, wrapped at 76 characters as base64 does. */
export function b64encode(text: string): string[] {
  let s = '';
  for (const b of new TextEncoder().encode(text)) s += String.fromCharCode(b);
  return btoa(s).match(/.{1,76}/g) ?? [''];
}

/** base64 back to text, or null if it is not base64. */
export function b64decode(text: string): string | null {
  const clean = text.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 === 1) return null;
  try {
    const s = atob(clean);
    return new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** A set as tr takes it, its ranges (a-z) and escapes (\n, \t, \\) spelled out. */
export function trSet(set: string): string[] {
  const chars = [...set.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\')], out: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    if (chars[i + 1] === '-' && chars[i + 2] !== undefined) {
      for (let c = chars[i].codePointAt(0)!; c <= chars[i + 2].codePointAt(0)!; c++) out.push(String.fromCodePoint(c));
      i += 2;
    } else out.push(chars[i]);
  }
  return out;
}

/** Each character of the first set made the one in the same place in the second (its last again if it is shorter), or deleted. */
export function tr(lines: string[], from: string, to: string | null): string[] {
  const f = trSet(from), t = to === null ? null : trSet(to), map = new Map<string, string>();
  f.forEach((c, i) => map.set(c, t === null ? '' : t[Math.min(i, t.length - 1)] ?? ''));
  return lines.map((l) => [...l].map((c) => map.get(c) ?? c).join(''));
}

/** Letters shifted along the alphabet by n (13 is ROT13, its own way back). */
export const caesar = (text: string, n: number): string =>
  text.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode((((c.charCodeAt(0) - base + n) % 26) + 26) % 26 + base);
  });

/** The MD5 digest of text (as UTF-8) or of bytes, in hex: what md5 says of a file. */
export function md5(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input, len = bytes.length, w = new Uint32Array((((len + 8) >> 6) + 1) * 16);
  for (let i = 0; i < len; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
  w[len >> 2] |= 0x80 << ((len % 4) * 8);
  w[w.length - 2] = (len * 8) >>> 0;
  w[w.length - 1] = Math.floor(len / 0x20000000);
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let o = 0; o < w.length; o += 16) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      const r = i >> 4;
      const F = r === 0 ? (B & C) | (~B & D) : r === 1 ? (D & B) | (~D & C) : r === 2 ? B ^ C ^ D : C ^ (B | ~D);
      const g = r === 0 ? i : r === 1 ? (5 * i + 1) % 16 : r === 2 ? (3 * i + 5) % 16 : (7 * i) % 16;
      const s = S[r * 4 + (i % 4)], f = (F + A + K[i] + w[o + g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((f << s) | (f >>> (32 - s)))) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }
  return [a0, b0, c0, d0].map((x) => [0, 8, 16, 24].map((s) => ((x >>> s) & 255).toString(16).padStart(2, '0')).join('')).join('');
}

/** How one file's lines become another's, as diff prints it: 3c3, 5d4, 7a8,9, the old lines with < and the new with >. */
export function diff(a: string[], b: string[]): string[] {
  const n = a.length, m = b.length, L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: string[] = [], range = (s: number, e: number) => (e - s > 1 ? `${s + 1},${e}` : String(e));
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { i++; j++; continue; }
    const i0 = i, j0 = j;
    while ((i < n || j < m) && !(i < n && j < m && a[i] === b[j])) {
      if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) j++;
      else i++;
    }
    if (i > i0 && j > j0) out.push(`${range(i0, i)}c${range(j0, j)}`, ...a.slice(i0, i).map((l) => `< ${l}`), '---', ...b.slice(j0, j).map((l) => `> ${l}`));
    else if (i > i0) out.push(`${range(i0, i)}d${j0}`, ...a.slice(i0, i).map((l) => `< ${l}`));
    else out.push(`${i0}a${range(j0, j)}`, ...b.slice(j0, j).map((l) => `> ${l}`));
  }
  return out;
}

/* ---------- cal: the calendar as Britain kept it, Julian until the 2nd of September 1752, Gregorian from the 14th ---------- */

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A day's number, counting days across both calendars. */
function dayNumber(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3, base = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4);
  const gregorian = y > 1752 || (y === 1752 && (m > 9 || (m === 9 && d >= 14)));
  return gregorian ? base - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045 : base - 32083;
}

const leap = (y: number) => (y > 1752 ? (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 : y % 4 === 0);

/** The days a month has: September 1752 lost eleven of them. */
function daysOf(y: number, m: number): number[] {
  const count = [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1], all = Array.from({ length: count }, (_, k) => k + 1);
  return y === 1752 && m === 9 ? all.filter((d) => d <= 2 || d >= 14) : all;
}

/** A month as cal prints it: its name and year centred over the days of the week, its weeks under them. */
export function month(m: number, y: number, withYear = true): string[] {
  const title = withYear ? `${MONTH_NAMES[m - 1]} ${y}` : MONTH_NAMES[m - 1], lines = [title.padStart(Math.floor((20 + title.length) / 2)).padEnd(20), 'Su Mo Tu We Th Fr Sa'];
  const days = daysOf(y, m), first = (dayNumber(y, m, days[0]) + 1) % 7;
  let row = '   '.repeat(first), col = first;
  for (const d of days) {
    row += String(d).padStart(2) + ' ';
    if (++col === 7) { lines.push(row.trimEnd()); row = ''; col = 0; }
  }
  if (row) lines.push(row.trimEnd());
  return lines.map((l) => l.padEnd(20));
}

/** A year as cal prints it: its months three across under the year. */
export function year(y: number): string[] {
  const out = [String(y).padStart(33), ''];
  for (let r = 0; r < 4; r++) {
    const ms = [1, 2, 3].map((c) => month(r * 3 + c, y, false)), rows = Math.max(...ms.map((x) => x.length));
    for (let k = 0; k < rows; k++) out.push(ms.map((x) => x[k] ?? ''.padEnd(20)).join('  ').trimEnd());
    out.push('');
  }
  return out;
}

/* ---------- bc and expr: + - * / % ^ and brackets; bc's scale 0 divides as whole numbers, as bc does ---------- */

/** An expression worked out, or why not; `scale` digits after the point (bc -l: 20), 0 for whole numbers. */
export function calc(expr: string, scale = 0): { value: string } | { error: string } {
  const toks = expr.match(/\d+(?:\.\d+)?|\.\d+|[-+*/%^()]|\S/g) ?? [];
  let p = 0;
  const peek = () => toks[p], next = () => toks[p++];
  const num = (): number => {
    const t = next();
    if (t === '(') { const v = sum(); if (next() !== ')') throw new Error('syntax'); return v; }
    if (t === '-') return -num();
    if (t === '+') return num();
    if (t !== undefined && /^[\d.]/.test(t)) return Number(t);
    throw new Error('syntax');
  };
  const pow = (): number => { const b = num(); return peek() === '^' ? (next(), b ** pow()) : b; };
  const product = (): number => {
    let v = pow();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = next(), r = pow();
      if ((op === '/' || op === '%') && r === 0) throw new Error('zero');
      v = op === '*' ? v * r : op === '/' ? (scale ? v / r : Math.trunc(v / r)) : v % r;
    }
    return v;
  };
  const sum = (): number => {
    let v = product();
    while (peek() === '+' || peek() === '-') v = next() === '+' ? v + product() : v - product();
    return v;
  };
  try {
    if (!toks.length) return { value: '' };
    const v = sum();
    if (p < toks.length) throw new Error('syntax');
    if (!Number.isFinite(v)) throw new Error('zero');
    return { value: scale ? String(Number(v.toFixed(scale))) : String(Math.trunc(v)) };
  } catch (e) {
    return { error: (e as Error).message === 'zero' ? 'divide by zero' : 'syntax error' };
  }
}

/** A whole number as its prime factors, as factor prints it: "360: 2 2 2 3 3 5". */
export function factor(n: number): string {
  const out: number[] = [];
  let x = n;
  for (let d = 2; d * d <= x; d++) while (x % d === 0) { out.push(d); x /= d; }
  if (x > 1) out.push(x);
  return `${n}:${out.map((f) => ` ${f}`).join('')}`;
}

/* ---------- hex dumps of a file's bytes ---------- */

const printable = (b: number) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.');

/** xxd: the offset, the bytes in pairs, the text beside them. */
export function xxd(bytes: Uint8Array, limit = 64): string[] {
  const out: string[] = [];
  for (let o = 0; o < bytes.length && out.length < limit; o += 16) {
    const row = [...bytes.slice(o, o + 16)], hex = row.map((b) => b.toString(16).padStart(2, '0'));
    const pairs = Array.from({ length: 8 }, (_, k) => (hex[2 * k] ?? '') + (hex[2 * k + 1] ?? '')).join(' ');
    out.push(`${o.toString(16).padStart(8, '0')}: ${pairs.padEnd(39)}  ${row.map(printable).join('')}`);
  }
  return out;
}

/** hexdump -C: the offset, sixteen bytes in two groups, the text between bars; then where it ends. */
export function hexdumpC(bytes: Uint8Array, limit = 64): string[] {
  const out: string[] = [];
  for (let o = 0; o < bytes.length && out.length < limit; o += 16) {
    const row = [...bytes.slice(o, o + 16)], hex = row.map((b) => b.toString(16).padStart(2, '0'));
    const groups = `${hex.slice(0, 8).join(' ').padEnd(23)}  ${hex.slice(8).join(' ').padEnd(23)}`;
    out.push(`${o.toString(16).padStart(8, '0')}  ${groups}  |${row.map(printable).join('')}|`);
  }
  out.push(bytes.length.toString(16).padStart(8, '0'));
  return out;
}

/* ---------- cut ---------- */

/** A list as cut takes it, 1,3-5,7-: which places (from 1) it keeps. */
export function cutList(list: string): ((k: number) => boolean) | null {
  const parts = list.split(',').map((s) => /^(\d*)-(\d*)$/.exec(s) ?? /^(\d+)$/.exec(s));
  if (!list || parts.some((m) => !m)) return null;
  return (k) => parts.some((m) => (m![2] === undefined ? k === +m![1] : k >= (m![1] ? +m![1] : 1) && k <= (m![2] ? +m![2] : Infinity)));
}
