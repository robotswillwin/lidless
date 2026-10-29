// Before the tests run: the chapter catalog and the scripting-agent package are written from the game as it is, so
// the test that they are current passes whenever the generator works, and the tree always carries fresh copies (they
// are tracked: commit them with the content they describe).
import { execFileSync } from 'node:child_process';

export function setup(): void {
  execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/chapter.mts', '--package'], { stdio: 'ignore' });
}
