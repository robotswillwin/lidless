// An old machine's shell: a small Unix of its own over a file system written in data (public/assets/terminals/<id>.json),
// so what she finds on it is written, not generated. It is offline and its disk is mounted read-only: she can look
// through it, read, search and switch user with a password she has found, but change nothing and reach nothing beyond
// it. The story hears what she reads (a file's `read` sets its variables) and decides what is there (a file's `when`).
//
// Commands: `help` lists them (ls cd cat grep find tar su and the rest, with the text tools of shelltools.ts), with pipes
// (|), quotes, wildcards (* and ?), history (!!, !n, !word) and cd -. ed and vi are there, as stubborn as ever; and for
// those who know an old machine, the old jokes (shellfun.ts). Everything here is plain logic, with no screen:
// terminal.ts draws it, and plays what goes on over time (a stream: a train crossing, yes, ping).

import { FORTUNES, forkBomb, make, rainFrame, trainFrames } from './shellfun';
import { arith, parse, type Node as ShNode, type Redir, type Word } from './shparse';

/** A function's body, as the parser gives it. */
type FnNode = ShNode;
import { b64decode, b64encode, caesar, calc, cutList, diff, factor, hexdumpC, md5, month, tr, xxd, year } from './shelltools';

/** A file or a directory on the machine. A path ending in / is a directory. */
export interface MachineFile {
  /** What is in it, lines joined with newlines. */
  text?: string;
  owner?: string;
  /** Who may read it, as ls shows it: "rw-r--r--", owner then group then others. The group counts as others here. */
  mode?: string;
  /** When it last changed: "2031-03-12 08:15". */
  date?: string;
  /** There only while this holds: a condition on the story (conditions.ts). */
  when?: string;
  /** What reading it whole tells the story (cat, more, less): variables and their values. */
  read?: Record<string, string | number | boolean>;
  /** Not text: what `file` says it is ("ELF executable", "tar archive"); `cat` shows it as garbage. */
  kind?: string;
  /** Its size in bytes, when it is not text. */
  size?: number;
  /** An archive's entries, as `tar t` lists them. */
  entries?: string[];
  /** An archive cut short: `tar` reads this far and stops. */
  damaged?: boolean;
  /** For a file that is not text: the text inside it, as `strings` finds it (a name, a message left in a program). */
  strings?: string[];
}

export interface MachineUser {
  /** The full name, as `who` and the password file have it. */
  name?: string;
  home?: string;
  /** What `su` asks for; a user without one cannot be switched to. */
  password?: string;
  /** What switching to this user tells the story. */
  login?: Record<string, string | number | boolean>;
}

export interface Machine {
  /** The machine's name on the screen's bar. */
  name: string;
  host: string;
  /** What `uname -a` says. */
  system?: string;
  /** The machine's clock as it comes up: "2031-03-14 23:41". It runs on from there. */
  clock?: string;
  /** What it prints as it comes up, before the login. */
  boot?: string[];
  /** Who is logged in as it comes up: it was left that way. */
  user: string;
  users: Record<string, MachineUser>;
  files: Record<string, MachineFile>;
  /** Manual pages of its own, by name (man relay). */
  man?: Record<string, string>;
  /** The last logins, as `last` lists them, newest first; without, the one who was left logged in. */
  last?: string[];
}

/** What the shell asks of the game. */
export interface ShellHooks {
  /** Whether a condition on the story holds now. */
  test(cond: string): boolean;
  /** She read something that tells the story these. */
  tell(vars: Record<string, string | number | boolean>): void;
}

/** What a line typed into the shell did. */
export interface Output {
  lines: string[];
  /** The screen is cleared first. */
  clear?: boolean;
  /** The machine is left: the terminal closes. */
  exit?: boolean;
  /** The next line typed answers this, hidden as it is typed (a password). */
  ask?: string;
  /** What goes on over time: a train crossing the screen, yes, ping. */
  stream?: Stream;
}

/** Output over time: frame after frame, each after the last (lines going by) or in its place (a picture moving). */
export interface Stream {
  /** Its k-th frame, or null when it is over. */
  frame: (k: number) => string[] | null;
  /** Milliseconds between frames. */
  every: number;
  /** Each frame drawn in place of the one before. */
  redraw?: boolean;
  /** Ctrl+C stops it, printing these after it (ping's count); without, it runs to its end (sl will not be stopped). */
  stop?: (frames: number) => string[];
}

/** A command's output: what goes on down a pipe, and what goes wrong, which is shown and not passed on. */
interface Result extends Output {
  errors: string[];
}

interface Node {
  path: string;
  dir: boolean;
  file: MachineFile;
  children: string[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** "2031-03-14 23:41" as a date; a machine without a clock is stuck at the start of time. */
function parseDate(s: string | undefined): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s ?? '');
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0))) : new Date(0);
}

/** A path made plain: absolute, no dots, no doubled or trailing slashes. */
export function normal(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return `/${out.join('/')}`;
}

const parentOf = (path: string) => normal(`${path}/..`);
const baseOf = (path: string) => (path === '/' ? '/' : path.slice(path.lastIndexOf('/') + 1));

/** A word with * and ? in it, as a regular expression over a whole name. */
function globRegex(glob: string): RegExp {
  return new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
}

/** A line split into words, quotes kept together; `quoted` says which words had quotes (no wildcards in those). */
export function words(line: string): { words: string[]; quoted: boolean[] } {
  const out: string[] = [], quoted: boolean[] = [];
  let cur = '', q: string | null = null, any = false, wasQuoted = false;
  for (const ch of line) {
    if (q) {
      if (ch === q) q = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") { q = ch; any = true; wasQuoted = true; }
    else if (/\s/.test(ch)) {
      if (any) { out.push(cur); quoted.push(wasQuoted); }
      cur = ''; any = false; wasQuoted = false;
    } else { cur += ch; any = true; }
  }
  if (any) { out.push(cur); quoted.push(wasQuoted); }
  return { words: out, quoted };
}

/** printf's few forms: %s, %d, %%, and \n \t in the format; the arguments filled in, over again if there are more. */
function printf(args: string[]): string {
  if (!args.length) return '';
  const fmt = args[0].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\'), rest = args.slice(1);
  const specs = (fmt.match(/%[sdixX%]/g) ?? []).filter((s) => s !== '%%').length;
  let out = '', i = 0;
  const once = () => fmt.replace(/%[sdixX%]/g, (m) => (m === '%%' ? '%' : m === '%s' ? rest[i++] ?? '' : m === '%d' || m === '%i' ? String(parseInt(rest[i++] ?? '0', 10) || 0) : (parseInt(rest[i++] ?? '0', 10) || 0).toString(m.endsWith('x') ? 16 : 16)));
  out = once();
  while (specs && i < rest.length) out += once();
  return out;
}

/** Each command's options as letters, and its other words: `-la` is l and a; `-n 5` is n with 5 when n takes one. */
function options(args: string[], takes = ''): { flags: Set<string>; values: Record<string, string>; rest: string[] } {
  const flags = new Set<string>(), values: Record<string, string> = {}, rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { rest.push(...args.slice(i + 1)); break; }
    if (/^-\d+$/.test(a) && takes.includes('n')) { values.n = a.slice(1); continue; }
    if (a.startsWith('-') && a.length > 1) {
      for (let k = 1; k < a.length; k++) {
        const f = a[k];
        if (takes.includes(f)) { values[f] = a.slice(k + 1) || args[++i] || ''; break; }
        flags.add(f);
      }
    } else rest.push(a);
  }
  return { flags, values, rest };
}

/** Commands that would change the disk, and those that would reach beyond the machine. */
const WRITES = ['rmdir', 'mv', 'cp', 'touch', 'mkdir', 'chmod', 'chown', 'chgrp', 'ln', 'tee', 'patch', 'dd'];
const NETWORK = ['ssh', 'telnet', 'ftp', 'rlogin', 'rsh', 'curl', 'wget', 'lynx', 'nslookup', 'dig', 'traceroute', 'netstat', 'nc', 'talk'];

