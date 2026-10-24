// The old machine's shell language, read: what she types (or a script holds) as a tree to run. A Bourne shell's own:
// words with their quotes and what is put in them ($NAME, ${NAME:-word}, ${#NAME}, $(command), `command`, $((sum))),
// commands joined by ; & && || and |, if, for, while, until, case, { }, ( ), functions, and redirections, here
// documents (<<EOF) among them. What is not finished yet (a for without its done, an open quote, a here document with
// no end) is said so, for the terminal to ask for the next line. Plain logic: shell.ts runs the tree.

/** A piece of a word: text, or something put in it when it runs. `q`: inside quotes (not split, no wildcards). */
export type Seg =
  | { t: 'lit'; v: string; q: boolean }
  | { t: 'var'; name: string; op?: ':-' | '-' | ':=' | ':+' | '#'; arg?: Word; q: boolean }
  | { t: 'cmd'; src: string; q: boolean }
  | { t: 'arith'; src: string; q: boolean };
export type Word = Seg[];

/** A redirection: of a stream (0 in, 1 out, 2 errors) to or from a file, to another stream (>&), or a here document. */
export interface Redir {
  fd: number;
  op: '>' | '>>' | '<' | '>&' | '<<';
  target: Word;
  /** A here document's lines, and whether they are taken as they are (its end word quoted): nothing put in them. */
  body?: string[];
  raw?: boolean;
}

export type Node =
  | { k: 'simple'; assigns: { name: string; value: Word }[]; words: Word[]; redirs: Redir[] }
  | { k: 'pipe'; cmds: Node[]; not: boolean }
  | { k: 'and' | 'or'; left: Node; right: Node }
  | { k: 'list'; items: Node[] }
  | { k: 'if'; branches: { cond: Node; body: Node }[]; otherwise?: Node; redirs: Redir[] }
  | { k: 'for'; name: string; items: Word[] | null; body: Node; redirs: Redir[] }
  | { k: 'while'; cond: Node; body: Node; until: boolean; redirs: Redir[] }
  | { k: 'case'; word: Word; arms: { pats: Word[]; body: Node }[]; redirs: Redir[] }
  | { k: 'group'; body: Node; sub: boolean; redirs: Redir[] }
  | { k: 'func'; name: string; body: Node };

export type Parsed = { ok: true; node: Node } | { ok: false; more: true } | { ok: false; error: string };

type Tok =
  | { k: 'word'; w: Word; raw: string }
  | { k: 'op'; v: string; fd?: number }
  | { k: 'nl' }
  | { k: 'eof' };

/** Not finished yet: more lines are wanted. */
class More extends Error {}
/** Not the language: what is wrong. */
class Bad extends Error {}

