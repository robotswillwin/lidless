#!/usr/bin/env python3
# Bake the final game SFX from real CC0 recordings: footsteps (Kenney RPG Audio) and the rain bed + drops (OpenGameArt
# Ylmir "Rain (loopable)"). Reads the downloaded samples as audio DATA via ffmpeg; writes mono 16-bit 32 kHz WAV into
# public/assets/sounds. Args: <kenney Audio dir> <oga rain dir> <out dir>.

import os, subprocess, sys, wave
import numpy as np
from scipy.signal import butter, sosfilt

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RATE = 32000
STEPS = sys.argv[1]  # the Kenney RPG Audio folder with footstep00..09.ogg
RAIN = sys.argv[2]   # the OpenGameArt "Rain (loopable)" folder with 1.ogg..4.ogg
OUT = sys.argv[3] if len(sys.argv) > 3 else os.path.join(ROOT, 'public', 'assets', 'sounds')


def load(path, mono=True):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1' if mono else '2',
                          '-ar', str(RATE), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768


def trim(x, floor_db=-42):
    a = np.abs(x)
    if a.max() < 1e-6:
        return x
    loud = np.where(a > a.max() * 10 ** (floor_db / 20))[0]
    return x[max(0, loud[0] - int(0.002 * RATE)):loud[-1] + int(0.012 * RATE)]


def norm(x, db):
    return x / max(np.abs(x).max(), 1e-9) * 10 ** (db / 20)


def highpass(x, hz):
    return sosfilt(butter(2, hz / (RATE / 2), 'high', output='sos'), x).astype(np.float32)


def fade(x, ms=6):
    f = int(ms / 1000 * RATE)
    x = x.copy(); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    return x


def write(name, x):
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def seamless(x, xfade_s=1.5):
    # make a loop seamless: crossfade the tail over the head
    n = len(x); f = int(xfade_s * RATE)
    if f * 2 >= n:
        return x
    head, tail = x[:f].copy(), x[-f:]
    w = np.linspace(0, 1, f)
    x = x[:-f].copy()
    x[:f] = tail * (1 - w) + head * w
    return x


def main():
    os.makedirs(OUT, exist_ok=True)
    # FOOTSTEPS: four of the ten Kenney steps, trimmed and levelled, high-passed a touch to firm them on stone. Raw
    # recordings (the director will refine the samples later); kept short so a run does not smear.
    pick = [0, 4, 6, 9]
    for i, k in enumerate(pick):
        x = trim(load(os.path.join(STEPS, f'footstep0{k}.ogg')))
        x = highpass(x, 120)
        write(f'step-{i + 1}', norm(fade(x), -8))
        print(f'step-{i + 1} <- kenney footstep0{k}.ogg  {len(x) / RATE * 1000:.0f} ms')
    # RAIN BED: a 14 s slice of the OGA rain loop (file 3) made seamless, so it loops with no seam and stays small
    bed = load(os.path.join(RAIN, '3.ogg'))  # mono downmix
    bed = bed[2 * RATE:16 * RATE]            # a clean 14 s stretch
    bed = seamless(norm(bed, -3), 2.0)
    write('bed-rain', bed)
    print(f'bed-rain <- oga rain 3.ogg  {len(bed) / RATE:.0f} s (seamless)')
    # DROPS: three single drips sliced from the loudest transients in a rain file, so the patter over the bed is real
    src = load(os.path.join(RAIN, '1.ogg'))
    env = np.abs(src)
    # find three well-separated peaks
    peaks = []
    guard = int(0.3 * RATE)
    e = env.copy()
    for _ in range(3):
        i = int(e.argmax())
        peaks.append(i)
        e[max(0, i - guard):i + guard] = 0
    peaks.sort()
    for i, p in enumerate(peaks):
        seg = src[max(0, p - int(0.004 * RATE)):p + int(0.05 * RATE)]
        seg = highpass(trim(seg, -36), 800)
        write(f'drop-{i + 1}', norm(fade(seg, 4), -12 - i * 3))
        print(f'drop-{i + 1} <- oga rain 1.ogg @ {p / RATE:.1f}s  {len(seg) / RATE * 1000:.0f} ms')


main()
