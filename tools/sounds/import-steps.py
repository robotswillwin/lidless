#!/usr/bin/env python3
# Her footsteps on wet city pavement, and the rain's patter. The steps are Kenney's RPG Audio footsteps (CC0) given a
# harder edge and a wet tail, so her boots read on stone rather than on grass; four of them, so they do not repeat. The
# rain's patter is a few short drops made here from shaped noise (no pack suits a single drop as well), played now and
# then over the rain bed. Written as mono 16-bit WAV at 32 kHz, trimmed and levelled, into public/assets/sounds.
#
# Usage: python3 tools/sounds/import-steps.py <kenney_rpg-audio folder>

import json, os, subprocess, sys, wave
import numpy as np
from scipy.signal import butter, sosfilt

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'sounds')
RATE = 32000
rng = np.random.default_rng(640)

# four footsteps, varied, each a step's body
STEP_FILES = ['footstep00', 'footstep04', 'footstep06', 'footstep09']


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', str(RATE), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768


def trim(x, floor_db=-46):
    a = np.abs(x)
    loud = np.where(a > a.max() * 10 ** (floor_db / 20))[0]
    return x[max(0, loud[0] - int(0.001 * RATE)):loud[-1] + 1]


def level(x, db):
    return x / max(np.abs(x).max(), 1e-9) * 10 ** (db / 20)


def lowpass(x, hz):
    return sosfilt(butter(2, hz / (RATE / 2), 'low', output='sos'), x).astype(np.float32)


def highpass(x, hz):
    return sosfilt(butter(2, hz / (RATE / 2), 'high', output='sos'), x).astype(np.float32)


def bandpass(x, lo, hi):
    return sosfilt(butter(2, [lo / (RATE / 2), hi / (RATE / 2)], 'band', output='sos'), x).astype(np.float32)


def write(name, x):
    with wave.open(os.path.join(OUT, f'{name}.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def wet_step(x):
    # keep the step's body, add a short sharp click at its start (the heel on stone) and a faint wet slap just after
    x = trim(x)
    n = len(x)
    # the heel click: a very short burst of band-passed noise, fast decay
    click_n = int(0.012 * RATE)
    click = bandpass(rng.standard_normal(click_n).astype(np.float32), 1800, 6000)
    click *= np.exp(-np.arange(click_n) / (0.003 * RATE)) * 0.6
    # the wet slap: a touch of low, damped noise a hair later (water under the sole)
    slap_n = int(0.03 * RATE)
    slap = lowpass(rng.standard_normal(slap_n).astype(np.float32), 900)
    slap *= np.exp(-np.arange(slap_n) / (0.012 * RATE)) * 0.35
    out = np.zeros(max(n, click_n, int(0.02 * RATE) + slap_n), dtype=np.float32)
    out[:n] += x * 0.8
    out[:click_n] += click
    s0 = int(0.008 * RATE)
    out[s0:s0 + slap_n] += slap
    # a short fade out, no click at the end
    f = int(0.01 * RATE)
    out[-f:] *= np.linspace(1, 0, f)
    return level(trim(out), -8)


def drop(bright, length_ms, db):
    # a single rain drop: a short band of noise with a quick attack and decay; brighter ones land closer
    n = int(length_ms / 1000 * RATE)
    x = bandpass(rng.standard_normal(n).astype(np.float32), bright * 0.6, bright * 1.6)
    env = np.exp(-np.arange(n) / (length_ms / 1000 * RATE / 4))
    env[:int(0.001 * RATE)] *= np.linspace(0, 1, int(0.001 * RATE))
    return level(x * env, db)


def main():
    rpg = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    try:
        sources = json.load(open(os.path.join(OUT, 'sources.json')))
    except Exception:
        sources = {}
    for i, name in enumerate(STEP_FILES):
        x = wet_step(load(os.path.join(rpg, f'{name}.ogg')))
        write(f'step-{i + 1}', x)
        sources[f'step-{i + 1}'] = {'pack': 'Kenney RPG Audio + wet edge (import-steps.py)', 'file': f'{name}.ogg', 'ms': round(len(x) / RATE * 1000)}
        print(f'step-{i + 1:<2} <- rpg/{name}.ogg  {len(x) / RATE * 1000:5.0f} ms')
    # three rain drops, from a near patter to a far one
    for i, (bright, ln, db) in enumerate([(3200, 26, -14), (2400, 32, -17), (1700, 40, -20)]):
        x = drop(bright, ln, db)
        write(f'drop-{i + 1}', x)
        sources[f'drop-{i + 1}'] = {'pack': 'made here (shaped noise)', 'file': 'import-steps.py', 'ms': round(len(x) / RATE * 1000)}
        print(f'drop-{i + 1:<2} <- shaped noise  {len(x) / RATE * 1000:5.0f} ms')
    with open(os.path.join(OUT, 'sources.json'), 'w') as f:
        json.dump(sources, f, indent=2)
        f.write('\n')


main()