/** What `help` lists, and each command's manual page. */
const MANUAL: Record<string, string> = {
  help: 'help - list the commands',
  man: 'man NAME - show the manual page for NAME',
  ls: 'ls [-a] [-l] [PATH...] - list a directory. Directories are shown with a / after them;\n  -a shows hidden names (starting with .), -l shows owner, permissions, size and date',
  cd: 'cd [DIR] - change directory; cd .. goes up, cd ~ or cd alone goes home',
  pwd: 'pwd - print the directory you are in',
  cat: 'cat FILE... - print files',
  more: 'more FILE - print a file (on this terminal, the same as cat)',
  less: 'less FILE - print a file (on this terminal, the same as cat)',
  head: 'head [-n N] FILE... - print the first N lines (10)',
  tail: 'tail [-n N] FILE... - print the last N lines (10)',
  grep: 'grep [-i] [-n] [-v] [-l] [-c] [-r] PATTERN [FILE...] - print lines that match PATTERN\n  -i ignore case, -n line numbers, -v lines that do not match, -l only file names,\n  -c count, -r search directories',
  find: 'find [PATH...] [-name PATTERN] [-type f|d] - list files below PATH; PATTERN may use * and ?',
  file: 'file FILE... - say what kind of file each is',
  wc: 'wc [-l] [-w] [-c] FILE... - count lines, words and characters',
  sort: 'sort [-r] [FILE...] - sort lines',
  uniq: 'uniq [FILE] - drop repeated lines',
  tar: 'tar tf ARCHIVE - list an archive; tar xf ARCHIVE - extract it',
  echo: 'echo [WORDS...] - print words; $USER, $HOME, $PWD and $HOSTNAME are replaced',
  env: 'env - print the environment',
  date: 'date - print the date and time',
  uptime: 'uptime - how long the system has been up',
  uname: 'uname [-a] - print the system name',
  hostname: 'hostname - print the name of this machine',
  whoami: 'whoami - print your user name',
  id: 'id - print your user and group',
  who: 'who - who is logged in',
  ps: 'ps - list running processes',
  df: 'df - show the disks and how full they are',
  mount: 'mount - show the mounted disks',
  history: 'history - list the commands typed this session',
  clear: 'clear - clear the screen',
  su: 'su [USER] - become USER (root if none); asks for USER\'s password. exit goes back',
  exit: 'exit - leave: back to the user before su, or switch the terminal off',
  sudo: 'sudo COMMAND - run a command as root, if you are one of those allowed to',
  passwd: 'passwd - change your password',
  w: 'w - who is logged in, and what they are doing',
  last: 'last [USER] - the last logins, newest first',
  finger: 'finger [USER] - who is logged in; or what there is to know about USER, and their .plan',
  crontab: 'crontab -l [-u USER] - list the jobs that run at set times (another user\'s only as root)',
  dmesg: 'dmesg - what the system said as it came up',
  write: 'write USER - write to another user\'s terminal',
  wall: 'wall MESSAGE - write to every terminal',
  kill: 'kill [-SIGNAL] PID - send a signal to a process',
  which: 'which NAME... - where a command is',
  type: 'type NAME... - what a name is: a command, or part of the shell',
  apropos: 'apropos WORD - search the manual\'s one-line descriptions (man -k WORD does the same)',
  whatis: 'whatis NAME... - the one-line description of a manual page',
  stat: 'stat FILE... - a file\'s details: its size, owner, permissions and times',
  strings: 'strings FILE... - the text inside a file that is not text',
  xxd: 'xxd FILE - a file\'s bytes in hex, its text beside them',
  hexdump: 'hexdump [-C] FILE - a file\'s bytes in hex; -C with its text beside them between bars',
  od: 'od [-c] FILE - a file\'s bytes, in octal or (-c) as characters',
  md5: 'md5 FILE... - the MD5 digest of each file (md5sum prints it the other way round)',
  diff: 'diff FILE1 FILE2 - how two files differ: lines changed (c), deleted (d) and added (a)',
  base64: 'base64 [-d] [FILE] - write a file in base64, or (-d) read base64 back',
  tr: 'tr SET1 SET2, tr -d SET - change characters, or delete them; a-z is a range.\n  tr a-z A-Z shouts; tr A-Za-z N-ZA-Mn-za-m is ROT13',
  caesar: 'caesar [N] [FILE] - shift each letter N places along the alphabet (13 if N is not given)',
  rot13: 'rot13 [FILE] - shift each letter 13 places: ROT13, which is its own undoing',
  rev: 'rev [FILE...] - each line backwards',
  tac: 'tac [FILE...] - the lines, last first',
  nl: 'nl [FILE...] - the lines, numbered',
  cut: 'cut -d DELIM -f LIST [FILE...], cut -c LIST [FILE...] - fields or characters of each line;\n  LIST is like 1,3-5. cut -d: -f1 /etc/passwd lists the users',
  cal: 'cal [[MONTH] YEAR] - a calendar: this month, a month of a year, or a whole year',
  bc: 'bc [-l] - a calculator: it works out the sums it reads (echo "2^10" | bc); -l for decimals',
  expr: 'expr N OP N - work out a sum of whole numbers; OP is + - * / % (quote the *)',
  factor: 'factor N... - the prime factors of each number',
  fortune: 'fortune - a saying, at random',
  yes: 'yes [WORDS] - print WORDS (y) over and over, until Ctrl+C',
  ping: 'ping HOST - send packets to HOST and wait for them back, until Ctrl+C',
  ed: 'ed [FILE] - the standard text editor. Its commands: ,p prints, n numbers, q quits;\n  it says ? when something is wrong, and h says what',
  vi: 'vi [FILE] - the visual editor. :q quits',
  make: 'make [TARGET] - make TARGET, by the rules in the Makefile',
  lpr: 'lpr FILE - send a file to the printer',
};
const COMMANDS = [...Object.keys(MANUAL), 'logout', 'shutdown', 'halt', 'poweroff', 'reboot', 'printenv', 'mail', 'md5sum', 'vim', 'view', 'lp', 'rm'];
/** What is part of the shell itself, not a program on the disk. */
const BUILTINS = ['cd', 'pwd', 'echo', 'exit', 'logout', 'history', 'type', 'kill', 'su'];
/** Where each command's program would be. */
const binOf = (c: string) => (['ls', 'cat', 'cp', 'mv', 'rm', 'mkdir', 'ps', 'date', 'df', 'hostname', 'echo', 'ed', 'sh', 'stty', 'kill', 'pwd'].includes(c) ? '/bin' : ['fortune', 'factor', 'caesar', 'rot13'].includes(c) ? '/usr/games' : ['dmesg', 'mount', 'shutdown', 'halt', 'reboot'].includes(c) ? '/sbin' : '/usr/bin');

/** An editor or a calculator she is in: what she types goes to it, not the shell, until she leaves it. */
type Mode =
  | { kind: 'ed'; buffer: string[]; cur: number; err: string; verbose: boolean; input: boolean }
  | { kind: 'vi'; file: string; misses: number }
  | { kind: 'bc'; scale: number };

export class Shell {
  /** The users logged in, one on top of another with su: the last one is who you are. */
  private users: string[];
  cwd: string;
  readonly history: string[] = [];
  /** How many characters wide the screen is, for ls's columns. */
  cols = 64;
  private readonly nodes = new Map<string, Node>();
  /** A password asked for: to become another user (su), or to be let do something as root (sudo). */
  private pending: { kind: 'su'; user: string } | { kind: 'sudo' } | null = null;
  private mode: Mode | null = null;
  /** Where cd - goes back to. */
  private before: string | null = null;
  /** The shell's own variables (not the environment: those come from env()), set by NAME=value and read by $NAME. */
  private vars = new Map<string, string>();
  /** A function's arguments while it runs: $1, $2..., $@, $#. */
  private positional: string[] = [];
  /** Functions she wrote, by name: their body, to run when their name is a command. */
  private funcs = new Map<string, FnNode>();
  /** What the last command returned, for $? and && || : 0 is well, anything else is not. */
  private status = 0;
  /** `break` and `continue` in a loop, and a return from a function: caught where they belong. */
  private flow: { kind: 'break' | 'continue'; n: number } | { kind: 'return'; code: number } | null = null;
  private readonly started = Date.now();

  constructor(readonly machine: Machine, private readonly hooks: ShellHooks) {
    this.add('/', { owner: 'root', mode: 'rwxr-xr-x' }, true);
    for (const [path, file] of Object.entries(machine.files)) this.add(normal(path), file, path.endsWith('/'));
    this.users = [machine.user];
    this.cwd = this.homeOf(machine.user);
    if (!this.find(this.cwd)) this.cwd = '/';
  }

  /** A file or directory into the tree, and every directory above it that the data does not name. */
  private add(path: string, file: MachineFile, dir: boolean): void {
    const have = this.nodes.get(path);
    if (have) { have.file = { ...have.file, ...file }; have.dir = have.dir || dir; return; }
    this.nodes.set(path, { path, dir, file, children: [] });
    if (path === '/') return;
    const up = parentOf(path);
    if (!this.nodes.has(up)) this.add(up, {}, true);
    this.nodes.get(up)!.children.push(path);
  }

  get user(): string { return this.users[this.users.length - 1]; }
  private homeOf(user: string): string { return normal(this.machine.users[user]?.home ?? (user === 'root' ? '/root' : `/home/${user}`)); }
  /** Whether a password is being asked for: what is typed next is hidden. */
  get asking(): boolean { return !!this.pending; }
  /** What is asked, in place of the prompt. */
  get askPrompt(): string { return this.pending?.kind === 'sudo' ? `[sudo] password for ${this.user}: ` : 'Password: '; }
  /**
   * Ctrl+C: a question asked is dropped, back to the prompt. In ed it is answered with ?, and vi says how to leave it,
   * which it does not; what to print is returned.
   */
  cancel(): string[] {
    this.pending = null;
    if (this.mode?.kind === 'vi') return ['Type  :qa!  and press <Enter> to abandon all changes and exit Vim'];
    if (this.mode?.kind === 'ed') return ['?'];
    if (this.mode?.kind === 'bc') { this.mode = null; return []; }
    return [];
  }

  /** The message of the day, shown as the machine comes up: /etc/motd. */
  motd(): string[] {
    const t = this.text('cat', '/etc/motd', false);
    return 'lines' in t ? t.lines : [];
  }

  prompt(): string {
    // ed and vi have no prompt of their own, and bc waits quietly
    if (this.mode) return '';
    const home = this.homeOf(this.user), where = this.cwd === home ? '~' : this.cwd.startsWith(`${home}/`) ? `~${this.cwd.slice(home.length)}` : this.cwd;
    return `${this.user}@${this.machine.host}:${where}${this.user === 'root' ? '#' : '$'} `;
  }

  /** The machine's clock now: where it was set, run on since the terminal came up. */
  now(): Date { return new Date(parseDate(this.machine.clock).getTime() + (Date.now() - this.started)); }

  /** A node there now: hidden while it, or a directory above it, waits for the story. */
  private find(path: string): Node | null {
    const n = this.nodes.get(path);
    if (!n) return null;
    for (let p = path; ; p = parentOf(p)) {
      const w = this.nodes.get(p)?.file.when;
      if (w && !this.hooks.test(w)) return null;
      if (p === '/') break;
    }
    return n;
  }

  private kids(n: Node): Node[] {
    return n.children.map((c) => this.find(c)).filter((c): c is Node => !!c).sort((a, b) => baseOf(a.path).localeCompare(baseOf(b.path)));
  }

  private modeOf(n: Node): string { return n.file.mode ?? (n.dir ? 'rwxr-xr-x' : 'rw-r--r--'); }
  private ownerOf(n: Node): string { return n.file.owner ?? 'root'; }

  /** Whether you may read (r) a file or directory, or go into (x) a directory. */
  private may(n: Node, what: 'r' | 'x'): boolean {
    if (this.user === 'root') return true;
    const m = this.modeOf(n);
    return (this.ownerOf(n) === this.user ? m.slice(0, 3) : m.slice(6, 9)).includes(what);
  }

  /** A path as typed, made absolute: ~ is home, ~name is name's home. */
  resolve(p: string): string {
    if (p === '~' || p.startsWith('~/')) return normal(this.homeOf(this.user) + p.slice(1));
    const m = /^~([a-z_][a-z0-9_-]*)(\/.*)?$/.exec(p);
    if (m && this.machine.users[m[1]]) return normal(this.homeOf(m[1]) + (m[2] ?? ''));
    return normal(p.startsWith('/') ? p : `${this.cwd}/${p}`);
  }

  /** What is at a path, or why it cannot be reached: a missing directory on the way, one she may not go into. */
  private reach(p: string): { node: Node } | { error: 'No such file or directory' | 'Permission denied' | 'Not a directory' } {
    const path = this.resolve(p);
    for (let up = parentOf(path); ; up = parentOf(up)) {
      const d = this.find(up);
      if (!d) return { error: 'No such file or directory' };
      if (!d.dir) return { error: 'Not a directory' };
      if (!this.may(d, 'x')) return { error: 'Permission denied' };
      if (up === '/') break;
    }
    const node = this.find(path);
    return node ? { node } : { error: 'No such file or directory' };
  }

  private size(n: Node): number {
    if (n.dir) return 512;
    return n.file.size ?? (n.file.text ? new TextEncoder().encode(n.file.text).length + 1 : 0);
  }

