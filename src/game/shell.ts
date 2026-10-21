// An old machine's shell: a small Unix of its own over a file system written in data (public/assets/terminals/<id>.json),
// so what she finds on it is written, not generated. It is offline and its disk is mounted read-only: she can look
// through it, read, search and switch user with a password she has found, but change nothing and reach nothing beyond
// it. The story hears what she reads (a file's `read` sets its variables) and decides what is there (a file's `when`).
//
// Commands: help man ls cd pwd cat more less head tail grep find file wc sort uniq tar echo env date uptime uname
// hostname whoami id who ps df mount history clear su exit, with pipes (|), quotes and wildcards (* and ?).
// Everything here is plain logic, with no screen: terminal.ts draws it.

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

/** A line split at its pipes, outside quotes. */
function pipes(line: string): string[] {
  const out: string[] = [];
  let cur = '', q: string | null = null;
  for (const ch of line) {
    if (q) { if (ch === q) q = null; cur += ch; continue; }
    if (ch === '"' || ch === "'") q = ch;
    if (ch === '|') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
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
const WRITES = ['rm', 'rmdir', 'mv', 'cp', 'touch', 'mkdir', 'chmod', 'chown', 'chgrp', 'ln', 'tee', 'vi', 'vim', 'ed', 'nano', 'pico', 'emacs', 'passwd'];
const NETWORK = ['ping', 'ssh', 'telnet', 'ftp', 'rlogin', 'rsh', 'curl', 'wget', 'lynx', 'finger', 'nslookup', 'dig', 'traceroute', 'netstat'];

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
};
const COMMANDS = [...Object.keys(MANUAL), 'logout', 'shutdown', 'halt', 'poweroff', 'reboot', 'printenv', 'mail'];

export class Shell {
  /** The users logged in, one on top of another with su: the last one is who you are. */
  private users: string[];
  cwd: string;
  readonly history: string[] = [];
  /** How many characters wide the screen is, for ls's columns. */
  cols = 64;
  private readonly nodes = new Map<string, Node>();
  private pending: { user: string } | null = null;
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
  /** The question asked dropped (Ctrl+C): back to the prompt. */
  cancel(): void { this.pending = null; }

  /** The message of the day, shown as the machine comes up: /etc/motd. */
  motd(): string[] {
    const t = this.text('cat', '/etc/motd', false);
    return 'lines' in t ? t.lines : [];
  }

  prompt(): string {
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

  /** A line typed: the answer to a question asked, or a command line, pipes and all. */
  run(line: string): Output {
    if (this.pending) {
      const { user } = this.pending, u = this.machine.users[user];
      this.pending = null;
      if (!u?.password || line !== u.password) return { lines: ['su: Sorry'] };
      this.users.push(user);
      if (u.login) this.hooks.tell(u.login);
      return { lines: [] };
    }
    const trimmed = line.trim();
    if (!trimmed) return { lines: [] };
    this.history.push(trimmed);
    if (/(^|[^>])>{1,2}\s*\S/.test(trimmed.replace(/(["']).*?\1/g, ''))) {
      const target = /\s*>{1,2}\s*(\S+)/.exec(trimmed)?.[1] ?? '';
      return { lines: [`sh: cannot create ${target}: Read-only file system`] };
    }
    // each command's output goes on down the pipe; what goes wrong is shown, as it would be on a real one
    let input: string[] | null = null, out: Result = { lines: [], errors: [] };
    const errors: string[] = [];
    for (const part of pipes(trimmed)) {
      const { words: ws, quoted } = words(part);
      if (!ws.length) return { lines: ['sh: syntax error near unexpected token `|\''] };
      out = this.command(ws[0], this.expand(ws.slice(1), quoted.slice(1)), input);
      errors.push(...out.errors);
      if (out.exit || out.clear || out.ask) break;
      input = out.lines;
    }
    return { lines: [...errors, ...out.lines], clear: out.clear, exit: out.exit, ask: out.ask };
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
        const p = args[0] ?? '~', r = this.reach(p);
        if ('error' in r) return fail(`cd: ${p}: ${r.error}`);
        if (!r.node.dir) return fail(`cd: ${p}: Not a directory`);
        if (!this.may(r.node, 'x')) return fail(`cd: ${p}: Permission denied`);
        this.cwd = r.node.path;
        return say();
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
      case 'echo':
        return say(args.join(' ').replace(/\$(\w+)/g, (_, v: string) => this.env()[v] ?? ''));
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
        this.pending = { user: who };
        return { lines: [], errors: [], ask: 'Password:' };
      }
      case 'exit': case 'logout':
        if (this.users.length > 1) { this.users.pop(); return say(); }
        return { lines: ['logout'], errors: [], exit: true };
      case 'shutdown': case 'halt': case 'poweroff': case 'reboot':
        if (this.user !== 'root') return fail(`${cmd}: you must be root`);
        return { lines: ['', 'System shutdown time has arrived', 'syncing disks... done'], errors: [], exit: true };
      case 'sudo':
        return fail('sh: sudo: not found');
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
