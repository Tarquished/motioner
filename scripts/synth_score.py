#!/usr/bin/env python3
"""Write the whole soundtrack in code: a tempo-locked music bed plus synthesized SFX made for each
event of the film, then hand them to build_mix.py for placement, ducking and mastering.

Why: sounds found on the internet rarely fit a move (wrong length, lead-in, key, character). A sound
synthesized for the event fits by construction: a whoosh whose loudness follows the measured speed
curve of the move, a riser that peaks on the reveal frame, plucks in the music's key, a kick on
every beat frame, a real silence before the drop.

score (JSON):
{
  "fps": 60, "frames": 900, "bpm": 128, "beat0_frame": 0,        # frame of beat 0
  "key": "A", "scale": "minor", "seed": 7,
  "chords": ["i", "VI", "III", "VII"],                          # one per bar, looped (roman numerals)
  "sections": [                                                  # in beats from beat 0
    {"from": 0,  "to": 4,  "kit": "intro"},
    {"from": 4,  "to": 16, "kit": "groove", "drop": true},       # drop: silence gap + riser before it
    {"from": 16, "to": 24, "kit": "lift"},
    {"from": 24, "to": 28, "kit": "montage", "drop": true},
    {"from": 28, "to": 36, "kit": "outro", "drop": true}
  ],
  "gap_ms": 90,                                                  # silence before each drop
  "sfx": [
    {"type": "pluck",   "frame": 30, "degree": 0},
    {"type": "whoosh",  "frame": 314, "frames": 30},             # peak on the frame (fastest frame)
    {"type": "whoosh",  "start": 290, "speed": [0, 2.1, 8.4, ...]},   # envelope follows a speed curve
    {"type": "riser",   "frame": 450, "frames": 60},             # ends (peaks) on the frame
    {"type": "impact",  "frame": 450}, {"type": "pop", "frame": 500, "degree": 4},
    {"type": "tick"}, {"type": "click"}, {"type": "type", "frames": [600, 604, 609]},
    {"type": "glitch"}, {"type": "shutter"}, {"type": "chime"}, {"type": "thud"},
    {"type": "sub"}, {"type": "stab"}, {"type": "swell", "frame": 700, "frames": 40}, {"type": "burst"}
  ]
}
Every sfx entry takes "gain_db", "pan" (-1..1) and "label"; pitched ones take "degree" (scale step,
0 = root; may be negative or above 7) and "octave".

Outputs in --out DIR: music.wav, sfx/*.wav (one file per distinct sound), cues.json (a build_mix
cue sheet with music and cues), score.png (beat grid, sections, sfx). Then:
  python build_mix.py DIR/cues.json --out public/audio/mix.wav
  python sync_check.py film.mp4 public/audio/mix.cues.json
Usage: python synth_score.py score.json --out audio/
"""

import argparse
import hashlib
import json
import math
import sys
import wave
from pathlib import Path

import numpy as np

try:
    from scipy.signal import butter, sosfilt, fftconvolve
except ImportError:  # pragma: no cover
    sys.exit("synth_score.py needs numpy and scipy: pip install numpy scipy")

SR = 48000
NOTE = {"C": 0, "C#": 1, "DB": 1, "D": 2, "D#": 3, "EB": 3, "E": 4, "F": 5, "F#": 6, "GB": 6, "G": 7,
        "G#": 8, "AB": 8, "A": 9, "A#": 10, "BB": 10, "B": 11}
SCALES = {"minor": [0, 2, 3, 5, 7, 8, 10], "major": [0, 2, 4, 5, 7, 9, 11], "dorian": [0, 2, 3, 5, 7, 9, 10],
          "lydian": [0, 2, 4, 6, 7, 9, 11], "mixolydian": [0, 2, 4, 5, 7, 9, 10]}
ROMAN = {"i": 0, "ii": 1, "iii": 2, "iv": 3, "v": 4, "vi": 5, "vii": 6}