  private stamp(n: Node): string {
    const d = parseDate(n.file.date ?? this.machine.clock), same = d.getUTCFullYear() === this.now().getUTCFullYear();
    return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${same ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : ` ${d.getUTCFullYear()}`}`;
  }

  private long(n: Node, name: string): string {
    const links = n.dir ? 2 + this.kids(n).filter((k) => k.dir).length : 1, owner = this.ownerOf(n);
    return `${n.dir ? 'd' : '-'}${this.modeOf(n)} ${String(links).padStart(2)} ${owner.padEnd(8)} ${owner.padEnd(8)} ${String(this.size(n)).padStart(6)} ${this.stamp(n)} ${name}`;
  }

  private columns(names: string[]): string[] { return columns(names, this.cols); }

  private nameOf(n: Node): string { return baseOf(n.path) + (n.dir ? '/' : ''); }

  /** A file's lines, or an error as ls and cat word it; reading it whole tells the story what it says. */
  private text(cmd: string, p: string, whole: boolean): { lines: string[] } | { error: string } {
    const r = this.reach(p);
    if ('error' in r) return { error: `${cmd}: ${p}: ${r.error}` };
    if (r.node.dir) return { error: `${cmd}: ${p}: Is a directory` };
    if (!this.may(r.node, 'r')) return { error: `${cmd}: ${p}: Permission denied` };
    const f = r.node.file;
    if (f.text === undefined) return { lines: [garbage(r.node.path, this.size(r.node))] };
    if (whole && f.read) this.hooks.tell(f.read);
    return { lines: f.text.replace(/\n$/, '').split('\n') };
  }

  /** The words of a command with wildcards matched against the names there; a word that matches nothing stays. */
  private expand(ws: string[], quoted: boolean[]): string[] {
    const out: string[] = [];
    ws.forEach((w, i) => {
      if (quoted[i] || !/[*?]/.test(w)) return out.push(w);
      const cut = w.lastIndexOf('/'), dirPart = cut >= 0 ? w.slice(0, cut + 1) : '', pat = w.slice(cut + 1);
      const r = this.reach(dirPart || '.');
      if ('error' in r || !r.node.dir || !this.may(r.node, 'r')) return out.push(w);
      const re = globRegex(pat), hit = this.kids(r.node).map((k) => baseOf(k.path)).filter((n) => re.test(n) && (pat.startsWith('.') || !n.startsWith('.')));
      if (hit.length) out.push(...hit.map((n) => dirPart + n));
      else out.push(w);
    });
    return out;
  }

  /**
   * A line typed, or the lines of a script, as a Bourne shell reads them (shparse.ts): a command, or many joined by
   * ; | && || and the rest, with variables, if, for, while, case, functions and redirections. Also the answer to a
   * password asked for, and a line for the editor she is in.
   */
  run(line: string): Output {
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      // whatever she answers, she is not one of those allowed
      if (p.kind === 'sudo') return { lines: [`${this.user} is not in the sudoers file.  This incident will be reported.`] };
      const u = this.machine.users[p.user];
      if (!u?.password || line !== u.password) return { lines: ['su: Sorry'] };
      this.users.push(p.user);
      if (u.login) this.hooks.tell(u.login);
      return { lines: [] };
    }
    if (this.mode) return { lines: this.mode.kind === 'ed' ? this.ed(line) : this.mode.kind === 'vi' ? this.vi(line) : this.bc(line) };
    if (!line.trim()) return { lines: [] };
    // history: !! the last line, !n the nth, !-n n back, !word the last that began so; shown as it runs, as a shell does
    const h = this.recall(line.trim());
    if ('error' in h) return { lines: [h.error] };
    const echo = h.line !== line.trim() ? [h.line] : [];
    this.history.push(h.line);
    if (forkBomb(h.line)) return { lines: [...echo, ...Array(3).fill('sh: fork: Resource temporarily unavailable')] };
    const tree = parse(h.line);
    if (!tree.ok) return { lines: [...echo, 'error' in tree ? tree.error : 'sh: syntax error: unexpected end of file'] };
    this.flow = null;
    const out = this.exec(tree.node, null);
    return { lines: [...echo, ...out.errors, ...out.lines], clear: out.clear, exit: out.exit, ask: out.ask, stream: out.stream };
  }

  /** Whether the shell wants more lines before it can run what has been typed so far (an open if, for, quote, pipe). */
  wantsMore(src: string): boolean {
    if (this.pending || this.mode) return false;
    const r = parse(src);
    return !r.ok && 'more' in r;
  }

  /* ---------- running the tree the parser gives ---------- */

  /** A node run, `stdin` the lines piped in or none: its output, its errors, and what it set off (a stream, an exit). */
  private exec(n: ShNode, stdin: string[] | null): Result {
    switch (n.k) {
      case 'list': {
        const lines: string[] = [], errors: string[] = [];
        let last: Result = { lines: [], errors: [] };
        for (const item of n.items) {
          last = this.exec(item, null);
          lines.push(...last.lines); errors.push(...last.errors);
          // a stream, a clear, an exit or a question ends the line here, carrying what came before it
          if (last.exit || last.clear || last.ask || last.stream || this.flow) return { ...last, lines, errors };
        }
        return { lines, errors, exit: last.exit };
      }
      case 'and': { const l = this.exec(n.left, stdin); return this.stop(l) || this.status === 0 ? this.carry(l, () => this.exec(n.right, stdin)) : l; }
      case 'or': { const l = this.exec(n.left, stdin); return this.stop(l) || this.status !== 0 ? this.carry(l, () => this.exec(n.right, stdin)) : l; }
      case 'pipe': return this.pipeline(n, stdin);
      case 'func': this.funcs.set(n.name, n.body); this.status = 0; return { lines: [], errors: [] };
      case 'if': return this.runIf(n, stdin);
      case 'for': return this.runFor(n, stdin);
      case 'while': return this.runWhile(n, stdin);
      case 'case': return this.runCase(n, stdin);
      case 'group': return this.redirected(n.redirs, stdin, (input) => this.exec(n.body, input));
      case 'simple': return this.runSimple(n, stdin);
    }
  }

  /** Whether a result ends the line here (an exit, a stream, a question): the && || after it do not run. */
  private stop(r: Result): boolean { return !!(r.exit || r.clear || r.ask || r.stream || this.flow); }
  private carry(l: Result, right: () => Result): Result { if (this.stop(l)) return l; const r = right(); return { ...r, errors: [...l.errors, ...r.errors], lines: [...l.lines, ...r.lines] }; }

  /** A pipeline a | b | c: each command's lines are the next's input; its status is the last's (`!` flips it). */
  private pipeline(n: Extract<ShNode, { k: 'pipe' }>, stdin: string[] | null): Result {
    let input = stdin, lines: string[] = [], errors: string[] = [], last: Result = { lines: [], errors: [] };
    for (const [k, cmd] of n.cmds.entries()) {
      last = this.exec(cmd, input);
      errors.push(...last.errors);
      if (last.exit || last.clear || last.ask) return { ...last, errors, lines: [...lines, ...last.lines] };
      // what goes on over time is taken as far as the next could want it (yes | head); the last one's stream flows on
      if (last.stream && k < n.cmds.length - 1) input = gather(last.stream);
      else if (last.stream) return { ...last, errors, lines };
      else input = last.lines;
      lines = last.lines;
    }
    if (n.not) this.status = this.status === 0 ? 1 : 0;
    return { lines, errors, exit: last.exit };
  }

  private runIf(n: Extract<ShNode, { k: 'if' }>, stdin: string[] | null): Result {
    return this.redirected(n.redirs, stdin, (input) => {
      const out: Result = { lines: [], errors: [] };
      for (const b of n.branches) {
        const cond = this.exec(b.cond, input);
        out.errors.push(...cond.errors);
        if (this.stop(cond)) return { ...cond, errors: out.errors };
        if (this.status === 0) { const body = this.exec(b.body, input); return { ...body, errors: [...out.errors, ...body.errors], lines: [...out.lines, ...body.lines] }; }
      }
      if (n.otherwise) { const body = this.exec(n.otherwise, input); return { ...body, errors: [...out.errors, ...body.errors], lines: [...out.lines, ...body.lines] }; }
      this.status = 0;
      return out;
    });
  }

  private runFor(n: Extract<ShNode, { k: 'for' }>, stdin: string[] | null): Result {
    return this.redirected(n.redirs, stdin, (input) => {
      const items = n.items ? n.items.flatMap((w) => this.expandWord(w, input)) : (input ?? []);
      const out: Result = { lines: [], errors: [] };
      for (const v of items) {
        this.vars.set(n.name, v);
        const body = this.exec(n.body, input);
        out.errors.push(...body.errors); out.lines.push(...body.lines);
        if (this.afterBody() === 'stop') return out;
      }
      return out;
    });
  }

  private runWhile(n: Extract<ShNode, { k: 'while' }>, stdin: string[] | null): Result {
    return this.redirected(n.redirs, stdin, (input) => {
      const out: Result = { lines: [], errors: [] };
      for (let i = 0; i < 100000; i++) {
        const cond = this.exec(n.cond, input);
        out.errors.push(...cond.errors); out.lines.push(...cond.lines);
        if (this.stop(cond)) return out;
        if ((this.status === 0) === n.until) break;
        const body = this.exec(n.body, input);
        out.errors.push(...body.errors); out.lines.push(...body.lines);
        if (this.afterBody() === 'stop') return out;
      }
      return out;
    });
  }

  /** After a loop's body: 'go' to run the next turn, 'stop' to leave. break and continue (to this level) are spent. */
  private afterBody(): 'go' | 'stop' {
    if (!this.flow) return 'go';
    if (this.flow.kind === 'break' || this.flow.kind === 'continue') {
      const kind = this.flow.kind;
      if (--this.flow.n <= 0) this.flow = null;
      // break (or a break meant for an outer loop) leaves; continue (spent here) runs the next turn
      return this.flow || kind === 'break' ? 'stop' : 'go';
    }
    // a return, an exit, a stream, a clear: leave
    return 'stop';
  }

  private runCase(n: Extract<ShNode, { k: 'case' }>, stdin: string[] | null): Result {
    return this.redirected(n.redirs, stdin, (input) => {
      const word = this.expandWord(n.word, input).join(' ');
      for (const arm of n.arms) {
        for (const pat of arm.pats) {
          // the pattern is kept whole (its * and ? match the word, not the names there)
          const p = this.expandWord(pat, input, true).join('');
          if (globRegex(p).test(word)) return this.exec(arm.body, input);
        }
      }
      this.status = 0;
      return { lines: [], errors: [] };
    });
  }

  /** A command run with its redirections: of its output away (refused: the disk is read-only), of a file or here document in. */
  private redirected(redirs: Redir[], stdin: string[] | null, run: (input: string[] | null) => Result): Result {
    let input = stdin;
    const errors: string[] = [];
    for (const r of redirs) {
      if (r.op === '>' || r.op === '>>' || (r.op === '>&' && r.fd !== 2)) {
        if (r.op !== '>&') {
          const t = this.expandWord(r.target, stdin).join('');
          // /dev/null and the standard streams are sinks, not the disk: output to them just goes nowhere
          if (!['/dev/null', '/dev/stdout', '/dev/stderr', '/dev/zero'].includes(t)) return { lines: [], errors: [`sh: cannot create ${t}: Read-only file system`] };
          // > /dev/null: the command runs, its output dropped
          const out = run(input);
          return { lines: [], errors: out.errors.filter(() => t === '/dev/stderr') };
        }
      } else if (r.op === '<<') {
        input = (r.body ?? []).map((l) => (r.raw ? l : this.substLine(l, stdin)));
      } else if (r.op === '<') {
        const t = this.expandWord(r.target, stdin).join(''), got = this.text('sh', t, false);
        if ('error' in got) return { lines: [], errors: [got.error] };
        input = got.lines;
      }
      // 2>&1 and 2>file: errors would join the output; here they are shown anyway, so nothing to do
    }
    const out = run(input);
    return { ...out, errors: [...errors, ...out.errors] };
  }

  /** A simple command: its assignments, then its words expanded and run (a function first, then the built-in commands). */
  private runSimple(n: Extract<ShNode, { k: 'simple' }>, stdin: string[] | null): Result {
    return this.redirected(n.redirs, stdin, (input) => {
      const words = n.words.flatMap((w) => this.expandWord(w, input));
      if (!words.length) {
        // only assignments: they set the shell's variables
        for (const a of n.assigns) this.vars.set(a.name, this.expandWord(a.value, input).join(''));
        this.status = 0;
        return { lines: [], errors: [] };
      }
      const [name, ...rest] = words;
      // a function she wrote: its body runs, its arguments $1, $2...
      const fn = this.funcs.get(name);
      if (fn) return this.callFn(fn, rest, input);
      // a command of the shell's own sets its own status; a file-system one's status is whether it erred
      const builtin = this.scriptBuiltin(name, rest, input);
      if (builtin) return builtin;
      const out = this.command(name, rest, input);
      this.status = out.errors.length ? (out.errors.some((e) => /not found/.test(e)) ? 127 : 1) : 0;
      return out;
    });
  }

  /** A function called: its arguments become $1.., its body runs, a return caught, then the arguments are put back. */
  private callFn(body: FnNode, args: string[], input: string[] | null): Result {
    const saved = this.positional;
    this.positional = args;
    const out = this.exec(body, input);
    this.positional = saved;
    if (this.flow?.kind === 'return') { this.status = this.flow.code; this.flow = null; }
    return out;
  }

  /** Commands that belong to the shell itself (they read or set its state), not the file-system ones in command(). */
  private scriptBuiltin(cmd: string, args: string[], input: string[] | null): Result | null {
    // each sets its own status, 0 for well; ok() is a clean well-gone result
    const ok = (...l: string[]): Result => { this.status = 0; return { lines: l, errors: [] }; };
    const bad = (code = 1, ...errors: string[]): Result => { this.status = code; return { lines: [], errors }; };
    switch (cmd) {
      case ':': case 'true': return ok();
      case 'false': return bad();
      case 'export': case 'local': case 'readonly': case 'declare': case 'unset':
        for (const a of args) { const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s.exec(a); if (m) this.vars.set(m[1], m[2]); else if (cmd === 'unset') this.vars.delete(a); }
        return ok();
      case 'set':
        if (args[0] === '--') { this.positional = args.slice(1); return ok(); }
        if (args.length) { this.positional = args; return ok(); }
        return ok(...[...this.vars.entries()].map(([k, v]) => `${k}=${v}`).sort());
      case 'test': case '[': return this.test(cmd === '[' ? args.slice(0, -1) : args);
      case 'read': {
        // a line of the input read into the variables (the rest into the last); with none, it ends (status 1)
        if (input && input.length) {
          const parts = input[0].split(/\s+/);
          args.forEach((a, i) => this.vars.set(a, i === args.length - 1 ? parts.slice(i).join(' ') : parts[i] ?? ''));
          return ok();
        }
        for (const a of args) this.vars.set(a, '');
        return bad();
      }
      case 'return': { this.flow = { kind: 'return', code: Number(args[0] ?? this.status) || 0 }; return ok(); }
      case 'break': { this.flow = { kind: 'break', n: Math.max(1, Number(args[0]) || 1) }; return ok(); }
      case 'continue': { this.flow = { kind: 'continue', n: Math.max(1, Number(args[0]) || 1) }; return ok(); }
      case 'shift': this.positional = this.positional.slice(Math.max(1, Number(args[0]) || 1)); return ok();
      case 'seq': { const r = this.seq(args); this.status = r.errors.length ? 1 : 0; return r; }
      case 'printf': return ok(...printf(args).split('\n'));
      case 'let': { try { for (const a of args) this.setArith(a); return ok(); } catch { return bad(); } }
      case 'sh': case 'bash': case 'source': case '.': {
        if (!args.length) return cmd === 'sh' || cmd === 'bash' ? ok() : bad(2, `${cmd}: filename argument required`);
        const r = this.runFile(cmd, args[0], args.slice(1));
        this.status = r.errors.length && this.flow === null ? 1 : this.status;
        return r;
      }
      default: return null;
    }
  }

  /** A script file read and run, its lines the shell's own (sh file, . file): a function it defines stays. */
  private runFile(cmd: string, path: string, args: string[]): Result {
    const got = this.text(cmd, path, false);
    if ('error' in got) return { lines: [], errors: [got.error] };
    const tree = parse(got.lines.join('\n'));
    if (!tree.ok) return { lines: [], errors: ['error' in tree ? tree.error : `${cmd}: ${path}: unexpected end of file`] };
    // sh file runs with the file's arguments; . file shares the shell's
    const shareArgs = cmd === '.' || cmd === 'source';
    const saved = this.positional;
    if (!shareArgs) this.positional = args;
    const out = this.exec(tree.node, null);
    if (!shareArgs) this.positional = saved;
    if (this.flow?.kind === 'return') this.flow = null;
    return out;
  }

  /** `let x = a + 1`: a sum worked out and kept in a variable (NAME=sum). */
  private setArith(expr: string): void {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s.exec(expr);
    if (m) this.vars.set(m[1], String(arith(m[2], (k) => this.varValue(k))));
    else arith(expr, (k) => this.varValue(k));
  }

  /** seq [first [incr]] last: the whole numbers from first to last; -w pads them to the same width with zeros. */
  private seq(args: string[]): Result {
    const pad = args[0] === '-w', nums = (pad ? args.slice(1) : args).map(Number);
    if (nums.some((n) => !Number.isFinite(n)) || !nums.length || nums.length > 3) return { lines: [], errors: ['seq: usage: seq [-w] [first [incr]] last'] };
    // seq last | seq first last | seq first incr last
    const first = nums.length === 1 ? 1 : nums[0], last = nums[nums.length - 1];
    const incr = nums.length === 3 ? nums[1] : first <= last ? 1 : -1;
    const out: string[] = [];
    if (incr !== 0) for (let x = first; incr > 0 ? x <= last : x >= last; x += incr) { out.push(String(x)); if (out.length > 100000) break; }
    const w = pad ? Math.max(0, ...out.map((s) => s.replace('-', '').length)) : 0;
    return { lines: pad ? out.map((s) => (s.startsWith('-') ? '-' + s.slice(1).padStart(w, '0') : s.padStart(w, '0'))) : out, errors: [] };
  }

  /** test / [ ... ]: the conditions a script asks — a string, -z -n, = != , -eq -lt..., a file -e -f -d -r. */
  private test(a: string[]): Result {
    const t = (ok: boolean): Result => { this.status = ok ? 0 : 1; return { lines: [], errors: [] }; };
    const node = (p: string) => this.reach(p);
    if (!a.length) return t(false);
    if (a.length === 1) return t(a[0] !== '');
    if (a.length === 2) {
      const [op, x] = a;
      if (op === '-z') return t(x === '');
      if (op === '-n') return t(x !== '');
      if (op === '!') return t(x === '');
      if (['-e', '-f', '-d', '-r', '-s', '-x'].includes(op)) { const r = node(x); if ('error' in r) return t(false); const n = r.node; return t(op === '-d' ? n.dir : op === '-f' ? !n.dir : op === '-r' || op === '-x' ? this.may(n, op === '-x' ? 'x' : 'r') : op === '-s' ? this.size(n) > 0 : true); }
      return t(false);
    }
    const [x, op, y] = a;
    if (op === '=' || op === '==') return t(x === y);
    if (op === '!=') return t(x !== y);
    if (op === '<') return t(x < y);
    if (op === '>') return t(x > y);
    const nums = ['-eq', '-ne', '-lt', '-le', '-gt', '-ge'];
    if (nums.includes(op)) { const [m, p] = [Number(x), Number(y)]; return t(op === '-eq' ? m === p : op === '-ne' ? m !== p : op === '-lt' ? m < p : op === '-le' ? m <= p : op === '-gt' ? m > p : m >= p); }
    return t(false);
  }

  /* ---------- a word expanded: what is put in it, then split and matched against the names ---------- */

  /** A variable's value: the shell's own, then the environment's; the specials $?, $#, $@, $1..., $$. */
  private varValue(name: string): string {
    if (name === '?') return String(this.status);
    if (name === '#') return String(this.positional.length);
    if (name === '@' || name === '*') return this.positional.join(' ');
    if (name === '$') return '438';
    if (name === '!') return '0';
    if (/^\d+$/.test(name)) return this.positional[Number(name) - 1] ?? '';
    return this.vars.get(name) ?? this.env()[name] ?? '';
  }

  /**
   * A word run out to the strings it stands for: what is put in it, then (unless it was quoted) split on whitespace and
   * matched against the names there. Each character carries two marks — whether it was quoted (not split), and whether
   * it came out of a variable or a command (so an unquoted * from it still matches names, but a literal \* does not).
   * `noSplit` keeps it whole (a here document line, an assignment).
   */
  private expandWord(w: Word, stdin: string[] | null, noSplit = false): string[] {
    let joined = '';
    const q: boolean[] = [], fromExp: boolean[] = [];
    const add = (text: string, quoted: boolean, expanded: boolean) => { joined += text; for (let i = 0; i < text.length; i++) { q.push(quoted); fromExp.push(expanded); } };
    for (const seg of w) {
      if (seg.t === 'lit') add(seg.v, seg.q, false);
      else if (seg.t === 'arith') add(String(this.evalArith(seg.src)), seg.q, true);
      else if (seg.t === 'cmd') add(this.subst(seg.src, stdin), seg.q, true);
      else {
        const base = this.varValue(seg.name), arg = seg.arg ? this.expandWord(seg.arg, stdin, true).join('') : '';
        const v = seg.op === '#' ? String(base.length) : seg.op === ':-' || seg.op === '-' ? (base || arg) : seg.op === ':+' ? (base ? arg : '') : seg.op === ':=' ? (base || arg) : base;
        add(v, seg.q, true);
      }
    }
    if (w.length === 0) return [];
    if (noSplit) return [joined];
    // split on runs of unquoted whitespace; a word all of literal quotes ("" or '') is still one empty word
    const parts: { text: string; glob: boolean }[] = [];
    let cur = '', had = false, globbable = false;
    for (let i = 0; i < joined.length; i++) {
      if (!q[i] && /\s/.test(joined[i])) { if (had) { parts.push({ text: cur, glob: globbable }); cur = ''; had = false; globbable = false; } }
      else { cur += joined[i]; had = true; if (!q[i] && !fromExp[i] && '*?['.includes(joined[i])) globbable = true; }
    }
    if (had) parts.push({ text: cur, glob: globbable });
    if (!parts.length && w.some((s) => s.q)) parts.push({ text: '', glob: false });
    // each part with an unquoted, literal * ? [ in it, matched against the names there
    return parts.flatMap((p) => (p.glob ? this.glob(p.text) : [p.text]));
  }

  /** A path with * ? in it, matched against the names there (the paths it matches, sorted), or itself if none. */
  private glob(pat: string): string[] { return this.expand([pat], [false]); }

  /** A here document's line with what is put in it: $NAME, ${NAME}, $(command), as in double quotes (kept whole). */
  private substLine(line: string, stdin: string[] | null): string {
    return line
      .replace(/\$\(([^]*?)\)/g, (_, src: string) => this.subst(src, stdin))
      .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name: string) => this.varValue(name))
      .replace(/\$([A-Za-z_][A-Za-z0-9_]*|[?#@*$])/g, (_, name: string) => this.varValue(name));
  }

  /** $(command) or `command`: the command run, its output as one string, trailing newlines off, newlines to spaces when split. */
  private subst(src: string, stdin: string[] | null): string {
    const tree = parse(src);
    if (!tree.ok) return '';
    const savedFlow = this.flow;
    const out = this.exec(tree.node, stdin);
    this.flow = savedFlow;
    if (out.stream) out.lines.push(...gather(out.stream));
    return [...out.errors, ...out.lines].join('\n').replace(/\n+$/, '');
  }

  /** $((sum)): the sum worked out, variables read; a bad one counts as 0. */
  private evalArith(src: string): number {
    try { return arith(src, (k) => this.varValue(k)); } catch { return 0; }
  }

  /** History in a line: !!, !n, !-n and !word made the lines they stand for; one that is not there, said so. */
  private recall(line: string): { line: string } | { error: string } {
    const h = this.history;
    let missing: string | null = null;
    const out = line.replace(/!(!|-?\d+|[A-Za-z][^\s|;]*)/g, (all, ev: string) => {
      const hit = ev === '!' ? h[h.length - 1] : /^-?\d+$/.test(ev) ? h[+ev < 0 ? h.length + +ev : +ev - 1] : [...h].reverse().find((x) => x.startsWith(ev));
      if (hit === undefined) missing ??= all;
      return hit ?? all;
    });
    return missing ? { error: `sh: ${missing}: event not found` } : { line: out };
  }

  /**
   * ed, the standard text editor, on a read-only disk: it reads the file and prints it (,p all of it, n with numbers, a
   * line by its number, Enter the next), counts its lines (=), takes text after a, i or c until a lone dot and keeps
   * none of it, and answers everything it does not like with ?. h says why; H always says why; q leaves.
   */
  private ed(line: string): string[] {
    const m = this.mode as Extract<Mode, { kind: 'ed' }>, cmd = line.trim(), last = m.buffer.length;
    if (m.input) { if (line === '.') m.input = false; return []; }
    const err = (why: string) => { m.err = why; return ['?', ...(m.verbose ? [why] : [])]; };
    if (cmd === 'q' || cmd === 'Q') { this.mode = null; return []; }
    if (cmd === 'h') return m.err ? [m.err] : [];
    if (cmd === 'H') { m.verbose = !m.verbose; return m.verbose && m.err ? [m.err] : []; }
    if (cmd === '=') return [String(last)];
    if (/^[aic]$/.test(cmd)) { m.input = true; return []; }
    if (/^w/.test(cmd)) return err('cannot open output file');
    if (cmd === '') { if (m.cur >= last) return err('invalid address'); m.cur++; return [m.buffer[m.cur - 1]]; }
    const a = /^(,|\$|\.|\d+)?(?:,(\$|\.|\d+))?([pn])?$/.exec(cmd);
    if (!a) return err('unknown command');
    const at = (x: string | undefined, d: number) => (x === undefined ? d : x === '$' ? last : x === '.' ? m.cur : +x);
    const from = a[1] === ',' ? 1 : at(a[1], m.cur), to = a[1] === ',' ? last : at(a[2], from);
    if (!last || from < 1 || to > last || from > to) return err('invalid address');
    m.cur = to;
    return m.buffer.slice(from - 1, to).map((l, k) => (a[3] === 'n' ? `${from + k}\t${l}` : l));
  }

  /** vi on a read-only disk: it can be left (:q, :q!, ZZ), not written; what else is typed it ignores, as vi does. */
  private vi(line: string): string[] {
    const m = this.mode as Extract<Mode, { kind: 'vi' }>, c = line.trim();
    if (/^(:q!?|:qa!?|:x|ZZ|ZQ)$/.test(c)) { this.mode = null; return []; }
    if (/^:w/.test(c)) return [c.includes('!') ? `"${m.file || '[No Name]'}" E212: Can't open file for writing` : "E45: 'readonly' option is set (add ! to override)"];
    if (/^:h(elp)?(\s|$)/.test(c)) return ['E149: Sorry, no help for help.txt'];
    if (c.startsWith(':')) return [`E492: Not an editor command: ${c.slice(1)}`];
    if (/^[iaoIAO]$/.test(c)) return ['-- INSERT --', 'W10: Warning: Changing a readonly file'];
    // three times lost in it, a word on the way out
    return ++m.misses % 3 === 0 ? ['Type  :q  and press <Enter> to exit'] : [];
  }

