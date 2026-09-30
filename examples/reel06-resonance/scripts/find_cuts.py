#!/usr/bin/env python3
"""List abrupt level drops (>= 20 dB within 8 ms from a level above -40 dBFS) in a mix, with the frame. Usage: find_cuts.py mix.wav"""
import sys, wave
import numpy as np
w = wave.open(sys.argv[1]); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, 2).astype(np.float64) / 32768
m = x.mean(1)
win = int(0.002 * sr)
c = np.cumsum(np.insert(m ** 2, 0, 0.0))
rms = np.sqrt(np.maximum(c[win:] - c[:-win], 0) / win)
db = 20 * np.log10(rms + 1e-9)
d = db[::int(0.001 * sr)]
k = 0
out = []
while k < len(d) - 12:
    if d[k] > -40 and d[k + 1:k + 9].min() < d[k] - 20:
        out.append((k * 0.001, d[k], d[k + 1:k + 9].min()))
        k += 40
    k += 1
print(len(out), 'abrupt drops')
for t, a, b in out:
    print(f'{t:7.3f}s  frame {t * 60:7.1f}  {a:6.1f} -> {b:6.1f} dB')
