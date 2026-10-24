import { describe, expect, it } from 'vitest';
import { Shell, type Machine } from './shell';

const machine: Machine = {
  name: 'Test', host: 'box', system: 'TestUX 1.0', clock: '2030-11-02 03:12', user: 'ann',
  users: { root: { password: 'sesame' }, ann: { home: '/home/ann' } },
  files: {
    '/home/ann/': { owner: 'ann' },
    '/home/ann/notes.txt': { owner: 'ann', text: 'one\ntwo\nthree' },
    '/home/ann/locked': { owner: 'root', mode: 'rw-------', text: 'secret' },
    '/etc/hosts': { text: '127.0.0.1 localhost\n10.0.0.1 relay' },
  },
};

function sh() {
  const shell = new Shell(machine, { test: () => true, tell: () => {} });
  return (line: string) => shell.run(line).lines;
}

describe('the shell as a language: variables and $', () => {
  it('sets a variable and reads it, in double quotes and bare', () => {
    const run = sh();
    expect(run('x=hello; echo $x')).toEqual(['hello']);
    expect(run('name="the world"; echo "hi, $name"')).toEqual(['hi, the world']);
    expect(run("x=a; echo '$x'")).toEqual(['$x']);
    expect(run('echo ${missing:-a default}')).toEqual(['a default']);
    expect(run('greet=hi; echo ${#greet}')).toEqual(['2']);
  });

  it('runs a command and puts its output in a word', () => {
    const run = sh();
    expect(run('echo "today is $(whoami)"')).toEqual(['today is ann']);
    expect(run('echo `hostname`')).toEqual(['box']);
    // newlines in the output become spaces when it is split
    expect(run('for w in $(cat notes.txt); do echo [$w]; done')).toEqual(['[one]', '[two]', '[three]']);
    expect(run('echo "$(cat notes.txt)"')).toEqual(['one', 'two', 'three']);
  });

  it('works sums out with $(( ))', () => {
    const run = sh();
    expect(run('echo $((2 + 3 * 4))')).toEqual(['14']);
    expect(run('n=5; echo $((n * n))')).toEqual(['25']);
    expect(run('echo $(( (1 + 2) ** 3 ))')).toEqual(['27']);
  });
});

describe('the shell as a language: flow', () => {
  it('if and test, on a string, a number and a file', () => {
    const run = sh();
    expect(run('if [ -f notes.txt ]; then echo yes; else echo no; fi')).toEqual(['yes']);
    expect(run('if [ -f nope ]; then echo yes; else echo no; fi')).toEqual(['no']);
    expect(run('if test 3 -lt 5; then echo less; fi')).toEqual(['less']);
    expect(run('x=; if [ -z "$x" ]; then echo empty; fi')).toEqual(['empty']);
    expect(run('if [ "$USER" = ann ]; then echo hi ann; fi')).toEqual(['hi ann']);
  });

  it('&& and || run the next by whether the last went well', () => {
    const run = sh();
    expect(run('true && echo yes')).toEqual(['yes']);
    expect(run('false || echo fallback')).toEqual(['fallback']);
    expect(run('cat notes.txt > /dev/null && echo ok || echo bad')).toEqual(['ok']);
    // a command not found does not go well
    expect(run('frobnicate && echo never').at(-1)).toBe('sh: frobnicate: not found');
  });

  it('for over a list, over a glob, and seq', () => {
    const run = sh();
    expect(run('for i in a b c; do echo $i; done')).toEqual(['a', 'b', 'c']);
    expect(run('for i in $(seq 1 3); do echo $i; done')).toEqual(['1', '2', '3']);
    expect(run('for i in $(seq -w 8 10); do echo $i; done')).toEqual(['08', '09', '10']);
    expect(run('cd /home/ann; for f in *.txt; do echo $f; done')).toEqual(['notes.txt']);
  });

  it('while with a counter, break and continue', () => {
    const run = sh();
    expect(run('i=0; while [ $i -lt 3 ]; do echo $i; i=$((i + 1)); done')).toEqual(['0', '1', '2']);
    expect(run('for i in 1 2 3 4; do if [ $i -eq 3 ]; then break; fi; echo $i; done')).toEqual(['1', '2']);
    expect(run('for i in 1 2 3; do if [ $i -eq 2 ]; then continue; fi; echo $i; done')).toEqual(['1', '3']);
  });

  it('case matches patterns, with | and *', () => {
    const run = sh();
    expect(run('x=cat; case $x in dog) echo woof;; cat|lion) echo meow;; *) echo "?";; esac')).toEqual(['meow']);
    expect(run('x=xyz; case $x in a*) echo a;; *) echo other;; esac')).toEqual(['other']);
  });

  it('functions, with their own arguments and a return', () => {
    const run = sh();
    expect(run('greet() { echo "hello, $1"; }; greet world')).toEqual(['hello, world']);
    expect(run('count() { echo $#; }; count a b c')).toEqual(['3']);
    expect(run('ok() { return 0; }; ok && echo ran')).toEqual(['ran']);
    // the arguments are put back after the function
    expect(run('f() { echo $1; }; set -- ; f inside; echo "$1"')).toEqual(['inside', '']);
  });
});

