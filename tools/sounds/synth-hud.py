#!/usr/bin/env python3
# A few of the HUD's cues, made here from shaped noise instead of a pack, because the pack's panel sounds whistle — a
# rising and falling tone that reads as a cartoon menu, not as her glass AR window coming up in the air. These are soft
# and airy: a short breath of filtered noise with a gentle swell, a hair of glass shimmer, no tune. Written as mono
# 16-bit WAV at 32 kHz into public/assets/sounds, and credited in sources.json as made here.
#
# It can write a cue straight (e.g. window-open) or a set of candidates to audition (window-open__a, __b, ...). The game
# only ever loads the straight names.
#
# Usage: python3 tools/sounds/synth-hud.py            # write the chosen cues
#        python3 tools/sounds/synth-hud.py --audition  # also write lettered candidates to compare

import json, os, sys, wave
import numpy as np
from scipy.signal import butter, sosfilt

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'sounds')
RATE = 32000
rng = np.random.default_rng(64)


def bandpass(x, lo, hi):
    return sosfilt(butter(2, [lo / (RATE / 2), hi / (RATE / 2)], 'band', output='sos'), x).astype(np.float32)


def lowpass(x, hz):
    return sosfilt(butter(2, hz / (RATE / 2), 'low', output='sos'), x).astype(np.float32)


def highpass(x, hz):
    return sosfilt(butter(2, hz / (RATE / 2), 'high', output='sos'), x).astype(np.float32)


def level(x, db):
    return x / max(np.abs(x).max(), 1e-9) * 10 ** (db / 20)


def bell(n, peak_frac, width_frac):
    # a smooth swell that rises to 1 at peak_frac of the length and falls away: a breath, no click at either end
    t = np.linspace(0, 1, n)
    return np.exp(-((t - peak_frac) ** 2) / (2 * width_frac ** 2)).astype(np.float32)


def glass_pane(ms, lo, hi, peak, rising, shimmer_hz, shimmer, db):
    # her AR window settling into the air: a soft band of air that sweeps gently from lo to hi (or back), swelling and
    # fading like a breath, with a faint high shimmer of glass over it. Short and quiet. The sweep is of the FILTER, not a
    # tone, so it reads as air moving, not a whistle.
    n = int(ms / 1000 * RATE)
    noise = rng.standard_normal(n).astype(np.float32)
    # move a band-pass across the span in a few steps and sum — a gliding breath of air
    out = np.zeros(n, dtype=np.float32)
    steps = 6
    span = np.linspace(0, 1, steps)
    for i, s in enumerate(span):
        g = s if rising else (1 - s)
        c = lo + (hi - lo) * g
        seg = bandpass(noise, c * 0.8, c * 1.25)
        # each band is strongest at its moment in the swell
        when = bell(n, (i + 0.5) / steps, 0.26)
        out += seg * when
    out *= bell(n, peak, 0.33)
    # a faint shimmer: a quiet high tone with a touch of vibrato, well under the air — the glass catching light
    if shimmer > 0:
        t = np.arange(n) / RATE
        vib = 1 + 0.004 * np.sin(2 * np.pi * 7 * t)
        sh = np.sin(2 * np.pi * shimmer_hz * t * vib) + 0.5 * np.sin(2 * np.pi * shimmer_hz * 2 * t)
        out += shimmer * (sh.astype(np.float32) * bell(n, peak + 0.08, 0.22))
    # keep it airy: roll off the very top and the low rumble
    out = highpass(lowpass(out, 9000), 300)
    # make sure both ends are silent
    f = int(0.006 * RATE)
    out[:f] *= np.linspace(0, 1, f)
    out[-f:] *= np.linspace(1, 0, f)
    return level(out, db)


def write(name, x):
    with wave.open(os.path.join(OUT, f'{name}.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


# the chosen cue for each name: a glass pane coming up (window-open) and going (window-close)
CHOSEN = {
    'window-open':  dict(ms=230, lo=700, hi=2600, peak=0.62, rising=True,  shimmer_hz=3200, shimmer=0.06, db=-15),
    'window-close': dict(ms=200, lo=2400, hi=650, peak=0.40, rising=False, shimmer_hz=2800, shimmer=0.04, db=-17),
}

# candidates to audition for window-open: airier, brighter, drier, with/without shimmer
AUDITION = {
    'window-open__a': dict(ms=230, lo=700, hi=2600, peak=0.62, rising=True, shimmer_hz=3200, shimmer=0.06, db=-15),
    'window-open__b': dict(ms=200, lo=900, hi=3400, peak=0.55, rising=True, shimmer_hz=4200, shimmer=0.10, db=-15),  # brighter, more shimmer
    'window-open__c': dict(ms=260, lo=500, hi=1900, peak=0.66, rising=True, shimmer_hz=0, shimmer=0.0, db=-15),      # pure air, no shimmer, softer
    'window-open__d': dict(ms=170, lo=1000, hi=3000, peak=0.5, rising=True, shimmer_hz=3600, shimmer=0.05, db=-15),  # quick and light
}


def main():
    os.makedirs(OUT, exist_ok=True)
    try:
        sources = json.load(open(os.path.join(OUT, 'sources.json')))
    except Exception:
        sources = {}
    sets = dict(CHOSEN)
    if '--audition' in sys.argv:
        sets.update(AUDITION)
    for name, p in sets.items():
        x = glass_pane(**p)
        write(name, x)
        if '__' not in name:
            sources[name] = {'pack': 'made here (shaped noise, synth-hud.py)', 'file': 'synth-hud.py', 'ms': round(len(x) / RATE * 1000)}
        print(f'{name:18} {len(x) / RATE * 1000:5.0f} ms')
    with open(os.path.join(OUT, 'sources.json'), 'w') as f:
        json.dump(sources, f, indent=2)
        f.write('\n')


main()
