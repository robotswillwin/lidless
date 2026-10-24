#!/usr/bin/env python3
# The world's sounds: the lift, the hand dryer, the hologram, the Newton's cradle, doors, the camera, and the ambient
# beds under each scene (rain and the city outside, a room's quiet hum, the hologram's and a terminal's own hum). The
# machines' sounds are from Kenney's Sci-Fi Sounds and Digital Audio (both CC0, www.kenney.nl), chosen by ear and by
# measure, trimmed and levelled. The beds that have no natural source — rain, the city, a room's air — are made here
# from shaped noise, so they loop with no seam and cost almost nothing. Everything is written as a mono 16-bit WAV at
# 32 kHz (the world's sounds want no more), the loops crossfaded end to start so they run on without a click.
#
# Usage: python3 tools/sounds/import-world.py <kenney_sci-fi-sounds folder> <kenney_digital-audio folder>
# Writes public/assets/sounds/<name>.wav and adds to sources.json.

import json, os, subprocess, sys, wave
import numpy as np
from scipy.signal import lfilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'sounds')
RATE = 32000
rng = np.random.default_rng(64)  # Year 64 of Care: the same noise every time

# one shot from a pack: role -> (pack, file, loudness in dB below full, optional [start,end] seconds to take)
SHOTS = {
    'lift-ding': ('digital', 'threeTone1', -10, None),       # the lift arrives: three calm tones
    'lift-start': ('digital', 'lowThreeTone', -14, None),    # it sets off
    'cradle': ('scifi', 'impactMetal_002', -16, [0, 0.4]),   # a ball of the cradle struck
    'hologram-on': ('scifi', 'forceField_002', -13, None),   # the rings form
    'hologram-solved': ('digital', 'powerUp3', -11, None),   # their gaps line up
    'ring-turn': ('digital', 'tone1', -17, None),            # a ring turned
    'camera-move': ('digital', 'powerUp4', -22, [0, 0.25]),  # the camera turns (faint servo)
    'door-open': ('scifi', 'doorOpen_000', -15, None),       # a door between scenes
    'door-close': ('scifi', 'doorClose_000', -15, None),
}

# a looping bed from a pack: role -> (pack, file, loudness, seconds to take)
LOOP_SHOTS = {
    'lift-move': ('scifi', 'engineCircular_002', -22, 4.0),  # the lift's motor while it moves
    'dryer-air': ('scifi', 'engineCircular_000', -20, 3.0),  # the hand dryer's rush of air
    'hologram-hum': ('scifi', 'computerNoise_002', -26, 4.0),  # the rings' quiet hum while they float
    'machine-hum': ('scifi', 'computerNoise_000', -28, 4.0),  # an old machine's idle hum
}

LOOP_FADE = 0.25  # seconds crossfaded from the end into the start, so a loop has no seam
PACK_NAME = {'scifi': 'Kenney Sci-Fi Sounds', 'digital': 'Kenney Digital Audio'}


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', str(RATE), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768


def level(x, db):
    return x / max(np.abs(x).max(), 1e-9) * 10 ** (db / 20)


