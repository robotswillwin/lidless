// The chapter format's worked example (docs/chapters/00-the-errand) stays a chapter the checker passes, as the game it
// describes changes under it: the agents copy its shape, so it must be right.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '../..');

describe('the chapter format', () => {
  it('passes its own worked example, the opening as built', () => {
    const run = () => execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/chapter.mts', 'docs/chapters/00-the-errand'], { cwd: root, encoding: 'utf8' });
    let out = '';
    try { out = run(); } catch (e) { out = String((e as { stdout?: string }).stdout ?? e); }
    expect(out).toContain('no errors');
  });

  it('gives the scripting agents what is current: their package is up to date with what it copies', () => {
    let out = '';
    try { out = execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/chapter.mts', '--check-package'], { cwd: root, encoding: 'utf8' }); } catch (e) { out = String((e as { stdout?: string }).stdout ?? e); }
    expect(out, 'make it again: npm run agent-package').toContain('up to date');
  });
});