# ── basic dsp ────────────────────────────────────────────────────────────────
def t_of(n):
    return np.arange(n) / SR


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def filt(x, kind, f, order=2):
    f = np.clip(np.atleast_1d(np.asarray(f, float)), 20, SR / 2 - 200)
    if f.size == 1 or kind == "band":
        wn = float(f[0]) if kind != "band" else [float(f[0]), float(f[1])]
        sos = butter(order, wn, btype={"lp": "low", "hp": "high", "band": "band"}[kind], fs=SR, output="sos")
        return sosfilt(sos, x)
    # time-varying one-pole-ish sweep: process in 256-sample blocks with the block's cutoff
    out = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), 256):
        fc = float(f[min(i, len(f) - 1)])
        sos = butter(order, fc, btype={"lp": "low", "hp": "high"}[kind], fs=SR, output="sos")
        from scipy.signal import sosfilt_zi
        if zi is None:
            zi = sosfilt_zi(sos) * 0
        seg, zi = sosfilt(sos, x[i:i + 256], zi=zi)
        out[i:i + 256] = seg
    return out


def env_adsr(n, a=0.005, d=0.1, s=0.0, r=0.1, curve=4.0):
    t = t_of(n)
    e = np.where(t < a, t / max(a, 1e-6), 0)
    dec = (t >= a)
    e = e + dec * (s + (1 - s) * np.exp(-curve * (t - a) / max(d, 1e-6)))
    rel_start = n - int(r * SR)
    if rel_start > 0:
        e[rel_start:] *= np.linspace(1, 0, n - rel_start) ** 2
    return e


def noise(n, rng):
    return rng.standard_normal(n)


def saw(f, n, phase=0.0):
    ph = (np.cumsum(np.full(n, f) if np.isscalar(f) else f) / SR + phase) % 1.0
    return 2 * ph - 1


def sine(f, n, phase=0.0):
    ph = np.cumsum(np.full(n, f) if np.isscalar(f) else f) / SR
    return np.sin(2 * np.pi * (ph + phase))


def tri(f, n):
    return 2 * np.abs(saw(f, n)) - 1


def reverb_ir(seconds, rng, bright=6000):
    n = int(seconds * SR)
    t = t_of(n)
    ir = np.stack([noise(n, rng), noise(n, rng)], 1) * np.exp(-6.9 * t / seconds)[:, None]
    ir[:, 0] = filt(ir[:, 0], "lp", bright)
    ir[:, 1] = filt(ir[:, 1], "lp", bright)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    return ir / np.sqrt((ir ** 2).sum() / 2)


def verb(x, ir, wet=0.2):
    st = np.stack([x, x], 1) if x.ndim == 1 else x
    out = np.stack([fftconvolve(st[:, c], ir[:, c])[: len(st) + len(ir) - 1] for c in range(2)], 1)
    dry = np.zeros_like(out)
    dry[: len(st)] = st
    return dry * (1 - wet) + out * wet


def pan2(x, p):
    p = max(-1.0, min(1.0, p))
    a = (p + 1) * math.pi / 4
    return np.stack([x * math.cos(a), x * math.sin(a)], 1) * math.sqrt(2)


def norm(x, peak=0.89):
    m = np.max(np.abs(x)) or 1.0
    return x * (peak / m)


