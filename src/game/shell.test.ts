import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Dialogue } from './dialogue';
import { normal, Shell, words, type Machine } from './shell';

const machine: Machine = {
  name: 'Test', host: 'box', system: 'TestUX 1.0 m88k', clock: '2030-11-02 03:12', user: 'ann',
  users: { root: { password: 'sesame', login: { got_root: true } }, ann: { home: '/home/ann' }, bob: { home: '/home/bob' } },
  files: {
    '/etc/motd': { text: 'Welcome.' },
    '/home/ann/': { owner: 'ann' },
    '/home/ann/notes.txt': { owner: 'ann', text: 'one\ntwo apples\nthree', date: '2030-10-30 17:41' },
    '/home/ann/plan.txt': { owner: 'ann', text: 'apples and pears' },
    '/home/ann/.hidden': { owner: 'ann', text: 'shh' },
    '/home/ann/later.txt': { owner: 'ann', text: 'not yet', when: 'ready' },
    '/home/bob/': { owner: 'bob', mode: 'rwx------' },
    '/home/bob/secret': { owner: 'bob', mode: 'rw-------', text: 'the cake is in the oven', read: { read_bob: true } },
    '/var/log/messages': { text: 'a ok\nb unscheduled\nc ok\nd unscheduled\ne unscheduled' },
    '/bin/ls': { kind: 'TestUX executable', size: 4096 },
    '/var/spool/archive.tar': { kind: 'tar archive', entries: ['a.txt', 'b.txt'], damaged: true },
  },
  man: { thing: 'THING(8)\nall about it' },
};

function shell(state: Record<string, unknown> = {}) {
  const told: Record<string, unknown> = {};
  const sh = new Shell(machine, { test: (c) => !!state[c], tell: (v) => Object.assign(told, v) });
  const run = (line: string) => sh.run(line).lines;
  return { sh, run, told };
}

