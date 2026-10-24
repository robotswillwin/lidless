#!/usr/bin/env python3
# The interface's sounds, made from Kenney's Interface Sounds and RPG Audio (both CC0: www.kenney.nl), chosen by role
# and by measure (short, soft, tones where a tone is wanted). Each is trimmed of its silence, its peak set to -3 dB, a
# short fade put on its end, and written as a mono 16-bit WAV: WAV plays at once on every phone, with none of the
# silence a compressed file starts with.
#
# Usage: python3 tools/sounds/import-kenney.py <kenney_interface-sounds folder> <kenney_rpg-audio folder>
# Writes public/assets/sounds/<role>.wav and sources.json (which file each came from).

import json, os, subprocess, sys, wave
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'sounds')
RATE = 44100

# each role: the pack and its file
SOUNDS = {
    'tap': ('interface', 'click_002'),            # a crisp click, 12 ms
    'choose': ('interface', 'select_001'),        # a short blip at 2.2 kHz
    'verbs-out': ('interface', 'switch_007'),     # rising
    'verbs-in': ('interface', 'switch_005'),      # low
    'window-open': ('interface', 'maximize_009'), # a tone rising, 1.2 to 1.5 kHz: her window out of the air
    'window-close': ('interface', 'minimize_009'),# the same falling
    'page': ('interface', 'glass_006'),           # a glass ting: another page of her window
    'pause': ('interface', 'minimize_008'),       # low, falling
    'resume': ('interface', 'maximize_008'),      # low, rising
    'confirm': ('interface', 'confirmation_001'), # up an octave, warm
    'deny': ('interface', 'error_008'),           # low and soft
    'things': ('interface', 'drop_002'),          # her things out
    'hold': ('interface', 'pluck_002'),           # a thing in her hand
    'inspect': ('interface', 'glass_002'),        # a thing held up
    'co-open': ('interface', 'confirmation_002'), # the Concierge: its card, bright and rising
    'co-message': ('interface', 'confirmation_004'),  # its message
    'co-ask': ('interface', 'question_003'),      # "about what?", rising
    'glitch-1': ('interface', 'glitch_002'),      # the view switching
    'glitch-2': ('interface', 'glitch_004'),
    'book-open': ('rpg', 'bookOpen'),
    'book-close': ('rpg', 'bookClose'),
    'book-page-1': ('rpg', 'bookFlip2'),
    'book-page-2': ('rpg', 'bookFlip3'),
    'key': ('interface', 'click_003'),            # an old machine's key
    'enter': ('interface', 'tick_004'),
    'boot': ('interface', 'maximize_006'),        # an old machine coming up, low
}


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', str(RATE), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768


def shaped(x):
    a = np.abs(x)
    loud = np.where(a > a.max() * 10 ** (-50 / 20))[0]
    x = x[max(0, loud[0] - int(0.002 * RATE)):loud[-1] + 1]
    x = x / max(np.abs(x).max(), 1e-9) * 10 ** (-3 / 20)
    fade = min(len(x) // 4, int(0.012 * RATE))
    if fade: x[-fade:] *= np.linspace(1, 0, fade)
    return x


def main():
    folders = {'interface': sys.argv[1], 'rpg': sys.argv[2]}
    os.makedirs(OUT, exist_ok=True)
    sources = {}
    for role, (pack, name) in SOUNDS.items():
        x = shaped(load(os.path.join(folders[pack], f'{name}.ogg')))
        with wave.open(os.path.join(OUT, f'{role}.wav'), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
            w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
        sources[role] = {'pack': {'interface': 'Kenney Interface Sounds', 'rpg': 'Kenney RPG Audio'}[pack], 'file': f'{name}.ogg', 'ms': round(len(x) / RATE * 1000)}
        print(f'{role:14s} <- {pack}/{name}.ogg  {len(x) / RATE * 1000:5.0f} ms')
    with open(os.path.join(OUT, 'sources.json'), 'w') as f:
        json.dump(sources, f, indent=2)
        f.write('\n')


main()
