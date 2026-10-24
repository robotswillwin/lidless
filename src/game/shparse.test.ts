import { describe, expect, it } from 'vitest';
import { arith, parse, type Node, type Word } from './shparse';

const tree = (src: string): Node => { const p = parse(src); if (!p.ok) throw new Error(JSON.stringify(p)); return p.node; };
/** A word as plain text, what is put in it shown as $NAME, $(cmd), $((sum)). */
const text = (w: Word) => w.map((s) => (s.t === 'lit' ? s.v : s.t === 'var' ? `$${s.name}` : s.t === 'cmd' ? `$(${s.src})` : `$((${s.src}))`)).join('');
const simple = (n: Node) => { if (n.k !== 'simple') throw new Error(n.k); return n.words.map(text); };

describe("the old machine's shell language, read", () => {
  it('reads a command as its words, quotes kept whole and taken off', () => {
    expect(simple(tree('echo hello   world'))).toEqual(['echo', 'hello', 'world']);
    expect(simple(tree(`echo "a b" 'c $d' e\\ f`))).toEqual(['echo', 'a b', 'c $d', 'e f']);
    // what is put in a word: in double quotes too, not in single ones
    const [, w] = (tree('echo "$HOME/x"') as Extract<Node, { k: 'simple' }>).words;
    expect(w.map((s) => s.t)).toEqual(['var', 'lit']);
    expect(w.every((s) => s.q)).toBe(true);
  });

  it('reads assignments before a command, and the forms of $', () => {
    const n = tree('X=1 Y="a b" Z=$(date) cmd') as Extract<Node, { k: 'simple' }>;
    expect(n.assigns.map((a) => [a.name, text(a.value)])).toEqual([['X', '1'], ['Y', 'a b'], ['Z', '$(date)']]);
    expect(simple(n)).toEqual(['cmd']);
    expect(simple(tree('echo ${NAME:-nobody} ${#NAME} $((1 + 2)) `whoami` $?'))).toEqual(['echo', '$NAME', '$NAME', '$((1 + 2))', '$(whoami)', '$?']);
    const def = (tree('echo ${NAME:-no one}') as Extract<Node, { k: 'simple' }>).words[1][0];
    expect(def).toMatchObject({ t: 'var', name: 'NAME', op: ':-' });
  });

  it('joins commands with pipes, && and ||, ; and new lines', () => {
    const n = tree('a | b && c || d; e\nf');
    expect(n.k).toBe('list');
    const first = (n as Extract<Node, { k: 'list' }>).items[0] as { k: string; left: { k: string } };
    expect(first.k).toBe('or');
    expect(first.left.k).toBe('and');
  });

  it('reads if, for, while, until, case, groups and functions', () => {
    expect(tree('if true; then echo y; elif false; then echo m; else echo n; fi')).toMatchObject({ k: 'if', branches: [{}, {}], otherwise: { k: 'simple' } });
    const f = tree('for i in 1 2 3; do echo $i; done') as Extract<Node, { k: 'for' }>;
    expect([f.name, f.items!.map(text)]).toEqual(['i', ['1', '2', '3']]);
    expect(tree('while read l; do echo $l; done < f')).toMatchObject({ k: 'while', until: false, redirs: [{ op: '<' }] });
    expect(tree('until false; do :; done')).toMatchObject({ k: 'while', until: true });
    const c = tree('case $x in a|b) echo ab;; *) echo other;; esac') as Extract<Node, { k: 'case' }>;
    expect(c.arms.map((a) => a.pats.map(text))).toEqual([['a', 'b'], ['*']]);
    expect(tree('f() { echo hi; }')).toMatchObject({ k: 'func', name: 'f', body: { k: 'group' } });
    expect(tree('function g { echo; }')).toMatchObject({ k: 'func', name: 'g' });
    expect(tree('( cd /tmp; ls ) > out')).toMatchObject({ k: 'group', sub: true, redirs: [{ op: '>', fd: 1 }] });
  });

  it('reads redirections, a stream to another, and here documents', () => {
    const n = tree('cmd > out 2>&1 < in 2>> err') as Extract<Node, { k: 'simple' }>;
    expect(n.redirs.map((r) => [r.fd, r.op, text(r.target)])).toEqual([[1, '>', 'out'], [2, '>&', '1'], [0, '<', 'in'], [2, '>>', 'err']]);
    const h = tree('cat <<EOF\nline $one\n  two\nEOF\necho after') as Extract<Node, { k: 'list' }>;
    expect((h.items[0] as Extract<Node, { k: 'simple' }>).redirs[0]).toMatchObject({ op: '<<', body: ['line $one', '  two'], raw: false });
    expect(simple(h.items[1])).toEqual(['echo', 'after']);
    expect((tree("cat <<'END'\n$x\nEND") as Extract<Node, { k: 'simple' }>).redirs[0]).toMatchObject({ body: ['$x'], raw: true });
  });

  it('says when more is wanted: an open if, for or quote, a pipe at the end, a here document not ended', () => {
    for (const src of ['if true; then', 'for i in 1 2', 'for i in 1 2; do echo', 'echo "open', "echo 'open", 'a |', 'a &&', 'f() {', 'cat <<EOF\nline', 'echo $(date', 'while true\ndo']) {
      expect(parse(src), src).toEqual({ ok: false, more: true });
    }
  });

  it('says what is wrong with what is not the language', () => {
    expect(parse('fi')).toMatchObject({ ok: false, error: expect.stringContaining('syntax error') });
    expect(parse('if true; then fi')).toMatchObject({ ok: false, error: expect.stringContaining('syntax error') });
    expect(parse('a ;; b')).toMatchObject({ ok: false });
    expect(parse('')).toEqual({ ok: true, node: { k: 'list', items: [] } });
    expect(parse('# only a comment')).toEqual({ ok: true, node: { k: 'list', items: [] } });
  });
});

describe('$(( sums ))', () => {
  const vars: Record<string, string> = { n: '7', zero: '0', word: 'abc' };
  const get = (k: string) => vars[k] ?? '';
  it('works whole numbers out as a shell does: powers, comparisons, logic, names', () => {
    expect(arith('1 + 2 * 3', get)).toBe(7);
    expect(arith('2 ** 10', get)).toBe(1024);
    expect(arith('7 / 2', get)).toBe(3);
    expect(arith('-7 % 3', get)).toBe(-1);
    expect(arith('(5 > 3) && (2 == 2)', get)).toBe(1);
    expect(arith('n * 2 + $n', get)).toBe(21);
    expect(arith('unset + 1', get)).toBe(1);
    expect(arith('!zero', get)).toBe(1);
  });
  it('says what is wrong', () => {
    expect(() => arith('1 / zero', get)).toThrow('division by 0');
    expect(() => arith('word + 1', get)).toThrow('not a number');
    expect(() => arith('1 +', get)).toThrow('syntax error');
  });
});