describe('the old machine\'s shell', () => {
  it('comes up where it was left: its user, at home', () => {
    const { sh, run } = shell();
    expect(sh.prompt()).toBe('ann@box:~$ ');
    expect(run('pwd')).toEqual(['/home/ann']);
    expect(run('whoami')).toEqual(['ann']);
    expect(sh.motd()).toEqual(['Welcome.']);
  });

  it('lists a directory: directories marked, hidden names with -a, details with -l', () => {
    const { run } = shell();
    expect(run('ls').join(' ')).toMatch(/notes\.txt\s+plan\.txt/);
    expect(run('ls').join(' ')).not.toContain('.hidden');
    expect(run('ls -a').join(' ')).toContain('.hidden');
    expect(run('ls /home').join(' ')).toMatch(/ann\/\s+bob\//);
    expect(run('ls -l notes.txt')).toEqual(['-rw-r--r--  1 ann      ann          21 Oct 30 17:41 notes.txt']);
  });

  it('goes into directories, up and home, and not where it may not', () => {
    const { sh, run } = shell();
    expect(run('cd /var/log')).toEqual([]);
    expect(sh.prompt()).toBe('ann@box:/var/log$ ');
    run('cd ..');
    expect(run('pwd')).toEqual(['/var']);
    run('cd');
    expect(run('pwd')).toEqual(['/home/ann']);
    expect(run('cd /home/bob')).toEqual(['cd: /home/bob: Permission denied']);
    expect(run('cd nowhere')).toEqual(['cd: nowhere: No such file or directory']);
    expect(run('cd notes.txt')).toEqual(['cd: notes.txt: Not a directory']);
  });

  it('prints files, garbage for programs, and not what it may not read', () => {
    const { run } = shell();
    expect(run('cat notes.txt')).toEqual(['one', 'two apples', 'three']);
    expect(run('cat /bin/ls')[0]).toMatch(/\S{12,}/);
    expect(run('cat /home/bob/secret')).toEqual(['cat: /home/bob/secret: Permission denied']);
    expect(run('cat /home')).toEqual(['cat: /home: Is a directory']);
    expect(run('head -n 1 notes.txt')).toEqual(['one']);
    expect(run('tail -2 notes.txt')).toEqual(['two apples', 'three']);
  });

  it('searches: grep in files, through pipes and below directories; find by name', () => {
    const { run } = shell();
    expect(run('grep apples notes.txt plan.txt')).toEqual(['notes.txt:two apples', 'plan.txt:apples and pears']);
    expect(run('grep -n -i APPLES notes.txt')).toEqual(['2:two apples']);
    expect(run('cat /var/log/messages | grep unscheduled | wc -l')).toEqual(['      3']);
    expect(run('grep -r cake /home')).toEqual(['grep: /home/bob: Permission denied']);
    expect(run('find / -name "*.txt"')).toEqual(['find: /home/bob: Permission denied', '/home/ann/notes.txt', '/home/ann/plan.txt']);
    expect(run('cat nofile | grep x')).toEqual(['cat: nofile: No such file or directory']);
  });

  it('matches wildcards against the names there', () => {
    const { run } = shell();
    expect(run('ls *.txt')).toEqual(['notes.txt  plan.txt']);
    expect(run('echo p*')).toEqual(['plan.txt']);
    expect(run('echo "p*"')).toEqual(['p*']);
  });

  it('switches user with the password, tells the story, and goes back on exit', () => {
    const { sh, run, told } = shell();
    expect(run('su')).toEqual([]);
    expect(sh.asking).toBe(true);
    expect(run('wrong')).toEqual(['su: Sorry']);
    expect(sh.user).toBe('ann');
    run('su root');
    expect(run('sesame')).toEqual([]);
    expect(sh.user).toBe('root');
    expect(sh.prompt().endsWith('# ')).toBe(true);
    expect(told).toEqual({ got_root: true });
    expect(run('cat /home/bob/secret')).toEqual(['the cake is in the oven']);
    expect(told).toEqual({ got_root: true, read_bob: true });
    expect(sh.run('exit').exit).toBeFalsy();
    expect(sh.user).toBe('ann');
    expect(sh.run('exit').exit).toBe(true);
    expect(run('su nobody')).toEqual(['su: unknown login: nobody']);
    run('su bob');
    expect(run('')).toEqual(['su: Sorry']);
  });

  it('a file read whole tells the story; a search through it does not', () => {
    const { run, told } = shell();
    run('su');
    run('sesame');
    run('grep cake /home/bob/secret');
    expect(told.read_bob).toBeUndefined();
    run('cat /home/bob/secret');
    expect(told.read_bob).toBe(true);
  });

  it('shows a file only while the story says it is there', () => {
    expect(shell().run('ls').join(' ')).not.toContain('later.txt');
    expect(shell({ ready: true }).run('ls').join(' ')).toContain('later.txt');
    expect(shell().run('cat later.txt')).toEqual(['cat: later.txt: No such file or directory']);
  });

  it('changes nothing and reaches nothing: the disk is read-only and there is no network', () => {
    const { run } = shell();
    expect(run('rm notes.txt')).toEqual(['rm: Read-only file system']);
    expect(run('echo hi > out.txt')).toEqual(['sh: cannot create out.txt: Read-only file system']);
    expect(run('ping central')).toEqual(['ping: network is unreachable']);
    expect(run('frobnicate')).toEqual(['sh: frobnicate: not found']);
    expect(run('shutdown')).toEqual(['shutdown: you must be root']);
  });

  it('lists a damaged archive as far as it goes, and cannot extract it', () => {
    const { run } = shell();
    expect(run('tar tf /var/spool/archive.tar')).toEqual(['tar: Unexpected EOF in archive', 'tar: Error is not recoverable: exiting now', 'a.txt', 'b.txt']);
    expect(run('tar xf /var/spool/archive.tar')[0]).toBe('tar: a.txt: Cannot open: Read-only file system');
    expect(run('file /var/spool/archive.tar notes.txt /home')).toEqual(['/var/spool/archive.tar: tar archive', 'notes.txt: ASCII text', '/home: directory']);
  });

  it('knows itself: uname, date from its clock, manual pages, history', () => {
    const { run } = shell();
    expect(run('uname -a')).toEqual(['TestUX box 1.0 m88k']);
    expect(run('date')[0]).toMatch(/^Sat Nov  2 03:12:\d\d UTC 2030$/);
    expect(run('man thing')).toEqual(['THING(8)', 'all about it']);
    expect(run('man ls')[0]).toMatch(/^ls /);
    expect(run('man nothing')).toEqual(['No manual entry for nothing']);
    expect(run('history').slice(-1)[0]).toMatch(/^\s+\d+\s+history$/);
  });

  it('completes commands and names with Tab', () => {
    const { sh } = shell();
    expect(sh.complete('hist')).toEqual({ line: 'history ', options: [] });
    expect(sh.complete('cat no')).toEqual({ line: 'cat notes.txt ', options: [] });
    expect(sh.complete('cd /ho')).toEqual({ line: 'cd /home/', options: [] });
    expect(sh.complete('cat /home/ann/')).toEqual({ line: 'cat /home/ann/', options: ['notes.txt', 'plan.txt'] });
    expect(sh.complete('ls | gr')).toEqual({ line: 'ls | grep ', options: [] });
  });

  it('reads words as a shell does: quotes keep spaces, paths are made plain', () => {
    expect(words('grep "two apples" notes.txt').words).toEqual(['grep', 'two apples', 'notes.txt']);
    expect(normal('/a/./b/../c//')).toBe('/a/c');
    expect(normal('/..')).toBe('/');
  });
});

describe('Relay 7, the machine in the game', () => {
  const relay7 = JSON.parse(readFileSync(join(__dirname, '../../public/assets/terminals/relay7.json'), 'utf8')) as Machine;
  const declared = (name: string) => new Dialogue(null).story.variablesState.GetVariableWithName(name) !== null;

  it('tells the story only what the story keeps, and every owner is a user', () => {
    const vars = [...Object.values(relay7.files).flatMap((f) => Object.keys(f.read ?? {})), ...Object.values(relay7.users).flatMap((u) => Object.keys(u.login ?? {}))];
    expect(vars.length).toBeGreaterThan(0);
    for (const v of vars) expect(declared(v), v).toBe(true);
    for (const [path, f] of Object.entries(relay7.files)) {
      expect(path.startsWith('/'), path).toBe(true);
      if (f.owner) expect(relay7.users[f.owner], `${path}: ${f.owner}`).toBeDefined();
    }
  });

  it('can be got through: the password is where she can read it, and it opens root', () => {
    const told: Record<string, unknown> = {};
    const sh = new Shell(relay7, { test: () => true, tell: (v) => Object.assign(told, v) });
    const history = sh.run('cat ~/.sh_history').lines;
    const password = relay7.users.root.password!;
    expect(history).toContain(password);
    sh.run('su');
    sh.run(password);
    expect(sh.user).toBe('root');
    sh.run('cat /root/handover.txt');
    expect(told).toMatchObject({ relay7_root: true, relay7_handover: true });
  });
});