  /** bc, waiting for sums: each line worked out; quit leaves. */
  private bc(line: string): string[] {
    const m = this.mode as Extract<Mode, { kind: 'bc' }>;
    if (/^\s*quit\s*$/.test(line)) { this.mode = null; return []; }
    return sums([line], m.scale);
  }

  /** A file's bytes: its text and the newline it ends with, or, not text, the same made-up bytes every time. */
  private bytes(cmd: string, p: string): { bytes: Uint8Array; node: Node } | { error: string } {
    const r = this.reach(p);
    if ('error' in r) return { error: `${cmd}: ${p}: ${r.error}` };
    if (r.node.dir) return { error: `${cmd}: ${p}: Is a directory` };
    if (!this.may(r.node, 'r')) return { error: `${cmd}: ${p}: Permission denied` };
    const f = r.node.file;
    return { node: r.node, bytes: f.text !== undefined ? new TextEncoder().encode(f.text.replace(/\n?$/, '\n')) : madeUp(r.node.path, this.size(r.node), this.stringsOf(r.node), /exec|ELF|program/i.test(f.kind ?? '')) };
  }

  /** The text inside a file that is not text: what the story put there, and what a program's file always has. */
  private stringsOf(n: Node): string[] {
    const base = baseOf(n.path), program = /exec|ELF|program/i.test(n.file.kind ?? '');
    return [...(program ? ['/usr/libexec/ld.so', 'libc.so.96.1', `usage: ${base} [-v] [file ...]`, `${base}: %s: %s`] : []), ...(n.file.strings ?? [])];
  }