describe('the shell as a language: real uses, and its limits', () => {
  it('reads a script file and runs it, line by line', () => {
    const m: Machine = { ...machine, files: { ...machine.files, '/home/ann/run.sh': { owner: 'ann', text: '#!/bin/sh\nfor i in 1 2\ndo\n  echo "line $i"\ndone\necho done' } } };
    const shell = new Shell(m, { test: () => true, tell: () => {} });
    expect(shell.run('sh run.sh').lines).toEqual(['line 1', 'line 2', 'done']);
    expect(shell.run('. run.sh').lines).toEqual(['line 1', 'line 2', 'done']);
  });

  it('a here document is the input, what is put in it or not', () => {
    const run = sh();
    expect(run('x=world; cat <<EOF\nhello $x\nEOF')).toEqual(['hello world']);
    expect(run("cat <<'END'\nraw $x\nEND")).toEqual(['raw $x']);
    expect(run('grep two <<EOF\none\ntwo\nthree\nEOF')).toEqual(['two']);
  });

  it('still writes nothing: a redirection to a file is refused, the disk read-only', () => {
    const run = sh();
    expect(run('echo hi > out.txt')).toEqual(['sh: cannot create out.txt: Read-only file system']);
    expect(run('for i in 1 2; do echo $i; done > log').at(-1)).toMatch(/Read-only/);
  });

  it('an endless loop does not hang: while true stops after its limit', () => {
    const run = sh();
    const out = run('while true; do echo x; done');
    expect(out.length).toBeGreaterThan(1000);
    expect(out.every((l) => l === 'x')).toBe(true);
  });

  it('the old uses still work: a pipe, a glob, su, the jokes', () => {
    const shell = new Shell(machine, { test: () => true, tell: () => {} });
    expect(shell.run('cat notes.txt | grep two').lines).toEqual(['two']);
    expect(shell.run('cd /home/ann && ls *.txt').lines).toEqual(['notes.txt']);
    expect(shell.run('cat locked').lines).toEqual(['cat: locked: Permission denied']);
    shell.run('su root'); shell.run('sesame');
    expect(shell.run('whoami').lines).toEqual(['root']);
  });

  it('a password inside a loop: a brute force reads as it would, each try its own line', () => {
    // a door controller that only takes one code: the loop tries them, as a Unix player would write it
    const m: Machine = { ...machine, files: { ...machine.files, '/bin/door': { kind: 'program', size: 400 } } };
    const shell = new Shell(m, { test: () => true, tell: () => {} });
    // with no `door` command it is "not found" each time; the shape of the script still runs
    const out = shell.run('for p in $(seq -w 0 3); do echo "try $p"; done').lines;
    expect(out).toEqual(['try 0', 'try 1', 'try 2', 'try 3']);
  });
});
