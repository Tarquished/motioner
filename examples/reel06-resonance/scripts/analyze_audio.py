#!/usr/bin/env python3
"""Turn the mastered mix into the numbers the picture draws: a fine waveform (4096 x 18 half floats over the film) and a
min/max envelope (4096 x 2), both compressed so quiet parts stay visible. Usage: analyze_audio.py [mix.wav] (without a wav a
placeholder from audio/events.json-like hits is written so the picture can be developed before the sound exists)."""
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfiltfilt

ROOT = Path(__file__).resolve().parent.parent
COLS, ROWS, SECONDS = 4096, 18, 30.0
N = COLS * ROWS

def load(path):
    with wave.open(str(path)) as w:
        sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        x = np.frombuffer(w.readframes(n), "<i2").astype(np.float32) / 32768
    x = x.reshape(-1, ch).mean(axis=1)
    return sr, x

def placeholder():
    sr = 48000
    t = np.arange(int(SECONDS * sr)) / sr
    x = 0.05 * np.sin(2 * np.pi * 41.2 * t) * np.clip(t / 2, 0, 1)
    for f0, g in [(2.0, 1.0), (5.0, 0.7), (7.0, 0.7), (10.0, 0.5), (12.0, 0.5), (14.0, 0.7), (25.0, 1.0), (24.0, 0.8)]:
        tt = np.clip(t - f0, 0, None)
        x += g * np.sin(2 * np.pi * (45 + 60 * np.exp(-tt / 0.05)) * tt) * np.exp(-tt / 0.5) * (t >= f0)
    for b in np.arange(0, 30, 0.5):
        tt = np.clip(t - b, 0, None)
        x += 0.25 * np.sin(2 * np.pi * 220 * tt) * np.exp(-tt / 0.1) * (t >= b) * (0.4 + 0.6 * (t / SECONDS))
    return sr, x / np.abs(x).max()

if len(sys.argv) > 1:
    sr, x = load(sys.argv[1])
else:
    sr, x = placeholder()
sos = butter(4, 900, btype="low", fs=sr, output="sos")
lp = sosfiltfilt(sos, x)
tgrid = np.arange(N) / N * SECONDS
fine = np.interp(tgrid, np.arange(len(lp)) / sr, lp)
peak = np.percentile(np.abs(fine), 99.8) or 1.0
def comp(v):
    v = np.clip(v / peak, -1, 1)
    return np.sign(v) * np.abs(v) ** 0.6
fine_c = comp(fine)
(ROOT / "public").mkdir(exist_ok=True)
(ROOT / "public" / "wave.bin").write_bytes(fine_c.astype(np.float16).tobytes())
# envelope: min/max of the compressed signal per cell (fine samples per cell)
per = N // COLS
cells = fine_c.reshape(COLS, per)
env = np.stack([cells.min(axis=1), cells.max(axis=1)], 1)
(ROOT / "public" / "env.bin").write_bytes(env.astype(np.float16).tobytes())
print("wave", N, "samples; peak", float(peak), "rms", float(np.sqrt((fine_c ** 2).mean())))