  /** A date as who and last print it: Sat Nov  2 02:47. */
  private when(d: Date): string {
    return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }

  private command(cmd: string, args: string[], stdin: string[] | null): Result {
    const lines: string[] = [], errors: string[] = [];
    const say = (...l: string[]): Result => { lines.push(...l); return { lines, errors }; };
    const fail = (...l: string[]): Result => { errors.push(...l); return { lines, errors }; };
    // what a filter reads: its files, or what the command before it in a pipe printed
    const inputs = (files: string[], name: string): { label: string; lines: string[] }[] => {
      if (!files.length) return [{ label: '', lines: stdin ?? [] }];
      const got: { label: string; lines: string[] }[] = [];
      for (const f of files) {
        const t = this.text(name, f, false);
        if ('error' in t) errors.push(t.error);
        else got.push({ label: f, lines: t.lines });
      }
      return got;
    };
    switch (cmd) {
      case 'help':
        return say('Commands on this system:', ...this.columns(Object.keys(MANUAL)), '', 'man NAME tells more. The disk is read-only; there is no network.');
      case 'man': {
        if (!args[0]) return fail('What manual page do you want?');
        const page = this.machine.man?.[args[0]] ?? MANUAL[args[0]];
        return page ? say(...page.split('\n')) : fail(`No manual entry for ${args[0]}`);
      }
      case 'pwd':
        return say(this.cwd);
      case 'cd': {
        // cd - goes back where it was, and says where that is
        const back = args[0] === '-', p = back ? this.before ?? '' : args[0] ?? '~';
        if (back && !this.before) return fail('cd: OLDPWD not set');
        const r = this.reach(p);
        if ('error' in r) return fail(`cd: ${p}: ${r.error}`);
        if (!r.node.dir) return fail(`cd: ${p}: Not a directory`);
        if (!this.may(r.node, 'x')) return fail(`cd: ${p}: Permission denied`);
        this.before = this.cwd;
        this.cwd = r.node.path;
        return back ? say(this.cwd) : say();
      }
      case 'ls': {
        const { flags, rest } = options(args), all = flags.has('a'), long = flags.has('l'), targets = rest.length ? rest : ['.'];
        const files: Node[] = [], dirs: { p: string; n: Node }[] = [];
        for (const p of targets) {
          const r = this.reach(p);
          if ('error' in r) errors.push(`ls: ${p}: ${r.error}`);
          else if (r.node.dir) dirs.push({ p, n: r.node });
          else files.push(r.node);
        }
        if (files.length) lines.push(...(long ? files.map((f) => this.long(f, baseOf(f.path))) : this.columns(files.map((f) => baseOf(f.path)))));
        for (const { p, n } of dirs) {
          if (targets.length > 1) lines.push(...(lines.length ? [''] : []), `${p}:`);
          if (!this.may(n, 'r')) { errors.push(`ls: ${p}: Permission denied`); continue; }
          const kids = this.kids(n).filter((k) => all || !baseOf(k.path).startsWith('.'));
          if (long) {
            lines.push(`total ${kids.reduce((s, k) => s + Math.ceil(this.size(k) / 512), 0)}`);
            if (all) lines.push(this.long(n, '.'), this.long(this.find(parentOf(n.path)) ?? n, '..'));
            lines.push(...kids.map((k) => this.long(k, baseOf(k.path))));
          } else lines.push(...this.columns([...(all ? ['./', '../'] : []), ...kids.map((k) => this.nameOf(k))]));
        }
        return { lines, errors };
      }
      case 'cat': case 'more': case 'less': case 'mail': {
        if (cmd === 'mail' && args.length) return fail('mail: network is unreachable');
        const files = cmd === 'mail' ? [`/var/mail/${this.user}`] : args;
        if (!files.length) return cmd === 'cat' ? say(...(stdin ?? [])) : fail(`${cmd}: no file named`);
        for (const f of files) {
          const t = this.text(cmd, f, true);
          if ('error' in t) errors.push(cmd === 'mail' ? `No mail for ${this.user}` : t.error);
          else lines.push(...t.lines);
        }
        return { lines, errors };
      }
      case 'head': case 'tail': {
        const { values, rest } = options(args, 'n'), n = Math.max(0, Number(values.n ?? 10) || 0), ins = inputs(rest, cmd);
        ins.forEach((i, k) => {
          if (ins.length > 1) lines.push(...(k ? [''] : []), `==> ${i.label} <==`);
          lines.push(...(cmd === 'head' ? i.lines.slice(0, n) : i.lines.slice(Math.max(0, i.lines.length - n))));
        });
        return { lines, errors };
      }
      case 'grep': {
        const { flags, rest } = options(args), pattern = rest[0];
        if (pattern === undefined) return fail('usage: grep [-i] [-n] [-v] [-l] [-c] [-r] PATTERN [FILE...]');
        let re: RegExp;
        try { re = new RegExp(pattern, flags.has('i') ? 'i' : ''); } catch { re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags.has('i') ? 'i' : ''); }
        let files = rest.slice(1);
        if (flags.has('r') || flags.has('R')) files = this.walk(files.length ? files : ['.'], errors, 'grep').filter((x) => !x.node.dir).map((x) => x.label);
        const ins = inputs(files, 'grep'), many = ins.length > 1;
        for (const i of ins) {
          const hits = i.lines.map((l, k) => ({ l, k })).filter(({ l }) => re.test(l) !== flags.has('v'));
          if (flags.has('l')) { if (hits.length) lines.push(i.label || '(standard input)'); continue; }
          if (flags.has('c')) { lines.push(`${many ? `${i.label}:` : ''}${hits.length}`); continue; }
          lines.push(...hits.map(({ l, k }) => `${many ? `${i.label}:` : ''}${flags.has('n') ? `${k + 1}:` : ''}${l}`));
        }
        return { lines, errors };
      }
      case 'find': {
        const roots: string[] = [];
        let name: RegExp | null = null, type: string | null = null;
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '-name' || args[i] === '-iname') { name = new RegExp(globRegex(args[++i] ?? '*').source, args[i - 1] === '-iname' ? 'i' : ''); }
          else if (args[i] === '-type') type = args[++i] ?? null;
          else if (args[i].startsWith('-')) return fail(`find: unknown predicate \`${args[i]}'`);
          else roots.push(args[i]);
        }
        for (const root of roots.length ? roots : ['.']) {
          for (const { node, label } of this.walk([root], errors, 'find', true)) {
            if (name && !name.test(baseOf(node.path))) continue;
            if (type && (type === 'd') !== node.dir) continue;
            lines.push(label);
          }
        }
        return { lines, errors };
      }
      case 'file': {
        if (!args.length) return fail('usage: file FILE...');
        for (const p of args) {
          const r = this.reach(p);
          if ('error' in r) { errors.push(`${p}: cannot open (${r.error})`); continue; }
          const f = r.node.file;
          lines.push(`${p}: ${r.node.dir ? 'directory' : f.kind ?? (f.text === undefined ? 'data' : f.text.trim() ? 'ASCII text' : 'empty')}`);
        }
        return { lines, errors };
      }
      case 'wc': {
        const { flags, rest } = options(args), ins = inputs(rest, 'wc'), only = flags.size ? flags : new Set(['l', 'w', 'c']);
        for (const i of ins) {
          const text = i.lines.join('\n'), cols: string[] = [];
          if (only.has('l')) cols.push(String(i.lines.length).padStart(7));
          if (only.has('w')) cols.push(String(text.split(/\s+/).filter(Boolean).length).padStart(7));
          if (only.has('c')) cols.push(String(text.length + (i.lines.length ? 1 : 0)).padStart(7));
          lines.push(`${cols.join(' ')}${i.label ? ` ${i.label}` : ''}`);
        }
        return { lines, errors };
      }
      case 'sort': {
        const { flags, rest } = options(args), all = inputs(rest, 'sort').flatMap((i) => i.lines).sort((a, b) => a.localeCompare(b));
        return say(...(flags.has('r') ? all.reverse() : all));
      }
      case 'uniq':
        return say(...inputs(args, 'uniq').flatMap((i) => i.lines).filter((l, k, a) => k === 0 || l !== a[k - 1]));
      case 'tar': {
        const mode = (args[0] ?? '').replace(/^-/, ''), file = args[1];
        if (!/[tx]/.test(mode) || !file) return fail('usage: tar tf ARCHIVE, tar xf ARCHIVE');
        const r = this.reach(file);
        if ('error' in r) return fail(`tar: ${file}: Cannot open: ${r.error}`);
        if (!this.may(r.node, 'r')) return fail(`tar: ${file}: Cannot open: Permission denied`);
        if (!r.node.file.entries) return fail('tar: This does not look like a tar archive');
        if (mode.includes('x')) return fail(`tar: ${r.node.file.entries[0] ?? file}: Cannot open: Read-only file system`, 'tar: Exiting with failure status due to previous errors');
        lines.push(...r.node.file.entries);
        if (r.node.file.damaged) errors.push('tar: Unexpected EOF in archive', 'tar: Error is not recoverable: exiting now');
        return { lines, errors };
      }
      case 'echo': {
        // the words joined as they came (already expanded); a newline in one (from "$(cmd)") starts a new line on screen
        const words = args[0] === '-n' ? args.slice(1) : args;
        return say(...words.join(' ').split('\n'));
      }
      case 'env': case 'printenv':
        return say(...Object.entries(this.env()).map(([k, v]) => `${k}=${v}`));
      case 'date': {
        const d = this.now();
        return say(`${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC ${d.getUTCFullYear()}`);
      }
      case 'uptime': {
        const d = this.now(), mins = Math.floor((Date.now() - this.started) / 60000);
        return say(` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}  up ${mins} min,  ${this.users.length} user${this.users.length > 1 ? 's' : ''},  load average: 0.08, 0.03, 0.01`);
      }
      case 'uname':
      {
        const [name, ...rest] = (this.machine.system ?? 'Unix').split(' ');
        return say(args.includes('-a') ? [name, this.machine.host, ...rest].join(' ') : name);
      }
      case 'hostname':
        return say(this.machine.host);
      case 'whoami':
        return say(this.user);
      case 'id':
        return say(`uid=${this.user === 'root' ? 0 : 1000 + Object.keys(this.machine.users).indexOf(this.user)}(${this.user}) gid=${this.user === 'root' ? 0 : 100}(${this.user === 'root' ? 'wheel' : 'users'})`);
      case 'who':
        return say(...this.users.map((u, k) => `${u.padEnd(9)}${k ? 'ttyp0' : 'tty1 '}    ${this.stamp({ path: '', dir: false, children: [], file: { date: this.machine.clock } })}`));
      case 'ps':
        return say('  PID TTY      TIME CMD', '    1 ?    00:00:01 init', '   41 ?    00:00:00 syslogd', '   58 tty1 00:00:00 getty', ...this.users.map((_, k) => `  ${String(112 + k * 31).padStart(3)} tty1 00:00:00 sh`), `  ${String(160 + this.history.length).padStart(3)} tty1 00:00:00 ps`);
      case 'df':
        return say('Filesystem  1K-blocks    Used  Avail Capacity  Mounted on', '/dev/sd0a      198342  171210  27132      86%  /  (read-only)');
      case 'mount':
        return say('/dev/sd0a on / type ffs (ro, local)');
      case 'history':
        return say(...this.history.map((h, k) => `${String(k + 1).padStart(4)}  ${h}`));
      case 'clear':
        return { lines: [], errors: [], clear: true };
      case 'su': case 'login': {
        const who = args.find((a) => a !== '-') ?? 'root';
        if (!this.machine.users[who]) return fail(`su: unknown login: ${who}`);
        if (who === this.user) return say();
        this.pending = { kind: 'su', user: who };
        return { lines: [], errors: [], ask: 'Password:' };
      }
      case 'exit': case 'logout':
        if (this.users.length > 1) { this.users.pop(); return say(); }
        return { lines: ['logout'], errors: [], exit: true };
      case 'shutdown': case 'halt': case 'poweroff': case 'reboot':
        if (this.user !== 'root') return fail(`${cmd}: you must be root`);
        return { lines: ['', 'System shutdown time has arrived', 'syncing disks... done'], errors: [], exit: true };
      case 'sudo': {
        if (!args.length) return fail('usage: sudo command');
        // root may; anyone else is asked for their password, and then told
        if (this.user === 'root') return this.command(args[0], args.slice(1), stdin);
        this.pending = { kind: 'sudo' };
        return { lines, errors, ask: this.askPrompt };
      }
      case 'passwd':
        return say(`Changing local password for ${this.user}.`), fail('passwd: /etc/master.passwd: Read-only file system');
      case 'w': {
        const d = this.now(), mins = Math.max(1, Math.floor((Date.now() - this.started) / 60000)), on = parseDate(this.machine.clock);
        return say(` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}  up ${mins} min${mins > 1 ? 's' : ''},  ${this.users.length} user${this.users.length > 1 ? 's' : ''},  load averages: 0.08, 0.03, 0.01`,
          'USER       TTY FROM     LOGIN@  IDLE WHAT', ...this.users.map((u, k) => `${u.padEnd(10)} ${k ? 'p0' : 'C0'}  -        ${pad(on.getUTCHours())}:${pad(on.getUTCMinutes())}      - ${k === this.users.length - 1 ? 'w' : 'su'}`));
      }
      case 'last': {
        const on = parseDate(this.machine.clock), boot = new Date(on.getTime() - 6 * 60000), who = args.find((a) => !a.startsWith('-'));
        const rows = this.machine.last ?? [`${this.machine.user.padEnd(9)} tty1     ${this.when(on)}   still logged in`, `reboot    ~        ${this.when(boot)}`];
        return say(...(who ? rows.filter((r) => r.split(/\s+/)[0] === who) : rows), '', `wtmp begins ${this.when(new Date(boot.getTime() - 29 * 86400000))}`);
      }
      case 'finger': {
        const far = args.find((a) => a.includes('@'));
        if (far) return fail(`finger: ${far.split('@').pop()}: network is unreachable`);
        const on = parseDate(this.machine.clock);
        if (!args.length) return say('Login     Name                 Tty  Idle  Login Time', ...[...new Set(this.users)].map((u) => `${u.padEnd(10)}${(this.machine.users[u]?.name ?? '').padEnd(21)}*C0     -  ${this.when(on).slice(0, 3)} ${this.when(on).slice(-5)}`));
        for (const who of args) {
          const u = this.machine.users[who];
          if (!u) { errors.push(`finger: ${who}: no such user.`); continue; }
          if (lines.length) lines.push('');
          lines.push(`Login: ${who.padEnd(24)}Name: ${u.name ?? ''}`, `Directory: ${this.homeOf(who).padEnd(20)}Shell: /bin/sh`);
          lines.push(this.users.includes(who) ? `On since ${this.when(on)} (UTC) on tty1` : 'Never logged in.');
          lines.push(this.find(`/var/mail/${who}`) ? 'Mail last read some time ago.' : 'No Mail.');
          // their plans, if anyone may read them, as finger reads them
          for (const [file, label] of [['.project', 'Project: '], ['.plan', 'Plan:']] as const) {
            const n = this.find(`${this.homeOf(who)}/${file}`);
            if (n?.file.text !== undefined && (this.modeOf(n)[6] === 'r' || this.may(n, 'r'))) lines.push(...(label === 'Plan:' ? [label, ...n.file.text.replace(/\n$/, '').split('\n')] : [label + n.file.text.split('\n')[0]]));
            else if (label === 'Plan:') lines.push('No Plan.');
          }
        }
        return { lines, errors };
      }
      case 'crontab': {
        const { flags, values } = options(args, 'u');
        if (flags.has('e') || flags.has('r')) return fail('crontab: /var/cron/tabs: Read-only file system');
        if (!flags.has('l')) return fail('usage: crontab [-u user] -l');
        if (values.u && this.user !== 'root') return fail('crontab: must be privileged to use -u');
        const who = values.u ?? this.user, n = this.find(`/var/cron/tabs/${who}`);
        if (!n || n.file.text === undefined) return fail(`crontab: no crontab for ${who}`);
        return say(...n.file.text.replace(/\n$/, '').split('\n'));
      }
      case 'dmesg':
        return say(...(this.machine.boot?.length ? this.machine.boot : ['(the messages are gone: the buffer has wrapped)']));
      case 'write': {
        if (!args[0]) return fail('usage: write user [tty]');
        return fail(this.users.includes(args[0]) && args[0] !== this.user ? `write: ${args[0]} has messages disabled` : `write: ${args[0]} is not logged in`);
      }
      case 'wall': {
        const d = this.now();
        return say(`Broadcast Message from ${this.user}@${this.machine.host}`, `        (/dev/ttyC0) at ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} ...`, '', args.join(' ') || (stdin ?? []).join(' '));
      }
      case 'kill': {
        const pids = args.filter((a) => !a.startsWith('-'));
        if (!pids.length) return fail('usage: kill [-s signal_name] pid ...');
        const known = [1, 41, 58, ...this.users.map((_, k) => 112 + k * 31)];
        return fail(...pids.map((p) => `kill: ${p}: ${!/^\d+$/.test(p) ? 'illegal process id' : known.includes(+p) ? 'Operation not permitted' : 'No such process'}`));
      }
      case 'which': case 'type': {
        if (!args.length) return fail(`usage: ${cmd} name ...`);
        for (const a of args) {
          if (BUILTINS.includes(a)) lines.push(cmd === 'type' ? `${a} is a shell builtin` : `${a}: shell built-in command.`);
          else if (COMMANDS.includes(a)) lines.push(cmd === 'type' ? `${a} is ${binOf(a)}/${a}` : `${binOf(a)}/${a}`);
          else errors.push(cmd === 'type' ? `sh: type: ${a}: not found` : `which: no ${a} in (/bin:/usr/bin:/usr/games:/usr/local/bin)`);
        }
        return { lines, errors };
      }
      case 'apropos': case 'whatis': {
        if (!args.length) return fail(`${cmd} what?`);
        const pages = { ...MANUAL, ...this.machine.man }, one = (name: string) => `${name}(1) - ${(pages[name] ?? '').split('\n')[0].replace(/^.*? - /, '')}`;
        const hits = Object.keys(pages).filter((name) => (cmd === 'whatis' ? args.includes(name) : args.some((a) => name.includes(a) || pages[name].split('\n')[0].toLowerCase().includes(a.toLowerCase()))));
        return hits.length ? say(...hits.sort().map(one)) : fail(...args.map((a) => `${a}: nothing appropriate`));
      }
      case 'stat': {
        if (!args.length) return fail('usage: stat file ...');
        for (const p of args) {
          const r = this.reach(p);
          if ('error' in r) { errors.push(`stat: ${p}: ${r.error}`); continue; }
          const n = r.node, mode = `${n.dir ? 'd' : '-'}${this.modeOf(n)}`, oct = [0, 3, 6].map((k) => [...this.modeOf(n).slice(k, k + 3)].reduce((s, c, i) => s + (c !== '-' ? [4, 2, 1][i] : 0), 0)).join('');
          lines.push(`  File: "${p}"`, `  Size: ${this.size(n)}  Blocks: ${Math.ceil(this.size(n) / 512)}  ${n.dir ? 'directory' : 'regular file'}`,
            `Access: (0${oct}/${mode})  Uid: ${this.ownerOf(n)}  Gid: ${this.ownerOf(n) === 'root' ? 'wheel' : 'users'}`, `Modify: ${this.when(parseDate(n.file.date ?? this.machine.clock))} UTC`);
        }
        return { lines, errors };
      }
      case 'strings': {
        if (!args.length) return fail('usage: strings file ...');
        for (const p of args) {
          const r = this.reach(p);
          if ('error' in r) { errors.push(`strings: ${p}: ${r.error}`); continue; }
          if (r.node.dir) { errors.push(`strings: ${p}: Is a directory`); continue; }
          if (!this.may(r.node, 'r')) { errors.push(`strings: ${p}: Permission denied`); continue; }
          lines.push(...(r.node.file.text !== undefined ? r.node.file.text.split('\n').filter((l) => l.trim().length >= 4) : this.stringsOf(r.node)));
        }
        return { lines, errors };
      }
      case 'xxd': case 'hexdump': case 'od': {
        const { flags, rest } = options(args), b = rest[0] ? this.bytes(cmd, rest[0]) : { bytes: new TextEncoder().encode((stdin ?? []).join('\n') + '\n') };
        if ('error' in b) return fail(b.error);
        if (cmd === 'xxd') return say(...xxd(b.bytes));
        if (cmd === 'hexdump') return say(...(flags.has('C') ? hexdumpC(b.bytes) : xxd(b.bytes).map((l) => l.replace(/:/, '').replace(/ {2}.*$/, ''))));
        const out: string[] = [], esc: Record<number, string> = { 0: '\\0', 9: '\\t', 10: '\\n', 13: '\\r' };
        for (let o = 0; o < b.bytes.length && out.length < 64; o += 16) out.push(`${o.toString(8).padStart(7, '0')} ${[...b.bytes.slice(o, o + 16)].map((x) => (esc[x] ?? (x >= 32 && x < 127 ? String.fromCharCode(x) : x.toString(8).padStart(3, '0'))).padStart(4)).join('')}`);
        return say(...out, b.bytes.length.toString(8).padStart(7, '0'));
      }
      case 'md5': case 'md5sum': {
        if (!args.length) { const d = md5((stdin ?? []).map((l) => `${l}\n`).join('')); return say(cmd === 'md5' ? d : `${d}  -`); }
        for (const p of args) {
          const b = this.bytes(cmd, p);
          if ('error' in b) { errors.push(b.error); continue; }
          const d = md5(b.bytes);
          lines.push(cmd === 'md5' ? `MD5 (${p}) = ${d}` : `${d}  ${p}`);
        }
        return { lines, errors };
      }
      case 'diff': {
        if (args.length !== 2) return fail('usage: diff file1 file2');
        const [a, b] = args.map((f) => this.text('diff', f, false));
        if ('error' in a) return fail(a.error);
        if ('error' in b) return fail(b.error);
        return say(...diff(a.lines, b.lines));
      }
      case 'base64': {
        const { flags, rest } = options(args), text = inputs(rest, 'base64').map((i) => i.lines.join('\n')).join('\n');
        if (flags.has('d') || flags.has('D')) { const d = b64decode(text); return d === null ? fail('base64: invalid input') : say(...d.replace(/\n$/, '').split('\n')); }
        return say(...b64encode(`${text}\n`));
      }
      case 'tr': {
        const { flags, rest } = options(args), del = flags.has('d');
        if (rest.length < (del ? 1 : 2)) return fail('usage: tr [-d] string1 [string2]');
        return say(...tr(stdin ?? [], rest[0], del ? null : rest[1]));
      }
      case 'caesar': case 'rot13': {
        const n = cmd === 'rot13' ? 13 : /^-?\d+$/.test(args[0] ?? '') ? Number(args[0]) : 13, files = cmd === 'caesar' && /^-?\d+$/.test(args[0] ?? '') ? args.slice(1) : args;
        return say(...inputs(files, cmd).flatMap((i) => i.lines).map((l) => caesar(l, n)));
      }
      case 'rev':
        return say(...inputs(args, cmd).flatMap((i) => i.lines).map((l) => [...l].reverse().join('')));
      case 'tac':
        return say(...inputs(args, cmd).flatMap((i) => i.lines).reverse());
      case 'nl': {
        let k = 0;
        return say(...inputs(args, cmd).flatMap((i) => i.lines).map((l) => (l.trim() ? `${String(++k).padStart(6)}\t${l}` : '')));
      }
      case 'cut': {
        const { values, rest } = options(args, 'dfc'), keep = cutList(values.f ?? values.c ?? ''), d = values.d || '\t';
        if (!keep) return fail('usage: cut -c list [file ...], cut -f list [-d delim] [file ...]');
        return say(...inputs(rest, cmd).flatMap((i) => i.lines).map((l) => (values.c !== undefined ? [...l].filter((_, k) => keep(k + 1)).join('') : l.includes(d) ? l.split(d).filter((_, k) => keep(k + 1)).join(d) : l)));
      }
      case 'cal': {
        const now = this.now(), nums = args.map(Number);
        if (nums.some((n) => !Number.isInteger(n) || n < 1)) return fail('usage: cal [[month] year]');
        if (!nums.length) return say(...month(now.getUTCMonth() + 1, now.getUTCFullYear()).map((l) => l.trimEnd()));
        if (nums.length === 1) return nums[0] > 9999 ? fail(`cal: year ${nums[0]} not in range 1..9999`) : say(...year(nums[0]).map((l) => l.trimEnd()));
        if (nums[0] > 12) return fail(`cal: ${nums[0]} is neither a month number (1..12) nor a name`);
        return say(...month(nums[0], nums[1]).map((l) => l.trimEnd()));
      }
      case 'bc': {
        const { flags, rest } = options(args), scale = flags.has('l') ? 20 : 0;
        if (!rest.length && stdin === null) { this.mode = { kind: 'bc', scale }; return say('bc 1.07.1', 'For details type `warranty\'. quit to leave.'); }
        const r = sums(rest.length ? inputs(rest, cmd).flatMap((i) => i.lines) : stdin ?? [], scale);
        return say(...r);
      }
      case 'expr': {
        if (!args.length) return fail('usage: expr expression');
        const r = calc(args.map((a) => a.replace(/^\\/, '')).join(' '));
        return 'error' in r ? fail(`expr: ${r.error}`) : say(r.value);
      }
      case 'factor': {
        const ns = args.length ? args : (stdin ?? []).flatMap((l) => l.split(/\s+/)).filter(Boolean);
        for (const n of ns) { if (!/^\d+$/.test(n) || +n < 1 || +n > 2 ** 40) errors.push(`factor: ${n} is not a valid positive integer`); else lines.push(factor(+n)); }
        return { lines, errors };
      }
      case 'fortune': {
        // its own fortunes, if it has them, between lines of %
        const own = this.find('/usr/share/games/fortune/fortunes')?.file.text?.split(/\n%\n?/).map((f) => f.trim()).filter(Boolean);
        const all = own?.length ? own : FORTUNES;
        return say(...all[Math.floor(Math.random() * all.length)].split('\n'));
      }
      case 'yes': {
        const word = args.join(' ') || 'y';
        return { lines, errors, stream: { frame: (k) => (k < 400 ? Array(6).fill(word) : null), every: 30, stop: () => [] } };
      }
      case 'ping': {
        const host = args.find((a) => !a.startsWith('-'));
        if (!host) return fail('usage: ping [-c count] host');
        if (!['localhost', '127.0.0.1', '::1', this.machine.host].includes(host)) return fail(/^[\d.]+$/.test(host) ? 'ping: sendto: Network is unreachable' : `ping: cannot resolve ${host}: Unknown host`);
        const ip = host === '::1' ? '::1' : '127.0.0.1', reply = (k: number) => `64 bytes from ${ip}: icmp_seq=${k} ttl=255 time=0.${String(41 + ((k * 37) % 29)).padStart(3, '0')} ms`;
        return { lines, errors, stream: { frame: (k) => (k < 1000 ? (k ? [reply(k)] : [`PING ${host} (${ip}): 56 data bytes`, reply(0)]) : null), every: 1000,
          stop: (n) => ['', `--- ${host} ping statistics ---`, `${n} packets transmitted, ${n} packets received, 0.0% packet loss`, 'round-trip min/avg/max/std-dev = 0.041/0.055/0.069/0.008 ms'] } };
      }
      case 'ed': {
        let buffer: string[] = [];
        if (args[0]) {
          const b = this.bytes('ed', args[0]);
          if ('error' in b) lines.push(`${args[0]}: ${b.error.split(': ').pop()}`);
          else { buffer = new TextDecoder().decode(b.bytes).replace(/\n$/, '').split('\n'); lines.push(String(b.bytes.length)); }
        }
        this.mode = { kind: 'ed', buffer, cur: buffer.length, err: '', verbose: false, input: false };
        return { lines, errors };
      }
      case 'vi': case 'vim': case 'view': {
        const f = args[0];
        let body: string[] = [], status = '';
        if (f) {
          const b = this.bytes('vi', f);
          if ('error' in b) status = `"${f}" ${/denied/.test(b.error) ? '[Permission Denied]' : '[New File]'}`;
          else { body = new TextDecoder().decode(b.bytes).replace(/\n$/, '').split('\n'); status = `"${f}" [readonly] ${body.length}L, ${b.bytes.length}B`; }
        }
        this.mode = { kind: 'vi', file: f ?? '', misses: 0 };
        const shown = body.slice(0, 16);
        return say(...shown, ...Array(Math.max(1, 8 - shown.length)).fill('~'), status);
      }
      case 'rm': {
        const { flags, rest } = options(args);
        if (!rest.length) return fail('usage: rm [-dfiPRrv] file ...');
        if ((flags.has('r') || flags.has('R')) && rest.some((r) => this.resolve(r) === '/')) return fail('rm: "/" may not be removed');
        return fail(...rest.map((r) => `rm: ${r}: Read-only file system`));
      }
      case 'make':
        return fail(...make(args));
      case 'lpr': case 'lp':
        return args.length || stdin ? fail(`${cmd}: lp0 on fire`) : fail(`usage: ${cmd} file ...`);
      case 'sl':
        // the train, for whoever meant ls: it crosses the screen, and Ctrl+C will not stop it
        { const frames = trainFrames(this.cols); return { lines, errors, stream: { frame: (k) => frames[k] ?? null, every: 45, redraw: true } }; }
      case 'cmatrix':
        return { lines, errors, stream: { frame: (k) => (k < 3000 ? rainFrame(k, this.cols) : null), every: 70, redraw: true, stop: () => [] } };
      case 'xyzzy': case 'plugh':
        return say('Nothing happens.');
      case 'adventure': case 'advent':
        return fail(`${cmd}: /usr/games/lib/adventure.dat: damaged`);
      case 'rogue': case 'hack': case 'nethack':
        return fail(`${cmd}: /var/games/${cmd}.scores: Read-only file system`, 'You die...');
      default:
        if (WRITES.includes(cmd)) return fail(`${cmd}: Read-only file system`);
        if (NETWORK.includes(cmd)) return fail(`${cmd}: network is unreachable`);
        return fail(`sh: ${cmd}: not found`);
    }
  }

  private env(): Record<string, string> {
    return { HOME: this.homeOf(this.user), USER: this.user, LOGNAME: this.user, PWD: this.cwd, HOSTNAME: this.machine.host, SHELL: '/bin/sh', TERM: 'vt220', PATH: '/bin:/usr/bin:/usr/local/bin' };
  }

  /**
   * Everything below the given places that can be read, each with its path as typed from where it started (find and
   * grep -r print those); the places themselves too with `withRoots`, and a file given as a place always. What cannot
   * be read is said in `errors`.
   */
  private walk(roots: string[], errors: string[], cmd: string, withRoots = false): { node: Node; label: string }[] {
    const out: { node: Node; label: string }[] = [];
    const below = (label: string, name: string) => (label === '/' ? `/${name}` : `${label.replace(/\/$/, '')}/${name}`);
    const go = (n: Node, label: string) => {
      if (!n.dir) return;
      if (!this.may(n, 'r') || !this.may(n, 'x')) { errors.push(`${cmd}: ${label}: Permission denied`); return; }
      for (const k of this.kids(n)) {
        const l = below(label, baseOf(k.path));
        out.push({ node: k, label: l });
        go(k, l);
      }
    };
    for (const root of roots) {
      const r = this.reach(root);
      if ('error' in r) { errors.push(`${cmd}: ${root}: ${r.error}`); continue; }
      if (withRoots || !r.node.dir) out.push({ node: r.node, label: root });
      go(r.node, root);
    }
    return out;
  }

  /** The names in the directory she is in, as she would type them (for the screen's keys). */
  names(): string[] {
    const here = this.find(this.cwd);
    return here && this.may(here, 'r') ? this.kids(here).filter((k) => !baseOf(k.path).startsWith('.')).map((k) => this.nameOf(k)) : [];
  }

  /**
   * The last word of a line completed, as Tab does: a command first, then a path. One match completes it (a directory
   * with its /); several complete as far as they agree, and are listed.
   */
  complete(line: string): { line: string; options: string[] } {
    const m = /^(.*?)(\S*)$/.exec(line)!, before = m[1], word = m[2];
    const first = !/\S/.test(before.replace(/.*\|/, ''));
    let opts: string[];
    if (first) opts = COMMANDS.filter((c) => c.startsWith(word)).sort();
    else {
      const cut = word.lastIndexOf('/'), dirPart = cut >= 0 ? word.slice(0, cut + 1) : '', stem = word.slice(cut + 1);
      const r = this.reach(dirPart || '.');
      opts = 'error' in r || !r.node.dir || !this.may(r.node, 'r') ? [] : this.kids(r.node).map((k) => this.nameOf(k)).filter((n) => n.startsWith(stem) && (stem.startsWith('.') || !n.startsWith('.'))).map((n) => dirPart + n);
    }
    if (!opts.length) return { line, options: [] };
    if (opts.length === 1) return { line: before + opts[0] + (opts[0].endsWith('/') ? '' : ' '), options: [] };
    let common = opts[0];
    for (const o of opts) while (!o.startsWith(common)) common = common.slice(0, -1);
    return { line: before + common, options: opts.map((o) => o.slice(o.lastIndexOf('/', o.length - 2) + 1)) };
  }
}

