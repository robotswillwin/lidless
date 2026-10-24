import { describe, expect, it } from 'vitest';
import { b64decode, b64encode, caesar, calc, cutList, diff, factor, hexdumpC, md5, month, tr, xxd, year } from './shelltools';
import { forkBomb, rainFrame, trainFrames } from './shellfun';

describe("the old machine's text tools", () => {
  it('md5 as anyone else computes it', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(md5('The quick brown fox jumps over the lazy dog')).toBe('9e107d9d372bb6826bd81d3542a419d6');
    expect(md5('a'.repeat(1000))).toBe('cabe45dcc9ae5b66ba86600cca6b8ba8');
  });

  it('base64 there and back, words of any language too; what is not base64 is said so', () => {
    expect(b64encode('hello\n')).toEqual(['aGVsbG8K']);
    expect(b64decode('aGVsbG8K')).toBe('hello\n');
    expect(b64decode(b64encode('Väinö, ホテル\n').join(''))).toBe('Väinö, ホテル\n');
    expect(b64decode('not base64!')).toBeNull();
    expect(b64encode('x'.repeat(100))[0].length).toBe(76);
  });

  it('tr with ranges, the shorter set padded with its last; Caesar and ROT13', () => {
    expect(tr(['Hello'], 'A-Za-z', 'N-ZA-Mn-za-m')).toEqual(['Uryyb']);
    expect(tr(['abc'], 'abc', 'x')).toEqual(['xxx']);
    expect(tr(['a-b-c'], '-', null)).toEqual(['abc']);
    expect(caesar('Zebra', 1)).toBe('Afcsb');
    expect(caesar(caesar('Secret', 13), 13)).toBe('Secret');
  });

  it('diff says what changed, what went and what came', () => {
    expect(diff(['a', 'b', 'c'], ['a', 'x', 'c'])).toEqual(['2c2', '< b', '---', '> x']);
    expect(diff(['a', 'b', 'c'], ['a', 'c'])).toEqual(['2d1', '< b']);
    expect(diff(['a', 'c'], ['a', 'b', 'b2', 'c'])).toEqual(['1a2,3', '> b', '> b2']);
    expect(diff(['same'], ['same'])).toEqual([]);
  });

  it('cal: the days of the week right, and September 1752 eleven days short', () => {
    expect(month(11, 2030).slice(0, 3).map((l) => l.trimEnd())).toEqual(['   November 2030', 'Su Mo Tu We Th Fr Sa', '                1  2']);
    expect(month(9, 1752).map((l) => l.trimEnd())).toEqual(['   September 1752', 'Su Mo Tu We Th Fr Sa', '       1  2 14 15 16', '17 18 19 20 21 22 23', '24 25 26 27 28 29 30']);
    expect(month(1, 2000)[2].trimEnd()).toBe('                   1');
    expect(year(2031)[0].trim()).toBe('2031');
    expect(year(2031).length).toBeGreaterThan(30);
  });

  it('works sums out as bc does: whole numbers unless asked, powers, brackets; nonsense and zero said so', () => {
    expect(calc('2^10')).toEqual({ value: '1024' });
    expect(calc('7/2')).toEqual({ value: '3' });
    expect(calc('7/2', 20)).toEqual({ value: '3.5' });
    expect(calc('-(3+4)*2')).toEqual({ value: '-14' });
    expect(calc('1/0')).toEqual({ error: 'divide by zero' });
    expect(calc('2 +')).toEqual({ error: 'syntax error' });
    expect(calc('notes.txt plan.txt')).toEqual({ error: 'syntax error' });
    expect(factor(97)).toBe('97: 97');
    expect(factor(1001)).toBe('1001: 7 11 13');
  });

  it('dumps bytes as xxd and hexdump -C lay them out', () => {
    const b = new TextEncoder().encode('hello\n');
    expect(xxd(b)).toEqual(['00000000: 6865 6c6c 6f0a                           hello.']);
    expect(hexdumpC(b)).toEqual(['00000000  68 65 6c 6c 6f 0a                                 |hello.|', '00000006']);
  });

  it('cut lists: single places, ranges, open ends; nonsense refused', () => {
    const keep = cutList('1,3-4,6-')!;
    expect([1, 2, 3, 4, 5, 6, 9].map(keep)).toEqual([true, false, true, true, false, true, true]);
    expect(cutList('x')).toBeNull();
  });
});

describe('what an old machine keeps for those who know one', () => {
  it('a train that crosses the whole screen and goes; figures that rain, the same for the same moment', () => {
    const frames = trainFrames(40);
    expect(frames[0].every((l) => l.length <= 40)).toBe(true);
    expect(frames.at(-1)!.join('').trim()).toMatch(/\S/);
    expect(rainFrame(5, 30)).toEqual(rainFrame(5, 30));
    expect(rainFrame(5, 30).length).toBe(14);
  });

  it('knows the fork bomb, however it is spaced', () => {
    expect(forkBomb(':(){ :|:& };:')).toBe(true);
    expect(forkBomb('bomb(){ bomb|bomb& };bomb')).toBe(true);
    expect(forkBomb('echo :(){')).toBe(false);
  });
});
