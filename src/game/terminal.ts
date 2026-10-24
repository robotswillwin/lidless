// An old machine's screen over the game: green on black, its shell (shell.ts) behind it. It comes up with the machine's
// boot lines and whoever was left logged in; she types at a keyboard, or with the keys under the screen on a phone
// (commands, and the names where she is); and it goes when she switches it off: the button, Esc, or exit.
//
//   Enter runs a line, Tab completes a name, Up and Down go through what she typed, Ctrl+C drops a line (or stops what
//   is going on: yes, ping), Ctrl+D on an empty line logs out, Ctrl+L clears. What goes on over time (shell.ts's
//   streams) plays frame by frame, the line hidden until it is done.

import { button, el } from './dom';
import { columns, Shell, type Machine, type ShellHooks, type Stream } from './shell';
import { sounds } from './sound';

export interface TerminalOptions {
  /** No waiting: the boot lines all at once (the checks). */
  fast?: boolean;
}

/** How many lines the screen keeps; older ones scroll away for good. */
const KEEP = 600;
/** The keys under the screen: what she types most. */
const KEYS = ['ls', 'ls -l', 'cd ..', 'cd ~', 'cat ', 'grep ', 'help'];

/** The machine on screen until it is switched off. */
export function openTerminal(stage: HTMLElement, machine: Machine, hooks: ShellHooks, opt: TerminalOptions = {}): Promise<void> {
  return new Promise((done) => {
    const shell = new Shell(machine, hooks);
    const box = el('section', 'terminal', stage);
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', machine.name);
    const crt = el('div', 'crt', box);
    const bar = el('div', 'bar', crt);
    el('span', 'name', bar, machine.name);
    el('span', 'state', bar, 'offline');
    const off = button('off', 'Switch off', bar, () => close());
    off.textContent = 'Switch off';
    const screen = el('div', 'screen', crt);
    const out = el('div', 'out', screen);
    out.setAttribute('aria-live', 'polite');
    const row = el('label', 'line', screen);
    const prompt = el('span', 'prompt', row);
    const input = el('input', '', row);
    Object.assign(input, { type: 'text', autocomplete: 'off', spellcheck: false, enterKeyHint: 'send' });
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('aria-label', 'Command');
    const keys = el('div', 'keys', crt);

    let booting = true, skip = !!opt.fast, back = -1, typed = '', closed = false;
    /** The lines of a command not finished yet (an open if, for, quote): the shell waits until they are done. */
    let buffered = '';
    /** What is going on over time, while it is: Ctrl+C stops it, if it can be stopped. */
    let playing: { stop: () => void } | null = null;
    stage.dataset.terminal = '';
    // on a phone the keys type without bringing up its keyboard, which would cover the screen; a tap on the screen does
    const coarse = matchMedia('(pointer: coarse)').matches;
    const focus = () => { if (!coarse || document.activeElement === input) input.focus(); };
    const print = (lines: string[]) => {
      for (const l of lines) el('div', 'l', out, l || ' ');
      while (out.childElementCount > KEEP) out.firstElementChild?.remove();
      screen.scrollTop = screen.scrollHeight;
    };
    const ready = () => {
      // waiting for the rest of a command, it asks for more with a plain >, as a shell does
      prompt.textContent = buffered ? '> ' : shell.asking ? shell.askPrompt : shell.prompt();
      input.type = shell.asking ? 'password' : 'text';
      row.hidden = false;
      drawKeys();
      screen.scrollTop = screen.scrollHeight;
    };
    // the keys: the commands she types most, then the names where she is, each typed into the line as a word
    const drawKeys = () => {
      keys.replaceChildren();
      if (shell.asking) return;
      const add = (label: string, run: () => void, cls = '') => { const b = button(`key ${cls}`, label, keys, run); b.textContent = label; b.dataset.cue = label === 'Enter' ? 'enter' : 'key'; };
      add('Tab', () => complete(), 'fn');
      add('↑', () => recall(1), 'fn');
      add('Enter', () => submit(), 'fn');
      // Ctrl+C, for a phone that has no Ctrl: drops a line, and vi says how to leave it
      add('^C', () => { print([`${prompt.textContent}${shell.asking ? '' : input.value}^C`]); input.value = ''; buffered = ''; print(shell.cancel()); ready(); }, 'fn');
      for (const k of KEYS) add(k, () => typeIn(k, !k.endsWith(' ')));
      for (const n of shell.names()) add(n, () => typeIn(n));
    };
    const typeIn = (text: string, run = false) => {
      const v = input.value;
      input.value = run && !v.trim() ? text : `${v}${v && !v.endsWith(' ') && !text.startsWith(' ') ? ' ' : ''}${text}`;
      if (run && v.trim() === '') submit();
      else focus();
    };
    const submit = () => {
      if (booting || closed) return;
      const line = input.value;
      print([`${prompt.textContent}${shell.asking ? '' : line}`]);
      input.value = '';
      back = -1;
      // a command spread over lines: gather them until it is finished, then run the whole
      if (!shell.asking) {
        const whole = buffered ? `${buffered}\n${line}` : line;
        if (shell.wantsMore(whole)) { buffered = whole; ready(); focus(); return; }
        buffered = '';
        return runLine(whole);
      }
      runLine(line);
    };
    const runLine = (line: string) => {
      const res = shell.run(line);
      if (res.clear) out.replaceChildren();
      print(res.lines);
      if (res.exit) { row.hidden = true; window.setTimeout(close, opt.fast ? 0 : 500); return; }
      if (res.stream) return play(res.stream);
      ready();
      focus();
    };
    // frames over time: after each other (lines going by), or each in the last one's place (a train crossing)
    const play = (s: Stream) => {
      row.hidden = true;
      const block = s.redraw ? el('div', 'frame', out) : null;
      let k = 0, timer = 0;
      const end = (more: string[] = []) => {
        window.clearTimeout(timer);
        playing = null;
        if (block && !s.stop) block.remove();
        print(more);
        ready();
        focus();
      };
      playing = { stop: () => { if (s.stop) { print(['^C']); end(s.stop(k)); } } };
      // on a phone, the one key that matters now
      keys.replaceChildren();
      if (s.stop) { const b = button('key fn', 'Ctrl+C', keys, () => playing?.stop()); b.textContent = '^C'; }
      const tick = () => {
        if (closed) return;
        const f = s.frame(k);
        if (!f) return end();
        if (block) { block.replaceChildren(...f.map((l) => { const d = document.createElement('div'); d.className = 'l'; d.textContent = l || ' '; return d; })); screen.scrollTop = screen.scrollHeight; }
        else print(f);
        k++;
        timer = window.setTimeout(tick, opt.fast ? 0 : s.every);
      };
      tick();
    };
    const complete = () => {
      if (shell.asking) return;
      const c = shell.complete(input.value);
      if (c.options.length) { print([`${prompt.textContent}${input.value}`]); print(columns(c.options, shell.cols)); }
      input.value = c.line;
      focus();
    };
    const recall = (step: number) => {
      const h = shell.history;
      if (!h.length) return;
      if (back === -1) typed = input.value;
      back = Math.max(-1, Math.min(h.length - 1, back + step));
      input.value = back === -1 ? typed : h[h.length - 1 - back];
      focus();
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      // its keys, as they are pressed
      sounds.play(e.key === 'Enter' ? 'enter' : 'key');
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Tab') { e.preventDefault(); complete(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); recall(1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); recall(-1); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.ctrlKey && e.key === 'c') { e.preventDefault(); print([`${prompt.textContent}${shell.asking ? '' : input.value}^C`]); input.value = ''; buffered = ''; print(shell.cancel()); ready(); }
      else if (e.ctrlKey && e.key === 'd' && !input.value) { e.preventDefault(); input.value = shell.asking ? '' : 'exit'; submit(); }
      else if (e.ctrlKey && e.key === 'l') { e.preventDefault(); out.replaceChildren(); }
    });
    // a tap anywhere on the screen brings up the keyboard; while it boots, it skips the boot
    screen.addEventListener('click', () => { if (booting) skip = true; else if (!window.getSelection()?.toString()) input.focus(); });
    const onKey = (e: KeyboardEvent) => {
      // while something goes on, Ctrl+C is for it
      if (playing && e.ctrlKey && e.key === 'c') { e.preventDefault(); playing.stop(); return; }
      if (e.key === 'Escape' && !closed) { e.preventDefault(); close(); } else if (booting) skip = true;
    };
    window.addEventListener('keydown', onKey, true);

    // how many characters fit across, for ls's columns
    const measure = () => {
      const probe = el('span', 'probe', out, 'MMMMMMMMMM');
      const w = probe.getBoundingClientRect().width / 10;
      probe.remove();
      if (w > 0) shell.cols = Math.max(24, Math.floor((out.clientWidth - 4) / w));
    };
    const onResize = () => measure();
    window.addEventListener('resize', onResize);

    function close() {
      if (closed) return;
      closed = true;
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
      box.classList.add('out');
      delete stage.dataset.terminal;
      window.setTimeout(() => { box.remove(); done(); }, opt.fast ? 0 : 260);
    }

    // it comes up: the boot lines one after another, then the message of the day, then the prompt
    row.hidden = true;
    sounds.play('boot');
    const lines = [...(machine.boot ?? []), '', ...shell.motd(), ''];
    (async () => {
      measure();
      for (const l of lines) {
        if (closed) return;
        print([l]);
        if (!skip) await new Promise((r) => window.setTimeout(r, /^\s*$/.test(l) ? 120 : 40 + Math.random() * 90));
      }
      booting = false;
      ready();
      focus();
    })();
  });
}