def shot(x, db, span):
    if span:
        x = x[int(span[0] * RATE):int(span[1] * RATE)]
    a = np.abs(x)
    loud = np.where(a > a.max() * 10 ** (-50 / 20))[0]
    x = x[max(0, loud[0] - int(0.002 * RATE)):loud[-1] + 1]
    x = level(x, db)
    fade = min(len(x) // 4, int(0.015 * RATE))
    if fade:
        x[-fade:] *= np.linspace(1, 0, fade)
    return x


def loop(x, db, seconds):
    # take a steady stretch, then crossfade its tail into its head so it joins itself
    want = int(seconds * RATE)
    if len(x) > want:
        x = x[(len(x) - want) // 2:(len(x) - want) // 2 + want]
    f = int(LOOP_FADE * RATE)
    head, tail = x[:f].copy(), x[-f:].copy()
    ramp = np.linspace(0, 1, f)
    x = x[:-f].copy()
    x[:f] = tail * (1 - ramp) + head * ramp
    return level(x, db)


def write(name, x):
    with wave.open(os.path.join(OUT, f'{name}.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def pinkish(n, tilt):
    # shaped noise: white noise through a one-pole low-pass, `tilt` toward low (near 1) or kept bright (0); normalised
    white = rng.standard_normal(n).astype(np.float32)
    if tilt <= 0:
        return white
    out = lfilter([1 - tilt], [1, -tilt], white).astype(np.float32)
    return out / max(np.std(out), 1e-9) * np.std(white)


def bed(n, layers):
    # a bed of layers of shaped noise, each with its own tilt and gain; then levelled
    x = np.zeros(n, dtype=np.float32)
    for tilt, gain in layers:
        x += gain * pinkish(n, tilt)
    return x


def rain_bed(seconds):
    n = int(seconds * RATE)
    # a steady hiss (close rain), a low rumble under it (the wet city), and now and then a brighter patter
    x = bed(n, [(0.0, 0.5), (0.9, 1.0), (0.995, 1.6)])
    # a slow swell, so it breathes rather than sits flat
    t = np.arange(n) / RATE
    x *= 1 + 0.18 * np.sin(2 * np.pi * t / 7.3)
    return x


def city_bed(seconds):
    n = int(seconds * RATE)
    # the low drone of a city at night, almost all rumble, a faint higher air over it
    x = bed(n, [(0.997, 1.8), (0.985, 0.7), (0.0, 0.08)])
    t = np.arange(n) / RATE
    x *= 1 + 0.12 * np.sin(2 * np.pi * t / 11)
    return x


def room_bed(seconds):
    n = int(seconds * RATE)
    # a quiet room: a low hum (its machines, its walls), very little else
    x = bed(n, [(0.998, 1.2), (0.0, 0.03)])
    # a mains hum, faint, under it
    t = np.arange(n) / RATE
    x += 0.05 * np.sin(2 * np.pi * 50 * t) * np.sin(2 * np.pi * 100 * t)
    return x


def seamless(x, db):
    f = int(LOOP_FADE * RATE)
    head, tail = x[:f].copy(), x[-f:].copy()
    ramp = np.linspace(0, 1, f)
    x = x[:-f].copy()
    x[:f] = tail * (1 - ramp) + head * ramp
    return level(x, db)


BEDS = {
    'bed-rain': (rain_bed, 8.0, -24),
    'bed-city': (city_bed, 10.0, -27),
    'bed-room': (room_bed, 8.0, -30),
}


def main():
    folders = {'scifi': sys.argv[1], 'digital': sys.argv[2]}
    os.makedirs(OUT, exist_ok=True)
    try:
        sources = json.load(open(os.path.join(OUT, 'sources.json')))
    except Exception:
        sources = {}
    for role, (pack, name, db, span) in SHOTS.items():
        x = shot(load(os.path.join(folders[pack], f'{name}.ogg')), db, span)
        write(role, x)
        sources[role] = {'pack': PACK_NAME[pack], 'file': f'{name}.ogg', 'ms': round(len(x) / RATE * 1000)}
        print(f'{role:16s} <- {pack}/{name}.ogg  {len(x) / RATE * 1000:5.0f} ms')
    for role, (pack, name, db, seconds) in LOOP_SHOTS.items():
        x = loop(load(os.path.join(folders[pack], f'{name}.ogg')), db, seconds)
        write(role, x)
        sources[role] = {'pack': PACK_NAME[pack], 'file': f'{name}.ogg', 'ms': round(len(x) / RATE * 1000), 'loop': True}
        print(f'{role:16s} <- {pack}/{name}.ogg  {len(x) / RATE * 1000:5.0f} ms  (loop)')
    for role, (make, seconds, db) in BEDS.items():
        x = seamless(make(seconds), db)
        write(role, x)
        sources[role] = {'pack': 'made here (shaped noise)', 'file': 'import-world.py', 'ms': round(len(x) / RATE * 1000), 'loop': True}
        print(f'{role:16s} <- shaped noise  {len(x) / RATE * 1000:5.0f} ms  (loop)')
    with open(os.path.join(OUT, 'sources.json'), 'w') as f:
        json.dump(sources, f, indent=2)
        f.write('\n')


main()
