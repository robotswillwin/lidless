// The story's voices on the page: speech is written in quotes, so the game can show what Luna only thinks (her lines
// without them) apart from what she says. Everyone else always speaks, so their lines must be quoted; and a quote she
// opens she must close.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMANDS } from './dialogue';

const dir = join(__dirname, '../story');
// a spoken line opens with a quote and closes it; what follows the close (an action: 'He weighs it in his hand') may stay
const OPEN = /^["\u201c]/, CLOSE = /^["\u201c][^"\u201d]+["\u201d]/;

describe('the story\'s voices', () => {
  it('writes every spoken line in quotes, and closes every quote Luna opens', () => {
    const bad: string[] = [];
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.ink'))) {
      readFileSync(join(dir, f), 'utf8').split('\n').forEach((raw, i) => {
        const line = raw.trim();
        if (!line || line.startsWith('//')) return;
        const m = /^(.*?)\s*#\s*([a-z][a-z0-9_]*)\s*$/.exec(line);
        if (!m) return;
        const [, text, tag] = m;
        if ((COMMANDS as readonly string[]).includes(tag) || !text) return;
        const where = `${f}:${i + 1}`;
        if (tag === 'luna') { if (OPEN.test(text) && !CLOSE.test(text)) bad.push(`${where}: Luna opens a quote she does not close: ${text}`); }
        else if (!OPEN.test(text) || !CLOSE.test(text)) bad.push(`${where}: #${tag} speaks, so the line wants quotes: ${text}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