/** What goes on over time, taken as far as a command after it in a pipe could want: its lines, a few thousand at most. */
function gather(s: Stream): string[] {
  const out: string[] = [];
  for (let k = 0; out.length < 4000 && k < 500; k++) {
    const f = s.frame(k);
    if (!f) break;
    if (s.redraw) out.splice(0, out.length, ...f);
    else out.push(...f);
  }
  return out;
}

/** Sums worked out as bc does, a line (or a part between semicolons) at a time. */
function sums(lines: string[], scale: number): string[] {
  const out: string[] = [];
  for (const part of lines.flatMap((l) => l.split(';'))) {
    if (!part.trim() || /^\s*(quit|warranty)\s*$/.test(part)) continue;
    const r = calc(part, scale);
    out.push('error' in r ? (r.error === 'divide by zero' ? 'Runtime error (func=(main), adr=3): Divide by zero' : '(standard_in) 1: syntax error') : r.value);
  }
  return out;
}

/**
 * A file that is not text, as bytes: the same made-up bytes every time for the same file, a program's starting as
 * one does, with the text inside it set among them, each ended by a nul, where strings, xxd and hexdump find it.
 */
function madeUp(path: string, size: number, strings: string[], program: boolean): Uint8Array {
  const out = new Uint8Array(Math.max(64, Math.min(size || 256, 4096)));
  let s = 0;
  for (const ch of path) s = (s * 31 + ch.charCodeAt(0)) | 0;
  for (let i = 0; i < out.length; i++) { s = (s * 1103515245 + 12345) | 0; out[i] = (s >>> 16) & 255; }
  if (program) out.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0], 0);
  let at = 64;
  for (const str of strings) {
    const b = new TextEncoder().encode(str);
    if (at + b.length + 1 >= out.length) break;
    out.set(b, at);
    out[at + b.length] = 0;
    at += b.length + 1 + 23;
  }
  return out;
}

/** Names in columns down then across, as ls prints them, in a screen so many characters wide. */
export function columns(names: string[], cols: number): string[] {
  if (!names.length) return [];
  const w = Math.max(...names.map((n) => n.length)) + 2, per = Math.max(1, Math.floor(cols / w)), rows = Math.ceil(names.length / per), out: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < per; c++) { const name = names[c * rows + r]; if (name !== undefined) line += name.padEnd(w); }
    out.push(line.trimEnd());
  }
  return out;
}

/** What a file that is not text looks like on the screen: the same garbage every time for the same file. */
function garbage(path: string, size: number): string {
  let s = 0;
  for (const ch of path) s = (s * 31 + ch.charCodeAt(0)) | 0;
  const chars = '^?ELF^A^B^@^@^@^@^H^C@^@4^@^@^@ÿþ¤§¶×ð¿¬╕╪▒░@^P^@^@^G';
  let out = '';
  for (let k = 0; k < Math.min(60, Math.max(12, size / 40)); k++) { s = (s * 1103515245 + 12345) | 0; out += chars[Math.abs(s >> 8) % chars.length]; }
  return out;
}