const OPS = ['&&', '||', ';;', '<<-', '<<', '>>', '>&', '<&', ';', '&', '|', '(', ')', '<', '>'];
const RESERVED = new Set(['if', 'then', 'elif', 'else', 'fi', 'for', 'in', 'do', 'done', 'while', 'until', 'case', 'esac', '{', '}', '!', 'function']);
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** The text up to the parenthesis that closes one already open, quotes and nested ones kept whole; its end, past it. */
function balanced(s: string, i: number, open = '(', close = ')'): { text: string; end: number } {
  let depth = 1, j = i;
  while (j < s.length) {
    const c = s[j];
    if (c === '\\') { j += 2; continue; }
    if (c === "'") { const e = s.indexOf("'", j + 1); if (e < 0) throw new More(); j = e + 1; continue; }
    if (c === '"') { j = skipDouble(s, j + 1); continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return { text: s.slice(i, j), end: j + 1 };
    j++;
  }
  throw new More();
}

/** Past the end of double quotes opened before `i`. */
function skipDouble(s: string, i: number): number {
  let j = i;
  while (j < s.length) {
    if (s[j] === '\\') { j += 2; continue; }
    if (s[j] === '"') return j + 1;
    if (s[j] === '$' && s[j + 1] === '(') { j = balanced(s, j + 2).end; continue; }
    if (s[j] === '`') { const e = s.indexOf('`', j + 1); if (e < 0) throw new More(); j = e + 1; continue; }
    j++;
  }
  throw new More();
}

/** What follows a $: a name, ${...}, $(...), $((...)), or a special one ($?, $#, $1); `q` inside double quotes. */
function dollar(s: string, i: number, q: boolean): { seg: Seg; end: number } | null {
  const c = s[i];
  if (c === '(' && s[i + 1] === '(') {
    // $(( sum )): the text between the double parentheses, closed by both
    const inner = balanced(s, i + 2);
    if (s[inner.end] === ')') return { seg: { t: 'arith', src: inner.text, q }, end: inner.end + 1 };
    // $((cmd) | cmd): a command after all
    const whole = balanced(s, i + 1);
    return { seg: { t: 'cmd', src: whole.text, q }, end: whole.end };
  }
  if (c === '(') { const b = balanced(s, i + 1); return { seg: { t: 'cmd', src: b.text, q }, end: b.end }; }
  if (c === '{') {
    const b = balanced(s, i + 1, '{', '}'), body = b.text;
    if (body.startsWith('#') && NAME.test(body.slice(1))) return { seg: { t: 'var', name: body.slice(1), op: '#', q }, end: b.end };
    const m = /^([A-Za-z_][A-Za-z0-9_]*|[0-9]+|[?#@*$!])(:-|-|:=|:\+)?([\s\S]*)$/.exec(body);
    if (!m || (!m[2] && m[3])) throw new Bad(`\${${body}}: bad substitution`);
    return { seg: { t: 'var', name: m[1], ...(m[2] ? { op: m[2] as ':-', arg: wordOf(m[3], q) } : {}), q }, end: b.end };
  }
  const m = /^([A-Za-z_][A-Za-z0-9_]*|[0-9]|[?#@*$!])/.exec(s.slice(i));
  return m ? { seg: { t: 'var', name: m[1], q }, end: i + m[1].length } : null;
}

/** A piece of text read as a word's inside (a default in ${NAME:-...}): what is put in it, and quotes. */
function wordOf(s: string, q: boolean): Word {
  const segs: Word = [];
  let i = 0, lit = '';
  const flush = () => { if (lit) segs.push({ t: 'lit', v: lit, q }); lit = ''; };
  while (i < s.length) {
    if (s[i] === '$') { const d = dollar(s, i + 1, q); if (d) { flush(); segs.push(d.seg); i = d.end; continue; } }
    lit += s[i++];
  }
  flush();
  return segs;
}

/** The text read as tokens: words, operators, ends of lines; here documents' lines taken at the end of their line. */
function lex(src: string): Tok[] {
  const toks: Tok[] = [], heredocs: Redir[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; continue; }
    if (c === '#') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '\n') {
      toks.push({ k: 'nl' });
      i++;
      // here documents begun on this line: their lines, up to their end word
      for (const h of heredocs.splice(0)) {
        const end = h.target.map((s) => (s.t === 'lit' ? s.v : '')).join(''), strip = (h as Redir & { strip?: boolean }).strip, body: string[] = [];
        for (;;) {
          if (i >= src.length) throw new More();
          const e = src.indexOf('\n', i), line = src.slice(i, e < 0 ? src.length : e);
          i = e < 0 ? src.length : e + 1;
          const l = strip ? line.replace(/^\t+/, '') : line;
          if (l === end) break;
          if (e < 0) throw new More();
          body.push(l);
        }
        h.body = body;
      }
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) {
      toks.push({ k: 'op', v: op });
      i += op.length;
      if (op === '<<' || op === '<<-') {
        // the end word: quoted, its lines are taken as they are
        while (src[i] === ' ' || src[i] === '\t') i++;
        const w = readWord(src, i);
        if (!w.raw) throw new Bad('syntax error: a here document needs its end word');
        const raw = /['"\\]/.test(w.raw), end = w.raw.replace(/['"\\]/g, '');
        const r: Redir & { strip?: boolean } = { fd: 0, op: '<<', target: [{ t: 'lit', v: end, q: true }], raw, ...(op === '<<-' ? { strip: true } : {}) };
        heredocs.push(r);
        toks.push({ k: 'word', w: r.target, raw: end, heredoc: r } as Tok);
        i = w.end;
      }
      continue;
    }
    const w = readWord(src, i);
    // a number right before < or > is the stream it redirects: 2>, 2>&1
    if (/^\d+$/.test(w.raw) && (src[w.end] === '<' || src[w.end] === '>')) {
      const next = OPS.find((o) => src.startsWith(o, w.end))!;
      toks.push({ k: 'op', v: next, fd: Number(w.raw) });
      i = w.end + next.length;
      continue;
    }
    toks.push({ k: 'word', w: w.word, raw: w.raw });
    i = w.end;
  }
  if (heredocs.length) throw new More();
  toks.push({ k: 'eof' });
  return toks;
}

/** One word from `i`: its pieces, and its text as typed (for reserved words and names). */
function readWord(s: string, i: number): { word: Word; raw: string; end: number } {
  const segs: Word = [];
  let j = i, lit = '';
  const flush = (q = false) => { if (lit) segs.push({ t: 'lit', v: lit, q }); lit = ''; };
  while (j < s.length) {
    const c = s[j];
    if (c === ' ' || c === '\t' || c === '\n' || ';&|()<>'.includes(c)) break;
    if (c === '\\') { if (j + 1 >= s.length) throw new More(); flush(); segs.push({ t: 'lit', v: s[j + 1], q: true }); j += 2; continue; }
    if (c === "'") {
      const e = s.indexOf("'", j + 1);
      if (e < 0) throw new More();
      flush();
      segs.push({ t: 'lit', v: s.slice(j + 1, e), q: true });
      j = e + 1;
      continue;
    }
    if (c === '"') {
      flush();
      const e = skipDouble(s, j + 1), inner = s.slice(j + 1, e - 1);
      segs.push(...doubled(inner));
      // "" is an empty word, not none
      if (!inner) segs.push({ t: 'lit', v: '', q: true });
      j = e;
      continue;
    }
    if (c === '`') {
      const e = s.indexOf('`', j + 1);
      if (e < 0) throw new More();
      flush();
      segs.push({ t: 'cmd', src: s.slice(j + 1, e), q: false });
      j = e + 1;
      continue;
    }
    if (c === '$') {
      const d = dollar(s, j + 1, false);
      if (d) { flush(); segs.push(d.seg); j = d.end; continue; }
    }
    lit += c;
    j++;
  }
  flush();
  return { word: segs, raw: s.slice(i, j), end: j };
}

/** The inside of double quotes: text, and what is put in it. */
function doubled(s: string): Word {
  const segs: Word = [];
  let i = 0, lit = '';
  const flush = () => { if (lit) segs.push({ t: 'lit', v: lit, q: true }); lit = ''; };
  while (i < s.length) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length && '$`"\\\n'.includes(s[i + 1])) { lit += s[i + 1] === '\n' ? '' : s[i + 1]; i += 2; continue; }
    if (c === '$') { const d = dollar(s, i + 1, true); if (d) { flush(); segs.push(d.seg); i = d.end; continue; } }
    if (c === '`') { const e = s.indexOf('`', i + 1); flush(); segs.push({ t: 'cmd', src: s.slice(i + 1, e), q: true }); i = e + 1; continue; }
    lit += c;
    i++;
  }
  flush();
  return segs;
}

/** The tokens read as the language, from the start. */
class Parser {
  private p = 0;
  constructor(private readonly toks: Tok[]) {}

  /** The token here (a method, not a getter: what it is changes as the parser moves on). */
  private tk(): Tok { return this.toks[this.p]; }
  /** The token here if it is a word. */
  private wd(): Extract<Tok, { k: 'word' }> | null { const t = this.tk(); return t.k === 'word' ? t : null; }
  private isWord(v?: string): boolean { const t = this.tk(); return t.k === 'word' && (v === undefined || t.raw === v); }
  private isOp(v: string): boolean { const t = this.tk(); return t.k === 'op' && t.v === v; }
  private skipNl(): void { while (this.tk().k === 'nl') this.p++; }
  /** The end: more is wanted when the text ends here. */
  private want(): never { if (this.tk().k === 'eof') throw new More(); throw new Bad(`syntax error near unexpected token \`${this.show()}'`); }
  private show(): string { const t = this.tk(); return t.k === 'word' ? t.raw : t.k === 'op' ? t.v : t.k === 'nl' ? 'newline' : 'end of file'; }
  private expectWord(v: string): void { this.skipNl(); if (!this.isWord(v)) this.want(); this.p++; }

  all(): Node {
    this.skipNl();
    if (this.tk().k === 'eof') return { k: 'list', items: [] };
    const n = this.list(new Set());
    if (this.tk().k !== 'eof') this.want();
    return n;
  }

  /** Commands one after another, up to one of the words that end them here (fi, done, }...). */
  private list(until: Set<string>): Node {
    const items: Node[] = [];
    for (;;) {
      this.skipNl();
      if (this.tk().k === 'eof' || until.has(this.wd()?.raw ?? '') || this.isOp(')') || this.isOp(';;')) break;
      items.push(this.andOr());
      if (this.isOp(';') || this.isOp('&')) this.p++;
      else if (this.tk().k === 'nl') continue;
      else break;
    }
    if (!items.length) this.want();
    return items.length === 1 ? items[0] : { k: 'list', items };
  }

  private andOr(): Node {
    let left = this.pipeline();
    while (this.isOp('&&') || this.isOp('||')) {
      const k = (this.tk() as { v: string }).v === '&&' ? 'and' : 'or';
      this.p++;
      this.skipNl();
      left = { k, left, right: this.pipeline() };
    }
    return left;
  }

  private pipeline(): Node {
    let not = false;
    if (this.isWord('!')) { not = true; this.p++; }
    const cmds = [this.command()];
    while (this.isOp('|')) { this.p++; this.skipNl(); cmds.push(this.command()); }
    return cmds.length === 1 && !not ? cmds[0] : { k: 'pipe', cmds, not };
  }

  private command(): Node {
    const t = this.tk();
    if (t.k === 'eof') throw new More();
    if (t.k === 'word') {
      switch (t.raw) {
        case 'if': return this.withRedirs(this.ifNode());
        case 'for': return this.withRedirs(this.forNode());
        case 'while': case 'until': return this.withRedirs(this.whileNode(t.raw === 'until'));
        case 'case': return this.withRedirs(this.caseNode());
        case '{': { this.p++; const body = this.list(new Set(['}'])); this.expectWord('}'); return this.withRedirs({ k: 'group', body, sub: false, redirs: [] }); }
        case 'function': {
          this.p++;
          const name = this.wd()?.raw ?? '';
          if (!NAME.test(name)) this.want();
          this.p++;
          if (this.isOp('(')) { this.p++; if (!this.isOp(')')) this.want(); this.p++; }
          this.skipNl();
          return { k: 'func', name, body: this.command() };
        }
        default:
          if (RESERVED.has(t.raw) && t.raw !== '!' && t.raw !== '{' && t.raw !== '}') throw new Bad(`syntax error near unexpected token \`${t.raw}'`);
      }
      // a function: name() { ... }
      if (NAME.test(t.raw) && this.toks[this.p + 1]?.k === 'op' && (this.toks[this.p + 1] as { v: string }).v === '(' && this.toks[this.p + 2]?.k === 'op' && (this.toks[this.p + 2] as { v: string }).v === ')') {
        this.p += 3;
        this.skipNl();
        return { k: 'func', name: t.raw, body: this.command() };
      }
    }
    if (this.isOp('(')) { this.p++; const body = this.list(new Set()); if (!this.isOp(')')) this.want(); this.p++; return this.withRedirs({ k: 'group', body, sub: true, redirs: [] }); }
    return this.simple();
  }

  private withRedirs<N extends Node & { redirs: Redir[] }>(n: N): N {
    for (;;) { const r = this.redir(); if (!r) return n; n.redirs.push(r); }
  }

  private redir(): Redir | null {
    const t = this.tk();
    if (t.k !== 'op' || !['>', '>>', '<', '>&', '<&', '<<', '<<-'].includes(t.v)) return null;
    this.p++;
    const target = this.tk();
    if (target.k !== 'word') this.want();
    this.p++;
    if (t.v === '<<' || t.v === '<<-') { const h = (target as unknown as { heredoc: Redir }).heredoc; return { ...h, fd: t.fd ?? 0 }; }
    const op = (t.v === '<&' ? '>&' : t.v) as Redir['op'];
    return { fd: t.fd ?? (op === '<' ? 0 : 1), op, target: target.w };
  }

  private simple(): Node {
    const assigns: { name: string; value: Word }[] = [], words: Word[] = [], redirs: Redir[] = [];
    for (;;) {
      const r = this.redir();
      if (r) { redirs.push(r); continue; }
      const t = this.tk();
      if (t.k !== 'word') break;
      // NAME=value before the command: an assignment
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(t.raw);
      if (!words.length && m && t.w[0]?.t === 'lit' && !t.w[0].q && t.w[0].v.startsWith(`${m[1]}=`)) {
        const value: Word = [{ ...t.w[0], v: t.w[0].v.slice(m[1].length + 1) }, ...t.w.slice(1)];
        assigns.push({ name: m[1], value });
        this.p++;
        continue;
      }
      words.push(t.w);
      this.p++;
    }
    if (!assigns.length && !words.length && !redirs.length) this.want();
    return { k: 'simple', assigns, words, redirs };
  }

  private ifNode(): Extract<Node, { k: 'if' }> {
    this.p++;
    const branches: { cond: Node; body: Node }[] = [];
    let otherwise: Node | undefined;
    const cond = this.list(new Set(['then']));
    this.expectWord('then');
    branches.push({ cond, body: this.list(new Set(['elif', 'else', 'fi'])) });
    for (;;) {
      this.skipNl();
      if (this.isWord('elif')) { this.p++; const c = this.list(new Set(['then'])); this.expectWord('then'); branches.push({ cond: c, body: this.list(new Set(['elif', 'else', 'fi'])) }); continue; }
      if (this.isWord('else')) { this.p++; otherwise = this.list(new Set(['fi'])); }
      this.expectWord('fi');
      return { k: 'if', branches, otherwise, redirs: [] };
    }
  }

  private forNode(): Extract<Node, { k: 'for' }> {
    this.p++;
    const name = this.wd()?.raw ?? '';
    if (!NAME.test(name)) this.want();
    this.p++;
    let items: Word[] | null = null;
    this.skipNl();
    if (this.isWord('in')) {
      this.p++;
      items = [];
      for (let w = this.wd(); w; w = this.wd()) { items.push(w.w); this.p++; }
      if (this.isOp(';')) this.p++;
      else if (this.tk().k !== 'nl') this.want();
    } else if (this.isOp(';')) this.p++;
    this.expectWord('do');
    const body = this.list(new Set(['done']));
    this.expectWord('done');
    return { k: 'for', name, items, body, redirs: [] };
  }

  private whileNode(until: boolean): Extract<Node, { k: 'while' }> {
    this.p++;
    const cond = this.list(new Set(['do']));
    this.expectWord('do');
    const body = this.list(new Set(['done']));
    this.expectWord('done');
    return { k: 'while', cond, body, until, redirs: [] };
  }

  private caseNode(): Extract<Node, { k: 'case' }> {
    this.p++;
    const word = this.wd()?.w ?? this.want();
    this.p++;
    this.expectWord('in');
    const arms: { pats: Word[]; body: Node }[] = [];
    for (;;) {
      this.skipNl();
      if (this.isWord('esac')) { this.p++; return { k: 'case', word, arms, redirs: [] }; }
      if (this.isOp('(')) this.p++;
      const pats: Word[] = [];
      for (;;) {
        pats.push(this.wd()?.w ?? this.want());
        this.p++;
        if (this.isOp('|')) { this.p++; continue; }
        break;
      }
      if (!this.isOp(')')) this.want();
      this.p++;
      this.skipNl();
      const body = this.isOp(';;') || this.isWord('esac') ? { k: 'list' as const, items: [] } : this.list(new Set(['esac']));
      this.skipNl();
      if (this.isOp(';;')) this.p++;
      else if (!this.isWord('esac')) this.want();
      arms.push({ pats, body });
    }
  }
}

/** What she typed (lines joined with newlines), read: the tree to run, or that more is wanted, or what is wrong. */
export function parse(src: string): Parsed {
  try {
    return { ok: true, node: new Parser(lex(src)).all() };
  } catch (e) {
    if (e instanceof More) return { ok: false, more: true };
    if (e instanceof Bad) return { ok: false, error: e.message };
    throw e;
  }
}

/* ---------- $(( sums )): whole numbers, as a shell works them out ---------- */

/** A sum as $(( )) has it: + - * / % ** , < <= > >= == !=, && || !, brackets, names of variables (empty is 0). */
export function arith(src: string, get: (name: string) => string): number {
  const toks = src.match(/\*\*|<=|>=|==|!=|&&|\|\||<<|>>|[-+*/%()<>!~&|^]|[A-Za-z_][A-Za-z0-9_]*|\$[A-Za-z_][A-Za-z0-9_]*|\d+|\S/g) ?? [];
  let p = 0;
  const peek = () => toks[p];
  const value = (t: string) => {
    const name = t.startsWith('$') ? t.slice(1) : t;
    const v = get(name).trim();
    if (!v) return 0;
    if (!/^-?\d+$/.test(v)) throw new Error(`${v}: not a number`);
    return Number(v);
  };
  const atom = (): number => {
    const t = toks[p++];
    if (t === undefined) throw new Error('syntax error');
    if (t === '(') { const v = or(); if (toks[p++] !== ')') throw new Error('missing )'); return v; }
    if (t === '-') return -atom();
    if (t === '+') return atom();
    if (t === '!') return atom() ? 0 : 1;
    if (t === '~') return ~atom();
    if (/^\d+$/.test(t)) return Number(t);
    if (/^\$?[A-Za-z_]/.test(t)) return value(t);
    throw new Error(`syntax error: operand expected (error token is "${t}")`);
  };
  const pow = (): number => { const b = atom(); return peek() === '**' ? (p++, Math.trunc(b ** pow())) : b; };
  const mul = (): number => {
    let v = pow();
    while (['*', '/', '%'].includes(peek())) {
      const op = toks[p++], r = pow();
      if ((op === '/' || op === '%') && r === 0) throw new Error('division by 0');
      v = op === '*' ? v * r : op === '/' ? Math.trunc(v / r) : v % r;
    }
    return v;
  };
  const add = (): number => { let v = mul(); while (peek() === '+' || peek() === '-') v = toks[p++] === '+' ? v + mul() : v - mul(); return v; };
  const cmp = (): number => {
    let v = add();
    while (['<', '<=', '>', '>=', '==', '!='].includes(peek())) {
      const op = toks[p++], r = add();
      v = Number(op === '<' ? v < r : op === '<=' ? v <= r : op === '>' ? v > r : op === '>=' ? v >= r : op === '==' ? v === r : v !== r);
    }
    return v;
  };
  const and = (): number => { let v = cmp(); while (peek() === '&&') { p++; const r = cmp(); v = Number(!!v && !!r); } return v; };
  const or = (): number => { let v = and(); while (peek() === '||') { p++; const r = and(); v = Number(!!v || !!r); } return v; };
  if (!toks.length) return 0;
  const v = or();
  if (p < toks.length) throw new Error(`syntax error: invalid arithmetic operator (error token is "${toks[p]}")`);
  return v;
}
