#!/usr/bin/env python3
"""Onset check for tonal cues in the DELIVERED file (cross-correlation is ambiguous when notes ring into each other):
for every cue with a pitch (ping, tick_land, bellrun notes, pop), band-pass the film's audio around the note and find where its
envelope rises fastest near the planned frame. Usage: verify_notes.py out/film.mp4 audio/score.json"""
import json, subprocess, sys, tempfile, os
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfiltfilt
sys.path.insert(0, r'C:/Users/user/Documents/motioner/repo/scripts')
from _media import find_tool  # noqa
video, score = sys.argv[1], json.load(open(sys.argv[2]))
ff = find_tool('ffmpeg', None) or 'ffmpeg'
tmp = os.path.join(tempfile.gettempdir(), 'notes_check.wav')
subprocess.run([ff, '-y', '-v', 'error', '-i', video, '-vn', '-ac', '1', '-ar', '48000', tmp], check=True)
sr, x = wavfile.read(tmp)
x = x.astype(np.float32) / 32768
fps = score['fps']
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
items = []
for it in score['sfx']:
    t = it['type']
    if t in ('ping', 'tick_land', 'lockclick') and 'midi' in it:
        items.append((it['frame'], it['midi'], it.get('label', t)))
    elif t == 'bellrun':
        for k, m in enumerate(it['notes']):
            items.append((it['frame'] + k * it.get('step', 4 / 60) * fps, m, f"{it.get('label', t)} #{k}"))
res = []
for fr, m, lab in items:
    f0 = hz(m)
    sos = butter(4, [f0 * 0.96, f0 * 1.04], btype='band', fs=sr, output='sos')
    a, b = int(max(0, fr / fps - 0.25) * sr), int(min(len(x), (fr / fps + 0.25) * sr))
    y = sosfiltfilt(sos, x[a:b])
    env = np.abs(y)
    k = int(0.004 * sr)
    env = np.convolve(env, np.ones(k) / k, 'same')
    db = 20 * np.log10(env + 1e-7)
    d = np.gradient(db) * sr / 1000  # dB per ms
    win = slice(int(0.13 * sr), int(0.37 * sr))  # planned time +-120 ms
    j = int(np.argmax(d[win])) + win.start
    off = (a + j) / sr * 1000 - fr / fps * 1000
    res.append((fr, m, lab, off, float(env.max())))
ok = [r for r in res if abs(r[3]) <= 25 and r[4] > 3e-5]
print(f'{len(ok)}/{len(res)} tonal onsets within 25 ms (rise-time of a band-passed envelope; the filter itself delays by ~3 ms)')
for fr, m, lab, off, pk in res:
    print(f'{"ok " if abs(off) <= 25 and pk > 3e-5 else "?? "} f{fr:8.1f} midi {m:3d} {off:+6.1f} ms  {lab}' + ('  (too quiet to judge)' if pk <= 3e-5 else ''))
