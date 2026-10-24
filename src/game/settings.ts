// The player's settings, kept in the browser: graphics quality, the size of the text and how long lines stay, motion.
// Read once as the game opens and applied as they change, from the title screen or the menu at the top right. In a
// private window, where the browser keeps nothing, they last the session.

import { button, el } from './dom';

export type Quality = 'auto' | 'low' | 'medium' | 'high';
export interface Settings {
  /** Graphics: the renderer's tier, or the one the device suits (auto). */
  quality: Quality;
  /** The size of what is read: lines, notes, answers, the journal and the notebook. */
  text: 'small' | 'normal' | 'large';
  /** How long lines and notes stay before they move on by themselves. */
  speed: 'slow' | 'normal' | 'fast';
  /** Camera lean, the view switch's glitch, slides and fades: as the system asks, reduced, or full. */
  motion: 'auto' | 'reduced' | 'full';
  /** The interface's sounds: taps, pages, the Concierge's chimes. */
  sound: 'on' | 'off';
}

export const DEFAULTS: Settings = { quality: 'auto', text: 'normal', speed: 'normal', motion: 'auto', sound: 'on' };
/** Text, times its normal size. */
export const TEXT_SCALE: Record<Settings['text'], number> = { small: 0.88, normal: 1, large: 1.22 };
/** How long lines stay, times the normal: slow readers get longer. */
export const READING: Record<Settings['speed'], number> = { slow: 1.5, normal: 1, fast: 0.7 };

const KEY = 'lidless.settings';
const CHOICES: { [K in keyof Settings]: Settings[K][] } = {
  quality: ['auto', 'low', 'medium', 'high'], text: ['small', 'normal', 'large'], speed: ['slow', 'normal', 'fast'], motion: ['auto', 'reduced', 'full'], sound: ['on', 'off'],
};

/** The settings kept, each one it knows checked, the rest as by default. */
export function parseSettings(json: string | null): Settings {
  let kept: Record<string, unknown> = {};
  try { kept = json ? (JSON.parse(json) as Record<string, unknown>) : {}; } catch { kept = {}; }
  const out = { ...DEFAULTS };
  for (const k of Object.keys(CHOICES) as (keyof Settings)[]) {
    const v = kept?.[k];
    if ((CHOICES[k] as string[]).includes(v as string)) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function loadSettings(): Settings {
  try { return parseSettings(localStorage.getItem(KEY)); } catch { return { ...DEFAULTS }; }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* kept for the session only */ }
}

/** Each setting's name, what it does in a line, and its choices' names. */
const LABELS: { [K in keyof Settings]: { title: string; about: string; names: Record<Settings[K], string> } } = {
  quality: { title: 'Graphics', about: "How much of the city's light, rain and reflections is worked out. Auto suits your device.", names: { auto: 'Auto', low: 'Low', medium: 'Medium', high: 'High' } },
  text: { title: 'Text size', about: 'Lines, notes and answers, her journal and her notebook.', names: { small: 'Small', normal: 'Normal', large: 'Large' } },
  speed: { title: 'Text speed', about: 'How long lines and notes stay before they move on by themselves.', names: { slow: 'Slow', normal: 'Normal', fast: 'Fast' } },
  motion: { title: 'Motion', about: "The camera's lean, the view switch's glitch, slides and fades.", names: { auto: 'As the system', reduced: 'Reduced', full: 'Full' } },
  sound: { title: 'Sound effects', about: "Taps, pages, her window, the Concierge's chimes.", names: { on: 'On', off: 'Off' } },
};
/** The settings in groups, under a name each. */
const GROUPS: [string, (keyof Settings)[]][] = [['Picture', ['quality', 'motion']], ['Reading', ['text', 'speed']], ['Sound', ['sound']]];

/** The settings as rows of choices in their groups, each saying what it does; each change kept and handed on at once. */
export function drawSettings(p: HTMLElement, now: Settings, onChange: (s: Settings) => void): void {
  const box = el('div', 'settings', p);
  let s = { ...now };
  for (const [title, keys] of GROUPS) {
    el('h3', 'group', box, title);
    for (const k of keys) {
      const row = el('div', 'setting', box), words = el('div', 'words', row);
      const name = el('div', 'name', words, LABELS[k].title);
      el('div', 'about', words, LABELS[k].about);
      const group = el('div', 'choices', row);
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-label', name.textContent ?? '');
      for (const v of CHOICES[k] as string[]) {
        const b = button(`choice${s[k] === v ? ' on' : ''}`, `${LABELS[k].title}: ${(LABELS[k].names as Record<string, string>)[v]}`, group, () => {
          s = { ...s, [k]: v };
          saveSettings(s);
          onChange(s);
          group.querySelectorAll('.choice').forEach((c) => { c.classList.toggle('on', c === b); c.setAttribute('aria-checked', String(c === b)); });
        });
        b.textContent = (LABELS[k].names as Record<string, string>)[v];
        b.dataset.cue = 'choose';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(s[k] === v));
      }
    }
  }
  el('p', 'note', box, 'The music comes with the soundtrack.');
}
