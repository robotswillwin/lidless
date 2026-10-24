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
    expect(run('rm notes.txt')).toEqual(['rm: notes.txt: Read-only file system']);
    expect(run('echo hi > out.txt')).toEqual(['sh: cannot create out.txt: Read-only file system']);
    expect(run('ping central')).toEqual(['ping: cannot resolve central: Unknown host']);
    expect(run('ssh central')).toEqual(['ssh: network is unreachable']);
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

  it('sudo asks for her password, and then reports her; root may', () => {
    const { sh, run } = shell();
    expect(sh.run('sudo cat /home/bob/secret').ask).toBe('[sudo] password for ann: ');
    expect(sh.askPrompt).toBe('[sudo] password for ann: ');
    expect(run('anything')).toEqual(['ann is not in the sudoers file.  This incident will be reported.']);
    run('su');
    run('sesame');
    expect(run('sudo cat /home/bob/secret')).toEqual(['the cake is in the oven']);
  });

  it('remembers: !! and !n and !word run again, shown first; cd - goes back', () => {
    const { run } = shell();
    run('echo one');
    expect(run('!!')).toEqual(['echo one', 'one']);
    expect(run('!1')).toEqual(['echo one', 'one']);
    expect(run('!ech')).toEqual(['echo one', 'one']);
    expect(run('!nothing')).toEqual(['sh: !nothing: event not found']);
    run('cd /var/log');
    expect(run('cd -')).toEqual(['/home/ann']);
    expect(run('cd -')).toEqual(['/var/log']);
  });

  it('ed: prints, numbers, answers ? and says why with h, writes nothing, and q leaves', () => {
    const { sh, run } = shell();
    expect(run('ed notes.txt')).toEqual(['21']);
    expect(sh.prompt()).toBe('');
    expect(run(',p')).toEqual(['one', 'two apples', 'three']);
    expect(run('2n')).toEqual(['2\ttwo apples']);
    expect(run('frob')).toEqual(['?']);
    expect(run('h')).toEqual(['unknown command']);
    expect(run('w')).toEqual(['?']);
    run('a');
    expect(run('typed into it')).toEqual([]);
    run('.');
    expect(run('=')).toEqual(['3']);
    expect(run('q')).toEqual([]);
    expect(sh.prompt()).toBe('ann@box:~$ ');
  });

  it('vi: shows the file, will not write it, ignores what it does not know, and :q leaves', () => {
    const { sh, run } = shell();
    const shown = run('vi notes.txt');
    expect(shown.slice(0, 3)).toEqual(['one', 'two apples', 'three']);
    expect(shown.at(-1)).toBe('"notes.txt" [readonly] 3L, 21B');
    expect(run(':w')).toEqual(["E45: 'readonly' option is set (add ! to override)"]);
    expect(run(':wq!')).toEqual(['"notes.txt" E212: Can\'t open file for writing']);
    expect(run('exit')).toEqual([]);
    expect(run('quit')).toEqual([]);
    expect(run('help')).toEqual(['Type  :q  and press <Enter> to exit']);
    expect(sh.cancel()).toEqual(['Type  :qa!  and press <Enter> to abandon all changes and exit Vim']);
    expect(run(':q')).toEqual([]);
    expect(sh.prompt()).toBe('ann@box:~$ ');
  });

  it('the text tools work through pipes: base64, tr, rot13, cut, rev, sort, md5', () => {
    const { run } = shell();
    expect(run('echo hello | base64')).toEqual(['aGVsbG8K']);
    expect(run('echo aGVsbG8K | base64 -d')).toEqual(['hello']);
    expect(run('echo Hello | tr a-z A-Z')).toEqual(['HELLO']);
    expect(run("echo Hello | tr 'A-Za-z' 'N-ZA-Mn-za-m'")).toEqual(['Uryyb']);
    expect(run('echo Uryyb | rot13')).toEqual(['Hello']);
    expect(run('echo a:b:c | cut -d: -f2')).toEqual(['b']);
    expect(run('echo abc | rev')).toEqual(['cba']);
    expect(run('echo abc | md5sum')).toEqual(['0bee89b07a248e27c83fc3d5951213c1  -']);
    expect(run('md5 notes.txt')[0]).toMatch(/^MD5 \(notes\.txt\) = [0-9a-f]{32}$/);
    expect(run('diff notes.txt plan.txt')[0]).toBe('1,3c1');
  });

  it('works sums out: expr, bc from a pipe or waiting for them, factor, cal and its missing days of 1752', () => {
    const { sh, run } = shell();
    expect(run('expr 6 "*" 7')).toEqual(['42']);
    expect(run('echo "2^10; 7/2" | bc')).toEqual(['1024', '3']);
    expect(run('echo "7/2" | bc -l')).toEqual(['3.5']);
    run('bc');
    expect(run('3 * (4 + 5)')).toEqual(['27']);
    run('quit');
    expect(sh.prompt()).toBe('ann@box:~$ ');
    expect(run('factor 360')).toEqual(['360: 2 2 2 3 3 5']);
    expect(run('cal 9 1752').slice(0, 3)).toEqual(['   September 1752', 'Su Mo Tu We Th Fr Sa', '       1  2 14 15 16']);
  });

  it('what is inside a program: strings, xxd and hexdump find its text among its bytes', () => {
    const m: Machine = { ...machine, files: { ...machine.files, '/usr/bin/relayd': { kind: 'ELF executable', size: 2048, strings: ['the key is under the mat'] } } };
    const sh = new Shell(m, { test: () => false, tell: () => {} });
    expect(sh.run('strings /usr/bin/relayd').lines).toContain('the key is under the mat');
    expect(sh.run('xxd /usr/bin/relayd').lines[0]).toMatch(/^00000000: 7f45 4c46/);
    expect(sh.run('hexdump -C notes.txt').lines[0]).toBe('00000000  6f 6e 65 0a 74 77 6f 20  61 70 70 6c 65 73 0a 74  |one.two apples.t|');
  });

  it('who was here: finger with their .plan, last, w; crontab only their own', () => {
    const m: Machine = { ...machine, users: { ...machine.users, ann: { home: '/home/ann', name: 'Ann Example' } },
      files: { ...machine.files, '/home/ann/.plan': { owner: 'ann', text: 'Fix the relay.' }, '/var/cron/tabs/ann': { owner: 'ann', mode: 'rw-------', text: '0 3 * * * /usr/bin/relayd' } } };
    const sh = new Shell(m, { test: () => false, tell: () => {} }), run = (l: string) => sh.run(l).lines;
    expect(run('finger ann')).toEqual(['Login: ann                     Name: Ann Example', 'Directory: /home/ann           Shell: /bin/sh', 'On since Sat Nov  2 03:12 (UTC) on tty1', 'No Mail.', 'Plan:', 'Fix the relay.']);
    expect(run('finger bob').at(-1)).toBe('No Plan.');
    expect(run('last')[0]).toMatch(/^ann\s+tty1\s+Sat Nov  2 03:12\s+still logged in$/);
    expect(run('crontab -l')).toEqual(['0 3 * * * /usr/bin/relayd']);
    expect(run('crontab -l -u bob')).toEqual(['crontab: must be privileged to use -u']);
  });

  it('keeps the old jokes: make love, rm -rf /, the fork bomb, lp0 on fire, xyzzy', () => {
    const { run } = shell();
    expect(run('make love')).toEqual(["make: don't know how to make love. Stop"]);
    expect(run('rm -rf /')).toEqual(['rm: "/" may not be removed']);
    expect(run(':(){ :|:& };:')).toEqual(Array(3).fill('sh: fork: Resource temporarily unavailable'));
    expect(run('lpr notes.txt')).toEqual(['lpr: lp0 on fire']);
    expect(run('xyzzy')).toEqual(['Nothing happens.']);
    expect(run('man woman')).toEqual(['No manual entry for woman']);
    expect(run('emacs')).toEqual(['sh: emacs: not found']);
  });

  it('what goes on over time: the train crosses and will not stop; yes and ping stop with Ctrl+C, and pipe', () => {
    const { sh, run } = shell();
    const sl = sh.run('sl').stream!;
    expect(sl.redraw).toBe(true);
    expect(sl.stop).toBeUndefined();
    // it comes in from the right: on screen a few frames in
    expect(sl.frame(0)!.join('').trim()).toBe('');
    expect(sl.frame(10)!.join('\n')).toMatch(/\S/);
    let k = 0;
    while (sl.frame(k)) k++;
    expect(k).toBeGreaterThan(20);
    const yes = sh.run('yes').stream!;
    expect(yes.frame(0)).toEqual(Array(6).fill('y'));
    expect(run('yes | head -n 3')).toEqual(['y', 'y', 'y']);
    const ping = sh.run('ping localhost').stream!;
    expect(ping.frame(0)![0]).toBe('PING localhost (127.0.0.1): 56 data bytes');
    expect(ping.stop!(4)[2]).toBe('4 packets transmitted, 4 packets received, 0.0% packet loss');
  });

  it('knows where its commands are and what they are for: which, type, whatis, apropos', () => {
    const { run } = shell();
    expect(run('which ls cd')).toEqual(['/bin/ls', 'cd: shell built-in command.']);
    expect(run('type grep')).toEqual(['grep is /usr/bin/grep']);
    expect(run('whatis grep')[0]).toMatch(/^grep\(1\) - /);
    expect(run('apropos archive').join(' ')).toContain('tar(1)');
    expect(run('help').join(' ')).toContain('base64');
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
