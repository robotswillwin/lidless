// What an old machine keeps for those who know one: a train for whoever types sl for ls, rain of figures down the screen,
// fortunes, and the old answers to the old jokes. Plain logic, no screen: shell.ts plays them as streams (frames over
// time) and terminal.ts draws them.

/** A train, drawn for this machine: it steams across the screen from the right, and will not be stopped. */
const TRAIN = [
  '                 .  o  O  0',
  '               o',
  '      ______[]____          ___________________',
  '     /   ___   __ |        |  []   []   []   []  |',
  '  __/   |___| |__||________|____________________|',
  ' |________________|=|_____________________________|',
  '   (O)   (O)  (O)    (O)   (O)            (O)   (O)',
];
const TRAIN_ALT = [
  '                o  O  0  o',
  '              .',
  '      ______[]____          ___________________',
  '     /   ___   __ |        |  []   []   []   []  |',
  '  __/   |___| |__||________|____________________|',
  ' |________________|=|_____________________________|',
  '   (@)   (@)  (@)    (@)   (@)            (@)   (@)',
];

/** The train's frames across a screen `cols` wide: two characters a frame, its wheels turning, until it has gone. */
export function trainFrames(cols: number): string[][] {
  const width = Math.max(...TRAIN.map((l) => l.length)), frames: string[][] = [];
  for (let x = cols, k = 0; x > -width; x -= 2, k++) {
    const art = k % 2 ? TRAIN_ALT : TRAIN;
    frames.push(['', ...art.map((l) => (x >= 0 ? ' '.repeat(x) + l : l.slice(-x)).slice(0, cols).trimEnd()), '']);
  }
  return frames;
}

const RAIN = '0123456789ABCDEF<>=+*#%&@$?';

/** A frame of figures raining down a screen `cols` wide and `rows` high: each column its own drop, at its own speed. */
export function rainFrame(k: number, cols: number, rows = 14): string[] {
  const out: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) {
      const h = hash(c * 7919 + 13), speed = 1 + (h % 3), tail = 4 + (h % 7), span = rows + tail + (h % 9);
      const head = (k * speed + (h % span)) % span, d = head - r;
      line += c % 2 === 0 && d >= 0 && d < tail ? RAIN[hash(c * 31 + r * 17 + Math.floor(k / (1 + (d > 0 ? 1 : 0)))) % RAIN.length] : ' ';
    }
    out.push(line.trimEnd());
  }
  return out;
}

function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

/** Fortunes, when the machine has none of its own in /usr/share/games/fortune/fortunes. */
export const FORTUNES = [
  'You will be watched over.',
  'A clean disk is a sign of a quiet mind. A full one, of a busy one. A read-only one, of a careful one.',
  'There is no place like 127.0.0.1.',
  'The more you read, the less they can tell you.',
  'Today is a good day to read the manual.',
  'Never trust a machine that says it has nothing to hide.',
  'Someone typed their password where a command goes. Someone always does.',
  'Logs remember what people forget.',
  'An old machine does what it is told. A new one does what it thinks you meant.',
  'You have mail. (You do not.)',
  'Beware of the uptime of a quiet server.',
  'Whoever reads the history knows the future of the root account.',
  'If at first you do not succeed, read /var/log/messages.',
  'The network is down. Enjoy the silence.',
  'There are 10 kinds of people: those who read binary and those who do not.',
  'Be careful what you grep for. You might find it.',
];

/** The old answers to `make`, BSD's. */
export function make(args: string[]): string[] {
  if (!args.length) return ['make: no target to make.'];
  if (args[0] === 'love') return ["make: don't know how to make love. Stop"];
  return [`make: don't know how to make ${args[0]}. Stop`];
}

/** Whether a line is the shell's fork bomb, :(){ :|:& };: */
export const forkBomb = (line: string): boolean => /^\s*([\w:]+)\s*\(\)\s*\{\s*\1\s*\|\s*\1\s*&\s*\}\s*;\s*\1\s*$/.test(line);
