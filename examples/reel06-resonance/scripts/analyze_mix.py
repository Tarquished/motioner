#!/usr/bin/env python3
"""Per-half-second view of the mastered mix: peak, momentary loudness (K-weighted, 400 ms), band shares. Usage: analyze_mix.py mix.wav"""
import sys, wave
import numpy as np
from scipy.signal import butter, sosfilt
sys.path.insert(0, r'C:/Users/user/Documents/motioner/repo/scripts')
import build_mix as bm
w = wave.open(sys.argv[1]); sr = w.getframerate(); ch = w.getnchannels()
x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32).reshape(-1, ch) / 32768
step = int(0.5 * sr)
kw = bm.k_weight(x)
bands = {'sub': (20, 90), 'low': (90, 300), 'mid': (300, 3000), 'high': (3000, 16000)}
fb = {k: sosfilt(butter(4, v, 'band', fs=sr, output='sos'), x, axis=0) for k, v in bands.items()}
print(' t(s) frame  peak  LUFSm  sub low mid high  stereo')
for i in range(0, len(x) - step + 1, step):
    seg = x[i:i + step]
    pk = 20 * np.log10(np.abs(seg).max() + 1e-9)
    lm = -0.691 + 10 * np.log10((kw[i:i + step] ** 2).mean(0).sum() + 1e-12)
    e = {k: (v[i:i + step] ** 2).mean() for k, v in fb.items()}
    tot = sum(e.values()) + 1e-12
    side = np.abs(seg[:, 0] - seg[:, 1]).mean() / (np.abs(seg[:, 0] + seg[:, 1]).mean() + 1e-9)
    print(f'{i / sr:5.1f} {int(i / sr * 60):5d} {pk:6.1f} {lm:6.1f}  ' + ' '.join(f'{int(100 * e[k] / tot):3d}' for k in bands) + f'  {side:4.2f}')