def write_wav(path, y):
    path.parent.mkdir(parents=True, exist_ok=True)
    y = np.stack([y, y], 1) if y.ndim == 1 else y
    data = (np.clip(y, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


# ── harmony ──────────────────────────────────────────────────────────────────
class Harmony:
    def __init__(self, key="A", scale="minor", chords=("i", "VI", "III", "VII")):
        self.root = NOTE[key.upper()]
        self.scale = SCALES.get(scale, SCALES["minor"])
        self.chords = [ROMAN[c.lower().strip("°+")] for c in chords] or [0]

    def degree(self, d, octave=4):
        o, i = divmod(int(d), 7)
        return 12 * (octave + 1 + o) + self.root + self.scale[i]

    def chord(self, bar, octave=3):
        d = self.chords[bar % len(self.chords)]
        return [self.degree(d + k, octave) for k in (0, 2, 4)]


# ── instruments (music) ──────────────────────────────────────────────────────
def kick(rng, punch=1.0):
    n = int(0.42 * SR)
    t = t_of(n)
    f = 44 + 110 * np.exp(-t / 0.035)
    body = sine(f, n) * np.exp(-t / 0.22)
    click = filt(noise(int(0.004 * SR), rng), "hp", 2500) * 0.25
    body[: len(click)] += click * punch
    return np.tanh(body * 1.6) * 0.9


def hat(rng, open_=False):
    n = int((0.16 if open_ else 0.045) * SR)
    x = filt(noise(n, rng), "hp", 7000) * np.exp(-t_of(n) / (0.05 if open_ else 0.012))
    return x * 0.35


def clap(rng):
    n = int(0.28 * SR)
    x = filt(noise(n, rng), "band", [900, 3200])
    e = np.zeros(n)
    for k, dt in enumerate((0, 0.011, 0.022)):
        i = int(dt * SR)
        e[i:] += np.exp(-t_of(n - i) / (0.008 if k < 2 else 0.09)) * (0.7 if k < 2 else 1)
    return x * e * 0.55


def bass_note(midi, dur, rng):
    n = int(dur * SR)
    f = hz(midi)
    x = saw(f, n) * 0.6 + sine(f / 2, n) * 0.6
    x = filt(x, "lp", 380 + 900 * np.exp(-t_of(n) / 0.06))
    return x * env_adsr(n, a=0.004, d=0.25, s=0.55, r=0.03) * 0.5


def pad_chord(notes, dur, rng, bright=1400):
    n = int(dur * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    for m in notes:
        for det, side in ((-0.09, 0), (0.07, 1), (0.0, 2)):
            f = hz(m) * 2 ** (det / 12)
            v = saw(f, n, phase=rng.random())
            if side == 0:
                L += v
            elif side == 1:
                R += v
            else:
                L += v * 0.5
                R += v * 0.5
    a = min(0.35, dur / 3)
    e = env_adsr(n, a=a, d=dur, s=0.85, r=min(0.4, dur / 3), curve=0.5)
    L = filt(L, "lp", bright) * e
    R = filt(R, "lp", bright) * e
    return np.stack([L, R], 1) * 0.06


def pluck(midi, rng, dur=0.6, bright=1.0):
    n = int(dur * SR)
    f = hz(midi)
    t = t_of(n)
    x = (sine(f, n) + 0.35 * sine(2 * f, n) * np.exp(-t / 0.08) + 0.15 * tri(3 * f, n) * np.exp(-t / 0.03))
    x = filt(x, "lp", 1800 + 5000 * bright)
    return x * env_adsr(n, a=0.002, d=0.22, s=0.0, r=0.05) * 0.5


def stab(notes, rng, dur=0.22):
    n = int(dur * SR)
    x = sum(saw(hz(m), n) + saw(hz(m) * 1.005, n) for m in notes)
    x = filt(x, "lp", 2600 * np.exp(-t_of(n) / 0.08) + 400)
    return x * env_adsr(n, a=0.002, d=0.09, s=0.2, r=0.04) * 0.18


# ── sfx (each returns (stereo, align, align_sample)) ──────────────────────────
def sfx_whoosh(rng, frames=30, fps=60, speed=None, bright=1.0):
    if speed is not None:
        sp = np.asarray(speed, float)
        sp = sp / (sp.max() or 1)
        n = int(len(sp) / fps * SR) + int(0.25 * SR)
        e = np.interp(t_of(n), np.arange(len(sp)) / fps, sp, right=0.0) ** 1.4
        align, at = "start", 0
    else:
        dur = max(0.2, frames / fps)
        n = int((dur + 0.25) * SR)
        t = t_of(n)
        pk = dur * 0.62
        e = np.where(t < pk, (t / pk) ** 2.2, np.exp(-(t - pk) / (dur * 0.28)))
        align, at = "peak", int(pk * SR)
    e = e / (e.max() or 1)
    x = noise(n, rng)
    fc = 500 + 3800 * bright * e
    lo = filt(x, "lp", fc)
    hi = filt(x, "hp", 1800) * 0.25 * e
    y = (lo + hi) * e
    wob = 1 + 0.15 * np.sin(2 * np.pi * 11 * t_of(n))
    side = np.cumsum(np.gradient(e)) * 0.6
    st = np.stack([y * wob * (1 - side), y * (1 + side)], 1)
    return norm(st, 0.85), align, at


def sfx_riser(rng, frames=60, fps=60, harmony=None):
    dur = frames / fps
    n = int(dur * SR)
    t = t_of(n)
    p = t / dur
    e = p ** 2.4
    x = filt(noise(n, rng), "lp", 400 + 11000 * p ** 1.8) * e
    base = hz(harmony.degree(0, 3)) if harmony else 110
    f = base * 2 ** (3 * p ** 1.5)
    tone = (sine(f, n) + 0.4 * saw(f * 1.5, n)) * e * 0.25
    y = x + filt(tone, "lp", 5000)
    y[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))
    st = np.stack([y, np.roll(y, 90)], 1)
    return norm(st, 0.8), "end", n - 1


def sfx_swell(rng, frames=40, fps=60):
    dur = frames / fps
    n = int(dur * SR)
    p = t_of(n) / dur
    y = filt(noise(n, rng), "band", [2500, 9000]) * p ** 3
    y[-int(0.003 * SR):] *= np.linspace(1, 0, int(0.003 * SR))
    return norm(np.stack([y, np.roll(y, 60)], 1), 0.7), "end", n - 1


def sfx_impact(rng, harmony=None, ir=None):
    n = int(1.6 * SR)
    t = t_of(n)
    sub = sine(38 + 60 * np.exp(-t / 0.05), n) * np.exp(-t / 0.45)
    crack = filt(noise(n, rng), "lp", 5000) * np.exp(-t / 0.035)
    body = filt(noise(n, rng), "band", [80, 400]) * np.exp(-t / 0.18) * 0.6
    y = np.tanh(sub * 1.4) + crack * 0.5 + body
    if harmony:
        for m in harmony.chord(0, 4):
            y += sine(hz(m), n) * np.exp(-t / 0.9) * 0.08
    st = verb(y, ir, 0.22)[:n] if ir is not None else np.stack([y, y], 1)
    return norm(st, 0.9), "hit", 0


def sfx_thud(rng):
    n = int(0.35 * SR)
    t = t_of(n)
    y = sine(70 + 60 * np.exp(-t / 0.02), n) * np.exp(-t / 0.08) + filt(noise(n, rng), "lp", 900) * np.exp(-t / 0.02) * 0.4
    return norm(np.stack([y, y], 1), 0.8), "hit", 0


def sfx_sub(rng):
    n = int(1.2 * SR)
    t = t_of(n)
    y = np.tanh(sine(30 + 50 * np.exp(-t / 0.25), n) * np.exp(-t / 0.5) * 1.5)
    return norm(np.stack([y, y], 1), 0.85), "hit", 0


def sfx_pop(rng, midi=76):
    n = int(0.16 * SR)
    t = t_of(n)
    f = hz(midi) * (1.6 - 0.6 * (1 - np.exp(-t / 0.012)))
    y = sine(f, n) * np.exp(-t / 0.045) + 0.2 * sine(2 * f, n) * np.exp(-t / 0.015)
    y[: int(0.001 * SR)] *= np.linspace(0, 1, int(0.001 * SR))
    return norm(np.stack([y, y], 1), 0.75), "hit", 0


def sfx_tick(rng, bright=1.0):
    n = int(0.03 * SR)
    t = t_of(n)
    y = filt(noise(n, rng), "band", [2200 * bright, 7000]) * np.exp(-t / 0.004) + sine(3200 * bright, n) * np.exp(-t / 0.006) * 0.4
    return norm(np.stack([y, y], 1), 0.6), "hit", 0


def sfx_click(rng):
    n = int(0.06 * SR)
    t = t_of(n)
    a = filt(noise(n, rng), "band", [1500, 6000]) * np.exp(-t / 0.003)
    b = sine(1100, n) * np.exp(-t / 0.012) * 0.5
    y = a + b
    y2 = np.zeros(n)
    k = int(0.035 * SR)
    y2[k:] = (a[: n - k] * 0.4)
    return norm(np.stack([y + y2, y + y2], 1), 0.7), "hit", 0


def sfx_type(rng):
    n = int(0.05 * SR)
    t = t_of(n)
    f0 = 1800 + rng.random() * 1400
    y = filt(noise(n, rng), "band", [f0, f0 * 2.4]) * np.exp(-t / 0.005) + filt(noise(n, rng), "lp", 600) * np.exp(-t / 0.01) * 0.3
    return norm(np.stack([y, y], 1), 0.55), "hit", 0


def sfx_glitch(rng, frames=10, fps=60):
    n = int(max(0.08, frames / fps) * SR)
    y = np.zeros(n)
    i = 0
    while i < n:
        seg = int(rng.uniform(0.006, 0.025) * SR)
        kind = rng.integers(3)
        s = t_of(min(seg, n - i))
        if kind == 0:
            v = np.sign(sine(rng.uniform(200, 2400), len(s)))
        elif kind == 1:
            v = filt(noise(len(s), rng), "hp", 3000)
        else:
            v = np.round(noise(len(s), rng) * 3) / 3
        y[i:i + len(s)] = v * rng.uniform(0.3, 1)
        i += seg
    y *= np.exp(-t_of(n) / (n / SR * 0.8))
    return norm(np.stack([y, np.roll(y, 37)], 1), 0.6), "hit", 0


def sfx_shutter(rng):
    n = int(0.22 * SR)
    y = np.zeros(n)
    for dt, g in ((0, 1.0), (0.055, 0.7)):
        i = int(dt * SR)
        m = n - i
        tt = t_of(m)
        y[i:] += (filt(noise(m, rng), "band", [1200, 8000]) * np.exp(-tt / 0.006) + sine(620, m) * np.exp(-tt / 0.02) * 0.4) * g
    y += filt(noise(n, rng), "band", [300, 2000]) * np.exp(-t_of(n) / 0.05) * 0.2
    return norm(np.stack([y, y], 1), 0.7), "hit", 0


def sfx_chime(rng, harmony, ir):
    n = int(1.4 * SR)
    t = t_of(n)
    y = np.zeros(n)
    for k, d in enumerate((4, 7)):
        i = int(k * 0.07 * SR)
        f = hz(harmony.degree(d, 5))
        tt = t[: n - i]
        y[i:] += (sine(f, n - i) + 0.3 * sine(f * 2.76, n - i) * np.exp(-tt / 0.1)) * np.exp(-tt / 0.5)
    return norm(verb(y, ir, 0.3)[:n], 0.7), "hit", 0


def sfx_burst(rng, ir):
    n = int(0.7 * SR)
    t = t_of(n)
    y = filt(noise(n, rng), "hp", 1500) * np.exp(-t / 0.06) + sine(900 + 1400 * np.exp(-t / 0.03), n) * np.exp(-t / 0.05) * 0.4
    return norm(verb(y, ir, 0.35)[:n], 0.75), "hit", 0


# ── arrangement ──────────────────────────────────────────────────────────────
KITS = {
    "silence": {},
    "intro": {"pad": 0.7, "hat_q": 0.25, "bright": 900},
    "break": {"pad": 1.0, "bright": 1100, "arp": 0.35},
    "groove": {"pad": 0.9, "kick": 1, "hat8": 1, "clap": 1, "bass": 1, "bright": 1300},
    "lift": {"pad": 0.9, "kick": 1, "hat16": 1, "clap": 1, "bass": 1, "arp": 0.6, "bright": 2200},
    "montage": {"pad": 0.6, "kick": 1, "hat16": 1, "clap_all": 1, "bass": 1, "stab8": 1, "bright": 2600},
    "outro": {"pad": 1.0, "bright": 1500, "final": 1},
}


def build_music(score, harmony, rng, n_total, ir):
    fps = score["fps"]
    bpm = score["bpm"]
    spb = 60.0 / bpm
    t0 = score.get("beat0_frame", 0) / fps
    out = np.zeros((n_total, 2))
    bus_verb = np.zeros((n_total, 2))

    def add(x, at, g=1.0, pan=0.0, send=0.0):
        i = int(round(at * SR))
        if i >= n_total or i + len(x) <= 0:
            return
        st = pan2(x, pan) if x.ndim == 1 else x
        j0 = max(0, -i)
        seg = st[j0: n_total - i]
        out[i + j0: i + j0 + len(seg)] += seg * g
        if send:
            bus_verb[i + j0: i + j0 + len(seg)] += seg * g * send

    k_kick = kick(rng)
    k_clap = clap(rng)
    for sec in score["sections"]:
        kit = KITS.get(sec.get("kit", "groove"), KITS["groove"])
        b0, b1 = sec["from"], sec["to"]
        for b in range(int(b0), int(math.ceil(b1))):
            at = t0 + b * spb
            bar = int(b // 4)
            if at * SR >= n_total:
                break
            if kit.get("pad") and (b == b0 or b % 4 == 0):
                span = min(b1, (bar + 1) * 4) - b
                if span > 0:
                    add(pad_chord(harmony.chord(bar, 3) + [harmony.chord(bar, 4)[0]], span * spb + 0.4, rng, kit.get("bright", 1400)), at, kit["pad"], send=0.35)
            if kit.get("kick"):
                add(k_kick, at, 0.9)
            if kit.get("clap") and b % 2 == 1:
                add(k_clap, at, 0.6, send=0.2)
            if kit.get("clap_all"):
                add(k_clap, at, 0.5, send=0.15)
            if kit.get("hat_q"):
                add(hat(rng), at + spb / 2, kit["hat_q"], pan=0.3)
            if kit.get("hat8"):
                add(hat(rng), at + spb / 2, 0.6, pan=0.25)
                add(hat(rng), at, 0.25, pan=-0.2)
            if kit.get("hat16"):
                for q in range(4):
                    add(hat(rng, open_=(q == 2)), at + q * spb / 4, 0.3 + 0.25 * (q == 2), pan=0.3 * (-1) ** q)
            if kit.get("bass"):
                root = harmony.chord(bar, 2)[0]
                if b % 4 == 0 or b == b0:  # sustained sub under the bar
                    span = min(b1, (bar + 1) * 4) - b
                    n_sub = int(span * spb * SR)
                    add(sine(hz(root - 12), n_sub) * env_adsr(n_sub, a=0.01, d=span * spb, s=0.8, r=0.05, curve=0.3) * 0.22, at)
                add(bass_note(root, spb / 2 * 0.9, rng), at + spb / 2, 0.9)
                if b % 2 == 0:
                    add(bass_note(root, spb / 4, rng), at, 0.5)
            if kit.get("arp"):
                notes = harmony.chord(bar, 5)
                for q in range(4):
                    add(pluck(notes[(b * 4 + q) % 3], rng, 0.3, 0.6), at + q * spb / 4, kit["arp"] * 0.5, pan=0.4 * math.sin(b * 4 + q), send=0.4)
            if kit.get("stab8"):
                for q in range(2):
                    add(stab(harmony.chord(bar, 4), rng), at + q * spb / 2, 0.8, send=0.2)
            if kit.get("final") and b == b0:
                add(np.tanh(kick(rng, 1.5) * 1.2), at, 1.0)
                add(pad_chord(harmony.chord(0, 4), (b1 - b0) * spb, rng, 2400), at, 0.6, send=0.5)
        if sec.get("drop") and b0 > 0:
            at = t0 + b0 * spb
            gap = score.get("gap_ms", 90) / 1000
            i0, i1 = int((at - gap) * SR), int(at * SR)
            fade = int(0.006 * SR)
            if 0 < i0 < n_total:
                w = np.ones(n_total)
                w[i0:i1] = 0
                w[max(0, i0 - fade):i0] = np.linspace(1, 0, min(fade, i0))
                out *= w[:, None]
                bus_verb *= w[:, None]
    wet = np.stack([fftconvolve(bus_verb[:, c], ir[:, c])[:n_total] for c in range(2)], 1)
    y = out + wet * 0.5
    # glue: soft clip and gentle high cut
    y = np.tanh(y * 1.2) / 1.2
    return y


def sfx_for(item, rng, harmony, ir, fps):
    typ = item["type"]
    octave = item.get("octave", 5)
    if typ == "whoosh":
        return sfx_whoosh(rng, item.get("frames", 30), fps, item.get("speed"), item.get("bright", 1.0))
    if typ == "riser":
        return sfx_riser(rng, item.get("frames", 60), fps, harmony)
    if typ == "swell":
        return sfx_swell(rng, item.get("frames", 40), fps)
    if typ == "impact":
        return sfx_impact(rng, harmony, ir)
    if typ == "thud":
        return sfx_thud(rng)
    if typ == "sub":
        return sfx_sub(rng)
    if typ == "pop":
        return sfx_pop(rng, harmony.degree(item.get("degree", 4), octave))
    if typ == "pluck":
        x = pluck(harmony.degree(item.get("degree", 0), octave), rng, item.get("dur", 0.7), item.get("bright", 1.0))
        return norm(verb(x, ir, 0.3)[: len(x) + int(0.6 * SR)], 0.75), "hit", 0
    if typ == "stab":
        x = stab(harmony.chord(0, octave - 1), rng)
        return norm(verb(x, ir, 0.25), 0.75), "hit", 0
    if typ == "tick":
        return sfx_tick(rng, item.get("bright", 1.0))
    if typ == "click":
        return sfx_click(rng)
    if typ == "type":
        return sfx_type(rng)
    if typ == "glitch":
        return sfx_glitch(rng, item.get("frames", 10), fps)
    if typ == "shutter":
        return sfx_shutter(rng)
    if typ == "chime":
        return sfx_chime(rng, harmony, ir)
    if typ == "burst":
        return sfx_burst(rng, ir)
    raise SystemExit(f"unknown sfx type {typ!r}")


ROLE = {"whoosh": "whoosh", "riser": "riser", "swell": "riser", "impact": "impact", "thud": "impact_small",
        "sub": "sub", "pop": "pop", "pluck": "pop", "stab": "impact_small", "tick": "tick", "click": "click",
        "type": "key", "glitch": "glitch", "shutter": "click", "chime": "success", "burst": "impact_small"}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("score", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    score = json.loads(args.score.read_text(encoding="utf-8"))
    fps = score["fps"]
    n_total = int(round(score["frames"] / fps * SR))
    seed = score.get("seed", 7)
    rng = np.random.default_rng(seed)
    harmony = Harmony(score.get("key", "A"), score.get("scale", "minor"), score.get("chords", ["i", "VI", "III", "VII"]))
    ir = reverb_ir(score.get("reverb_s", 1.8), np.random.default_rng(seed + 1))
    out = args.out
    out.mkdir(parents=True, exist_ok=True)

    music = build_music(score, harmony, rng, n_total, ir)
    # end: ring out and fade the last frames so nothing is chopped
    fo = int(score.get("fade_out_ms", 400) / 1000 * SR)
    music[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5
    write_wav(out / "music.wav", norm(music, 0.8))

    sounds, cues = {}, []
    for k, item in enumerate(score.get("sfx", [])):
        frames = item.get("frames") if item["type"] == "type" else None
        hits = frames if isinstance(frames, list) else [item.get("frame", item.get("start"))]
        for j, fr in enumerate(hits):
            key = json.dumps({kk: vv for kk, vv in item.items() if kk not in ("frame", "start", "label", "gain_db", "pan")}, sort_keys=True)
            # repeated small sounds get 3 takes (a new take per hit or per entry) so they never machine-gun
            variant = (j if frames else k) % 3 if item["type"] in ("type", "tick", "click", "pop") else 0
            name = f"{item['type']}_{hashlib.md5((key + str(variant)).encode()).hexdigest()[:6]}"
            if name not in sounds:
                r = np.random.default_rng(seed * 1000 + k * 7 + variant)
                x, align, at = sfx_for(item, r, harmony, ir, fps)
                write_wav(out / "sfx" / f"{name}.wav", x)
                sounds[name] = {"file": f"sfx/{name}.wav", "role": ROLE[item["type"]], "align": align}
            cue = {"frame": fr, "sound": name, "align": sounds[name]["align"], "label": item.get("label", item["type"])}
            if item["type"] in ("riser", "swell") and "gain_db" not in item:
                cue["gain_db"] = -6
            for kk in ("gain_db", "pan", "duck_db"):
                if kk in item:
                    cue[kk] = item[kk]
            cues.append(cue)
    for s in sounds.values():
        s.pop("align")
    sheet = {
        "fps": fps, "duration_frames": score["frames"], "sample_rate": SR,
        "master": score.get("master", {"lufs": -14, "true_peak_db": -1.5, "max_limiting_db": 4}),
        "music": {"file": "music.wav", "under_mix_lu": score.get("under_mix_lu", 7), "edits": [[0, 0.0]],
                  "fade_in_ms": 5, "fade_out_ms": 10, "end_frame": score["frames"]},
        "duck": {"attack_ms": 20, "hold_ms": 120, "release_ms": 350},
        "sounds": sounds, "cues": sorted(cues, key=lambda c: c["frame"]),
    }
    (out / "cues.json").write_text(json.dumps(sheet, indent=1), encoding="utf-8")

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots(figsize=(18, 3.2))
        tt = np.arange(0, n_total, 480) / SR
        ax.plot(tt, 20 * np.log10(np.abs(music[::480, 0]) + 1e-4), lw=0.5, color="#888")
        spb = 60 / score["bpm"]
        t0 = score.get("beat0_frame", 0) / fps
        for b in range(int(n_total / SR / spb) + 1):
            ax.axvline(t0 + b * spb, color="#ccc" if b % 4 else "#666", lw=0.6)
        for sec in score["sections"]:
            ax.text(t0 + sec["from"] * spb + 0.02, 2, sec["kit"], fontsize=8)
        for c in cues:
            ax.axvline(c["frame"] / fps, color="tab:red", lw=0.8, alpha=0.7)
            ax.text(c["frame"] / fps, -58, c["label"][:14], rotation=90, fontsize=6)
        ax.set_ylim(-60, 6)
        ax.set_xlabel("seconds")
        fig.tight_layout()
        fig.savefig(out / "score.png", dpi=80)
    except Exception as e:  # pragma: no cover
        print("plot skipped:", e)
    print(f"music.wav {n_total / SR:.2f}s, {len(sounds)} synthesized sounds, {len(cues)} cues -> {out / 'cues.json'}")
    print(f"next: python build_mix.py {out / 'cues.json'} --out <public/audio/mix.wav>")


if __name__ == "__main__":
    main()
