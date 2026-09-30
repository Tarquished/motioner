#!/usr/bin/env python3
"""Instruments and an arrangement engine for BIG films (a finale that should make people say "wow"): cinematic booms with a
pitch-dropping sub and a long reverb tail, a choir made of formant-filtered saws, a tutti hit that stacks all of it, a time-reversed
boom that sucks into the next hit, bells and sonar pings in the key, sand grains, taiko, snare rolls, gliding chords, and a music
bed built from kits (drone, space, heart, groove, build, montage, together, finale, outro).

Every function makes the sound for ONE event and returns (stereo, align, align_sample) like the sfx_* functions of synth_score.py;
synth_score.sfx_for calls them through EPIC. The music bed is built by build_music_epic (score["music_engine"] == "epic").

Design rules (kept from the rejected zoom sound): the energy of every sound sits below 4 kHz except tiny transients; long tails go
through the reverb; big hits are built from layers with different jobs (sub = weight, thump = body, crack = attack, metal = colour,
air = size, choir = grandeur); every sound is in the film's key.

Types: boom tutti choir rewind revswell shock ping tick_land sand glide drum bellrun stab_hit sweep lockclick
"""
import math

import numpy as np

from synth_score import SR, env_adsr, filt, hz, kick, noise, norm, pad_chord, pan2, pluck, reverb_ir, saw, sine, stab, t_of, verb

_IR = {}


def ir(sec, seed=5, bright=6000):
    key = (sec, seed, bright)
    if key not in _IR:
        _IR[key] = reverb_ir(sec, np.random.default_rng(seed), bright)
    return _IR[key]


def send(y, ir_, amt, hp=180):
    """dry signal plus a reverb send that leaves the sub out (the tail is for size, not for mud)"""
    st = np.stack([y, y], 1) if y.ndim == 1 else y
    wet_in = np.stack([filt(st[:, 0], "hp", hp), filt(st[:, 1], "hp", hp)], 1)
    from scipy.signal import fftconvolve
    wet = np.stack([fftconvolve(wet_in[:, c], ir_[:, c]) for c in range(2)], 1)
    out = np.zeros((len(wet), 2))
    out[: len(st)] += st
    return out + wet * amt


def _pad_to(x, n):
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x, np.zeros((n - len(x), 2))])


def _mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros((n, 2))
    for p in parts:
        p = p if p.ndim == 2 else np.stack([p, p], 1)
        out[: len(p)] += p
    return out


def _tail(x, ms=12):
    k = min(len(x), int(ms / 1000 * SR))
    x = x.copy()
    x[-k:] *= np.linspace(1, 0, k)[:, None] if x.ndim == 2 else np.linspace(1, 0, k)
    return x


def bell(f, n, rng, decay=1.6):
    t = t_of(n)
    y = np.zeros(n)
    for r, a, d in ((1.0, 1.0, 1.0), (2.0, 0.42, 0.7), (2.76, 0.55, 0.55), (4.07, 0.22, 0.4), (5.4, 0.16, 0.3), (6.9, 0.08, 0.22)):
        y += a * np.sin(2 * np.pi * f * r * t + rng.random() * 6.28) * np.exp(-t / (decay * d))
    return y * np.minimum(1.0, t / 0.0012)


# ── the big hit ───────────────────────────────────────────────────────────────
def boom_core(rng, size=2.0, root=41.2, ring=329.63, tail=2.6):
    """weight (a sub that falls from a high pitch to the root), body, crack, a tuned metallic ring, air; through a long reverb"""
    dur = 1.6 + 0.6 * size
    n = int(dur * SR)
    t = t_of(n)
    f = root + root * 2.2 * np.exp(-t / 0.075)
    sub = np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.5 + 0.3 * size)) * 1.9)
    h2 = np.sin(2 * np.pi * np.cumsum(2 * f) / SR) * np.exp(-t / 0.4) * 0.55  # keeps it audible on small speakers
    thump = np.sin(2 * np.pi * np.cumsum(70 + 120 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.17)
    body = filt(noise(n, rng), "lp", 300) * np.exp(-t / 0.3)
    crack = filt(noise(n, rng), "hp", 2200) * np.exp(-t / 0.022) * 0.45 + np.sin(2 * np.pi * 1800 * t) * np.exp(-t / 0.004) * 0.22
    metal = bell(ring, n, rng, decay=0.9 + 0.3 * size) * 0.2
    air = filt(noise(n, rng), "band", [150, 2200]) * np.exp(-t / (0.8 + 0.3 * size)) * 0.17
    y = 0.7 * sub + 1.25 * h2 + 0.85 * thump + 1.0 * body + crack + metal + air
    y[: int(0.0012 * SR)] *= np.linspace(0, 1, int(0.0012 * SR))
    y = np.tanh(y * 0.85)
    y = np.concatenate([y, np.zeros(int(tail * SR))])
    return send(y, ir(3.8, 7, 5200), 0.55 + 0.1 * size)[: len(y)]


def sfx_boom(item, rng, harmony, ir_, fps):
    size = float(item.get("size", 2.0))
    return norm(boom_core(rng, size, float(item.get("root", 41.2)), float(item.get("ring", 329.63))), 0.95), "hit", 0


def choir_core(notes, dur, att, rng, wet=0.45, bright=1.0, release=1.4):
    n = int(dur * SR)
    t = t_of(n)
    L = np.zeros(n)
    R = np.zeros(n)
    for m in notes:
        for det, side in ((-0.15, 0), (0.0, 2), (0.14, 1)):
            f = hz(m) * 2 ** (det / 12)
            vib = 1 + 0.0045 * np.sin(2 * np.pi * (4.6 + rng.random() * 1.2) * t + rng.random() * 6.28)
            v = saw(f * vib, n, phase=rng.random())
            if side == 0:
                L += v
            elif side == 1:
                R += v
            else:
                L += 0.6 * v
                R += 0.6 * v

    def vowel(x):
        y = np.zeros(n)
        for fc, g, bw in ((800, 1.0, 260), (1150, 0.55, 320), (2900, 0.22, 700)):
            y += g * filt(x, "band", [fc - bw / 2, fc + bw / 2])
        return y

    breath = filt(noise(n, rng), "band", [900, 3200]) * 0.05
    e = env_adsr(n, a=att, d=dur, s=0.9, r=release, curve=0.3)
    Lc = filt(vowel(L) + breath, "lp", 4200 * bright) * e
    Rc = filt(vowel(R) + np.roll(breath, 40), "lp", 4200 * bright) * e
    st = np.stack([Lc, Rc], 1)
    return verb(st, ir(3.0, 9, 4500), wet)[: n + int(1.5 * SR)]


def sfx_choir(item, rng, harmony, ir_, fps):
    bar = int(item.get("bar", 0))
    notes = harmony.chord(bar, 3) + [harmony.chord(bar, 4)[0], harmony.chord(bar, 4)[2]]
    if item.get("octave_up"):
        notes = [n + 12 for n in notes]
    y = choir_core(notes, float(item.get("dur", 3.0)), float(item.get("attack", 0.5)), rng, float(item.get("wet", 0.45)))
    y = _tail(y, 30)
    return norm(y, 0.9), ("end" if item.get("swell") else "hit"), 0


def _brass(midis, dur, rng):
    n = int(dur * SR)
    t = t_of(n)
    y = np.zeros(n)
    for m in midis:
        f = hz(m)
        y += saw(f, n, rng.random()) + saw(f * 1.006, n, rng.random()) + saw(f * 0.994, n, rng.random())
    cut = 500 + 2600 * (1 - np.exp(-t / 0.06)) * np.exp(-t / 0.5)
    y = filt(y, "lp", cut)
    return y * env_adsr(n, a=0.02, d=0.45, s=0.35, r=0.25, curve=2.5) * 0.11


def sfx_tutti(item, rng, harmony, ir_, fps):
    """the biggest hit: boom + choir + brass + bell cascade + crash, all in the bar's chord"""
    size = float(item.get("size", 3.0))
    bar = int(item.get("bar", 0))
    ch3 = harmony.chord(bar, 3)
    ch4 = harmony.chord(bar, 4)
    b = boom_core(rng, size, 41.2, hz(ch4[0]) if not item.get("ring") else float(item["ring"]), 3.2)
    dur = 3.6 + 0.5 * size
    cho = choir_core(ch3 + [ch4[0], ch4[2]], dur, 0.05, rng, 0.5)
    brass = verb(_brass(ch3 + [ch4[0]], 1.4, rng), ir(2.0, 11), 0.25)
    bells = np.zeros(int((2.4 + 0.5 * size) * SR))
    for k, m in enumerate(ch4 + [ch4[0] + 12, ch4[2] + 12, ch4[1] + 24]):
        i = int(k * 0.045 * SR)
        nn = len(bells) - i
        bells[i:] += bell(hz(m + 12), nn, rng, decay=1.3) * (0.16 - 0.012 * k)
    bells = verb(bells, ir(3.0, 13), 0.4)
    n = int((1.2 + 0.6 * size) * SR)
    crash = filt(noise(n, rng), "hp", 3200) * np.exp(-t_of(n) / 1.1) * 0.17 * np.minimum(1, t_of(n) / 0.004)
    crash = filt(crash, "lp", 9000)
    y = _mix(b * 1.0, cho * 0.42, brass * 0.7, bells * 0.95, crash)
    return norm(_tail(y, 40), 0.95), "hit", 0


def sfx_rewind(item, rng, harmony, ir_, fps):
    """the sound of time running backwards: the tail of a boom played in reverse (it swells into the hit), a rising bell glide, a
    hissing swell. Aligned by its END: the end frame is the moment the next hit lands (put it ~90 ms before the hit for the silence)."""
    dur = item["frames"] / fps
    n = int(dur * SR)
    t = t_of(n)
    p = t / dur
    b = boom_core(rng, float(item.get("size", 2.5)), 41.2, 329.63, 1.0)
    rev = b[:n][::-1].copy()
    rev *= (0.35 + 0.65 * p ** 1.5)[:, None]
    f = 180 * 2 ** (3.6 * p ** 1.4)
    glide = np.sin(2 * np.pi * np.cumsum(f) / SR) * p ** 2.6 * 0.22 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * p ** 3 * 0.1
    glide = filt(glide, "lp", 4200)
    hiss = filt(noise(n, rng), "band", [600, 5200]) * p ** 3.2 * 0.16
    st = _mix(rev, np.stack([glide, np.roll(glide, 33)], 1), np.stack([hiss, np.roll(hiss, 71)], 1))
    st = verb(st, ir(1.6, 17), 0.2)[:n]
    k = int(0.03 * SR)
    st[-k:] *= (np.linspace(1, 0, k) ** 2)[:, None]
    return norm(st, 0.9), "end", n - k - 1


def sfx_revswell(item, rng, harmony, ir_, fps):
    dur = item["frames"] / fps
    n = int(dur * SR)
    t = t_of(n)
    p = t / dur
    x = filt(noise(n, rng), "hp", 600 + 3500 * p) * p ** 2.6
    x = filt(x, "lp", 9000)
    f = 300 * 2 ** (2.4 * p)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * p ** 3 * 0.16
    st = np.stack([x * 0.5 + tone, np.roll(x, 61) * 0.5 + tone], 1)
    k = int(0.03 * SR)
    st[-k:] *= (np.linspace(1, 0, k) ** 2)[:, None]
    return norm(st, 0.85), "end", n - k - 1


def sfx_shock(item, rng, harmony, ir_, fps):
    """the room changes: a soft low-mid rush that follows the ring's own speed, a warm sub thump on the ring's birth"""
    frames = float(item.get("frames", 30))
    dur = frames / fps + 0.5
    n = int(dur * SR)
    t = t_of(n)
    p = np.clip(t / (frames / fps), 0, 1.5)
    env = np.where(t < 0.02, t / 0.02, np.exp(-t / (0.32 * frames / 30)))
    x = filt(noise(n, rng), "lp", 350 + 1900 * env * float(item.get("bright", 0.6)))
    thump = np.sin(2 * np.pi * np.cumsum(58 + 50 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.35) * 0.9
    chord = np.zeros(n)
    for m in item.get("notes", [40, 47, 52]):
        chord += np.sin(2 * np.pi * hz(m) * t) * 0.18
    chord *= np.exp(-t / 0.9) * np.minimum(1, t / 0.03)
    y = x * env * 0.45 + thump + chord
    st = verb(np.stack([y, np.roll(y, 29)], 1), ir(2.2, 19), 0.3)[:n]
    return norm(_tail(st, 30), 0.85), "hit", 0


def sfx_ping(item, rng, harmony, ir_, fps):
    """a sonar ping in the key: a bell with two echoes that pan out"""
    midi = float(item.get("midi", 76))
    dec = float(item.get("decay", 1.4))
    n = int((dec * 3 + 1.2) * SR)
    y = bell(hz(midi), n, rng, decay=dec) * 0.7 + np.sin(2 * np.pi * hz(midi) * t_of(n)) * np.exp(-t_of(n) / 0.05) * 0.3
    L = y.copy()
    R = y.copy() * 0.0
    for k, (dt, g, pn) in enumerate(((0.19, 0.42, 1), (0.38, 0.22, -1), (0.57, 0.11, 1))):
        if item.get("echoes", 3) <= k:
            break
        i = int(dt * SR)
        (R if pn > 0 else L)[i:] += y[: n - i] * g
    st = verb(np.stack([L, R + 0.35 * y], 1), ir(2.6, 21), 0.35)[:n]
    return norm(_tail(st, 30), 0.85), "hit", 0


def sfx_tick_land(item, rng, harmony, ir_, fps):
    midi = float(item.get("midi", 88))
    n = int(0.5 * SR)
    y = bell(hz(midi), n, rng, decay=0.16) * 0.8 + filt(noise(n, rng), "band", [1800, 4200]) * np.exp(-t_of(n) / 0.003) * 0.16
    return norm(_tail(np.stack([y, y], 1), 10), 0.7), "hit", 0


def sfx_sand(item, rng, harmony, ir_, fps):
    """the sand jumping on the plate: grains of filtered noise whose density follows the picture's complexity"""
    dur = item["frames"] / fps
    n = int(dur * SR)
    d0, d1 = float(item.get("d0", 30)), float(item.get("d1", 300))
    dens = np.linspace(d0, d1, n) / SR
    hits = np.nonzero(rng.random(n) < dens)[0]
    y = np.zeros((n, 2))
    for i in hits:
        m = int(rng.uniform(0.0012, 0.004) * SR)
        if i + m >= n:
            continue
        fc = rng.uniform(1800, 5200)
        g = filt(noise(m, rng), "band", [fc, fc * 1.5]) * np.exp(-t_of(m) / (m / SR * 0.35)) * rng.uniform(0.3, 1.0)
        p = rng.uniform(-1, 1)
        y[i:i + m, 0] += g * (1 - p) / 2
        y[i:i + m, 1] += g * (1 + p) / 2
    y *= np.minimum(1, t_of(n) / 0.05)[:, None] * np.minimum(1, (dur - t_of(n)) / 0.08)[:, None]
    return norm(y, 0.6), "start", 0


def sfx_glide(item, rng, harmony, ir_, fps):
    """a chord that slides up (soft, in key): the line bending into a ring, or a word melting"""
    dur = item["frames"] / fps
    n = int(dur * SR) + int(0.4 * SR)
    t = t_of(n)
    p = np.clip(t / dur, 0, 1)
    semis = float(item.get("semis", 12))
    g = 2 ** (semis * (p ** 1.6 - 1) / 12)  # arrives on the chord tones at the end
    bar = int(item.get("bar", 0))
    notes = harmony.chord(bar, 3) + [harmony.chord(bar, 4)[0]]
    L = np.zeros(n)
    R = np.zeros(n)
    for j, m in enumerate(notes):
        f = hz(m) * g
        ph = np.cumsum(f) / SR
        v = np.sin(2 * np.pi * ph) + 0.28 * np.sin(4 * np.pi * ph) + 0.08 * np.sin(6 * np.pi * ph)
        (L if j % 2 else R).__iadd__(v * 0.8)
        (R if j % 2 else L).__iadd__(v * 0.3)
    env = np.minimum(1, t / (0.35 * dur + 0.05)) ** 1.5 * np.where(t < dur, 1, np.exp(-(t - dur) / 0.15))
    st = np.stack([filt(L, "lp", 2400) * env, filt(R, "lp", 2400) * env], 1) * 0.2
    st = verb(st, ir(2.4, 23), 0.3)[:n]
    return norm(_tail(st, 30), 0.8), "end", int(dur * SR)


def _drum(kind, rng):
    if kind == "kick":
        return kick(rng, 1.3)
    if kind == "kick_soft":
        return kick(rng, 0.5) * 0.8
    if kind == "snare":
        n = int(0.32 * SR)
        t = t_of(n)
        y = filt(noise(n, rng), "band", [1400, 7000]) * np.exp(-t / 0.09) * 0.7 + np.sin(2 * np.pi * (190 + 90 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.07) * 0.8
        return np.tanh(y * 1.4)
    if kind == "clap":
        n = int(0.32 * SR)
        x = filt(noise(n, rng), "band", [900, 3400])
        e = np.zeros(n)
        for k, dt in enumerate((0, 0.011, 0.023)):
            i = int(dt * SR)
            e[i:] += np.exp(-t_of(n - i) / (0.008 if k < 2 else 0.11)) * (0.7 if k < 2 else 1)
        return x * e * 0.6
    if kind == "tom":
        n = int(0.8 * SR)
        t = t_of(n)
        y = np.sin(2 * np.pi * np.cumsum(90 + 120 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.28) + filt(noise(n, rng), "lp", 900) * np.exp(-t / 0.03) * 0.5
        return np.tanh(y * 1.5)
    if kind == "taiko":
        n = int(1.3 * SR)
        t = t_of(n)
        y = np.sin(2 * np.pi * np.cumsum(58 + 90 * np.exp(-t / 0.06)) / SR) * np.exp(-t / 0.4) + filt(noise(n, rng), "lp", 700) * np.exp(-t / 0.05) * 0.5
        y += np.sin(2 * np.pi * 116 * t) * np.exp(-t / 0.2) * 0.3
        return np.tanh(y * 1.6)
    if kind == "hat":
        n = int(0.06 * SR)
        return filt(filt(noise(n, rng), "hp", 6500), "lp", 11000) * np.exp(-t_of(n) / 0.014) * 0.22
    raise SystemExit(f"unknown drum {kind}")


def sfx_drum(item, rng, harmony, ir_, fps):
    y = _drum(item.get("kind", "kick"), rng)
    st = verb(y, ir(1.8, 29), float(item.get("wet", 0.18)))
    return norm(_tail(st, 20), 0.9), "hit", 0


def sfx_bellrun(item, rng, harmony, ir_, fps):
    """a fast run of bells (the letters lighting up): notes is a list of midi, step is the gap in seconds"""
    notes = item["notes"]
    step = float(item.get("step", 4 / 60))
    n = int((len(notes) * step + 2.6) * SR)
    y = np.zeros(n)
    for k, m in enumerate(notes):
        i = int(k * step * SR)
        nn = n - i
        y[i:] += bell(hz(m), nn, rng, decay=1.2) * (0.5 + 0.04 * k)
    st = verb(np.stack([y, np.roll(y, 25)], 1), ir(3.0, 31), 0.4)[:n]
    return norm(_tail(st, 30), 0.85), "hit", 0


def sfx_stab_hit(item, rng, harmony, ir_, fps):
    notes = item.get("notes")
    if notes is None:
        bar = int(item.get("bar", 0))
        notes = harmony.chord(bar, 3) + [harmony.chord(bar, 4)[0]]
    y = _brass(notes, float(item.get("dur", 0.9)), rng) * 2.0
    st = verb(np.stack([y, y], 1), ir(2.0, 37), 0.3)
    return norm(_tail(st, 20), 0.85), "hit", 0


def sfx_sweep(item, rng, harmony, ir_, fps):
    """a soft rising sweep in two octaves of the chord (no noise above 3 kHz): the zoom-out and the ring closing"""
    dur = item["frames"] / fps
    n = int(dur * SR) + int(0.3 * SR)
    t = t_of(n)
    p = np.clip(t / dur, 0, 1)
    bar = int(item.get("bar", 0))
    base = harmony.chord(bar, 3)[0]
    f = hz(base) * 2 ** (float(item.get("oct", 2)) * p ** 1.5)
    tone = (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)) * p ** 1.8
    tone2 = np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * p ** 2.2 * 0.5
    air = filt(noise(n, rng), "lp", 300 + 2500 * p) * p ** 2 * 0.12
    env = np.where(t < dur, 1, np.exp(-(t - dur) / 0.08))
    y = (tone + tone2 + air) * env * 0.25
    st = verb(np.stack([y, np.roll(y, 37)], 1), ir(2.2, 41), 0.28)[:n]
    return norm(_tail(st, 30), 0.8), "end", int(dur * SR)


def sfx_lockclick(item, rng, harmony, ir_, fps):
    """the frame locks: a crystal click, a short bell and a soft sub"""
    n = int(1.6 * SR)
    t = t_of(n)
    y = filt(noise(n, rng), "band", [1600, 4800]) * np.exp(-t / 0.004) * 0.4
    y += bell(hz(item.get("midi", 88)), n, rng, decay=0.55) * 0.6
    y += np.sin(2 * np.pi * np.cumsum(52 + 40 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.3) * 0.8
    st = verb(np.stack([y, y], 1), ir(2.0, 43), 0.3)[:n]
    return norm(_tail(st, 30), 0.85), "hit", 0


def sfx_converge(item, rng, harmony, ir_, fps):
    """three voices a little out of tune (the three colour plates of a print out of register) that swell and pull into one pitch exactly
    at the end: the sound of registration. Aligned by its END."""
    dur = item["frames"] / fps
    n = int(dur * SR)
    t = t_of(n)
    p = t / dur
    bar = int(item.get("bar", 0))
    notes = harmony.chord(bar, 3)[:2] + [harmony.chord(bar, 4)[0]]
    st = np.zeros((n, 2))
    spread = (1 - p ** 1.6) * 0.75  # semitones apart, zero at the end
    for j, m in enumerate(notes):
        for k, det in enumerate((-1.0, 0.0, 1.0)):
            f = hz(m) * 2 ** ((det * spread) / 12)
            ph = np.cumsum(f) / SR
            v = (np.sin(2 * np.pi * ph) + 0.35 * np.sin(4 * np.pi * ph) + 0.12 * np.sin(6 * np.pi * ph))
            pan = (k - 1) * 0.7
            a_ = (pan + 1) * math.pi / 4
            st[:, 0] += v * math.cos(a_)
            st[:, 1] += v * math.sin(a_)
    env = p ** 1.8 * (1 - np.exp(-t / 0.05))
    st = np.stack([filt(st[:, 0], "lp", 2600), filt(st[:, 1], "lp", 2600)], 1) * env[:, None] * 0.09
    k = int(0.03 * SR)
    st[-k:] *= (np.linspace(1, 0, k) ** 2)[:, None]
    return norm(st, 0.8), "end", n - k - 1


EPIC = {
    "boom": sfx_boom, "tutti": sfx_tutti, "choir": sfx_choir, "rewind": sfx_rewind, "revswell": sfx_revswell, "shock": sfx_shock,
    "ping": sfx_ping, "tick_land": sfx_tick_land, "sand": sfx_sand, "glide": sfx_glide, "drum": sfx_drum, "bellrun": sfx_bellrun,
    "stab_hit": sfx_stab_hit, "sweep": sfx_sweep, "lockclick": sfx_lockclick, "converge": sfx_converge,
}
EPIC_ROLE = {
    "boom": "boom", "tutti": "boom", "choir": "success", "rewind": "riser", "revswell": "riser", "shock": "whoosh", "ping": "pop",
    "tick_land": "tick", "sand": "ambience", "glide": "whoosh", "drum": "impact_small", "bellrun": "success", "stab_hit": "impact_small",
    "sweep": "whoosh", "lockclick": "click", "converge": "riser",
}


# ── the music bed ────────────────────────────────────────────────────────────
def _wide_pad(notes, dur, rng, bright=1200, att=0.6):
    n = int(dur * SR)
    y = pad_chord(notes, dur, rng, bright)
    return y


def build_music_epic(score, harmony, rng, n_total, _ir):
    fps = score["fps"]
    out = np.zeros((n_total, 2))
    bus = np.zeros((n_total, 2))
    IRL = ir(3.4, 47, 5000)

    def add(x, f, g=1.0, pan=0.0, send=0.0):
        i = int(round(f / fps * SR))
        if i >= n_total or i + len(x) <= 0:
            return
        s = pan2(x, pan) if x.ndim == 1 else x
        j0 = max(0, -i)
        seg = s[j0: n_total - i]
        out[i + j0: i + j0 + len(seg)] += seg * g
        if send:
            bus[i + j0: i + j0 + len(seg)] += seg * g * send

    beat = 60.0 / score["bpm"] * fps  # frames per beat
    bar_f = beat * 4
    k_kick = kick(rng, 1.1)
    k_soft = kick(rng, 0.5)
    k_tai = _drum("taiko", rng)
    k_clap = _drum("clap", rng)
    for sec in score["epic"]:
        kit = sec["kit"]
        a, b = float(sec["from"]), float(sec["to"])
        g = float(sec.get("gain", 1.0))
        bar0 = int(a // bar_f)
        if kit == "drone":
            n = int((b - a) / fps * SR)
            t = t_of(n)
            lfo = 0.85 + 0.15 * np.sin(2 * np.pi * 0.35 * t)
            root = hz(28)  # E1
            # the hum: E1 for weight, but most of the energy at E2/E3/B3 (a laptop speaker plays nothing below 90 Hz)
            d = (np.sin(2 * np.pi * root * t) * 0.35 + np.sin(2 * np.pi * 2 * root * t) * 0.6 + np.sin(2 * np.pi * 3.003 * root * t) * 0.32
                 + np.sin(2 * np.pi * 4 * root * t) * 0.16 + np.sin(2 * np.pi * 6.01 * root * t) * 0.07) * lfo
            air = filt(noise(n, rng), "band", [150, 900]) * 0.05
            ramp = np.minimum(1, t / float(sec.get("fade_in", 1.2))) ** 2 * np.minimum(1, (n / SR - t) / float(sec.get("fade_out", 0.05)))
            y = (d + air) * ramp * 0.42
            add(np.stack([y, y], 1), a, g, send=0.2)
            continue
        f = a
        while f < b - 1e-6:
            bar = int(f // bar_f)
            bi = int(round((f - bar * bar_f) / beat))  # beat inside the bar
            root = harmony.chord(bar, 2)[0]
            span = min(b, (bar + 1) * bar_f) - f
            if bi == 0 or f == a:
                if kit in ("space", "heart", "groove", "build", "montage", "together", "finale", "outro"):
                    br = {"space": 950, "heart": 1100, "groove": 1500, "build": 1700, "montage": 1900, "together": 2400, "finale": 1700, "outro": 1100}[kit]
                    if kit in ("finale", "together", "outro"):
                        notes = harmony.chord(bar, 3) + [harmony.chord(bar, 4)[0], harmony.chord(bar, 4)[2]]
                        ch = choir_core(notes, span / fps + 0.8, 0.9 if kit != "together" else 0.4, rng, 0.4)
                        add(ch, f, g * {"finale": 0.5, "together": 0.62, "outro": 0.42}[kit], send=0.2)
                    else:
                        add(pad_chord(harmony.chord(bar, 3) + [harmony.chord(bar, 4)[0]], span / fps + 0.5, rng, br), f, g * 0.9, send=0.35)
                    nsub = int(span / fps * SR)
                    add(sine(hz(root - 12), nsub) * env_adsr(nsub, a=0.02, d=span / fps, s=0.85, r=0.06, curve=0.3) * 0.15, f, g)
            if kit == "space" and bi in (0, 2):
                add(k_tai, f, g * (0.7 if bi == 0 else 0.4), send=0.5)
            if kit in ("heart", "groove", "build", "montage", "together") and kit != "heart" or kit == "heart":
                if kit == "heart":
                    add(k_soft, f, g * 0.55)
                    notes = harmony.chord(bar, 5)
                    for q in range(2):
                        add(pluck(notes[(bi * 2 + q) % 3], rng, 0.3, 0.6), f + q * beat / 2, g * 0.34, pan=0.4 * math.sin(f + q), send=0.45)
                    if bi % 2 == 1:
                        add(k_clap, f, g * 0.3, send=0.2)
                elif kit in ("groove", "montage", "together"):
                    add(k_kick, f, g * 0.95)
                    if bi % 2 == 1:
                        add(k_clap, f, g * (0.7 if kit != "montage" else 0.85), send=0.2)
                    for q in range(4):
                        h = _drum("hat", rng)
                        add(h, f + q * beat / 4, g * (0.5 if q % 2 else 0.35), pan=0.3 * (-1) ** q)
                    add(_bass(root, beat / fps * 0.45, rng), f + beat / 2, g * 0.9)
                    if bi % 2 == 0:
                        add(_bass(root, beat / fps * 0.25, rng), f, g * 0.5)
                    notes = harmony.chord(bar, 5)
                    for q in range(4):
                        add(pluck(notes[(bi * 4 + q) % 3], rng, 0.26, 0.7), f + q * beat / 4, g * 0.3, pan=0.5 * math.sin(f + q), send=0.5)
                    if kit in ("montage", "together") and bi in (0, 2):
                        add(_stab_notes(harmony.chord(bar, 4), rng), f + beat / 2, g * 0.7, send=0.25)
                elif kit == "build":
                    add(k_kick, f, g * 0.9)
                    add(_bass(root, beat / fps * 0.45, rng), f + beat / 2, g * 0.8)
                    for q in range(4):
                        add(_drum("hat", rng), f + q * beat / 4, g * 0.35, pan=0.3 * (-1) ** q)
            if kit == "finale":
                if bi == 0 and int(round(f - a)) % int(bar_f) == 0:
                    add(k_tai, f, g * 0.55, send=0.5)
                notes = harmony.chord(bar, 5)
                for q in range(2):
                    add(pluck(notes[(bi * 2 + q + 1) % 3], rng, 0.5, 0.8), f + q * beat / 2, g * 0.22, pan=0.5 * math.sin(f * 0.3 + q), send=0.6)
            f += beat
    from scipy.signal import fftconvolve
    wet = np.stack([fftconvolve(wet_in[:, c], ir_[:, c]) for c in range(2)], 1)
    out = np.zeros((len(wet), 2))
    out[: len(st)] += st
    return out + wet * amt


def _pad_to(x, n):
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x, np.zeros((n - len(x), 2))])


def _mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros((n, 2))
    for p in parts:
        p = p if p.ndim == 2 else np.stack([p, p], 1)
        out[: len(p)] += p
    return out


def _tail(x, ms=12):
    k = min(len(x), int(ms / 1000 * SR))
    x = x.copy()
    x[-k:] *= np.linspace(1, 0, k)[:, None] if x.ndim == 2 else np.linspace(1, 0, k)
    return x


def bell(f, n, rng, decay=1.6):
    t = t_of(n)
    y = np.zeros(n)
    for r, a, d in ((1.0, 1.0, 1.0), (2.0, 0.42, 0.7), (2.76, 0.55, 0.55), (4.07, 0.22, 0.4), (5.4, 0.16, 0.3), (6.9, 0.08, 0.22)):
        y += a * np.sin(2 * np.pi * f * r * t + rng.random() * 6.28) * np.exp(-t / (decay * d))
    return y * np.minimum(1.0, t / 0.0012)


# ── the big hit ───────────────────────────────────────────────────────────────
def boom_core(rng, size=2.0, root=41.2, ring=329.63, tail=2.6):
    """weight (a sub that falls from a high pitch to the root), body, crack, a tuned metallic ring, air; through a long reverb"""
    dur = 1.6 + 0.6 * size
    n = int(dur * SR)
    t = t_of(n)
    f = root + root * 2.2 * np.exp(-t / 0.075)
    sub = np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.5 + 0.3 * size)) * 1.9)
    h2 = np.sin(2 * np.pi * np.cumsum(2 * f) / SR) * np.exp(-t / 0.4) * 0.55  # keeps it audible on small speakers
    thump = np.sin(2 * np.pi * np.cumsum(70 + 120 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.17)
    body = filt(noise(n, rng), "lp", 300) * np.exp(-t / 0.3)
    crack = filt(noise(n, rng), "hp", 2200) * np.exp(-t / 0.022) * 0.45 + np.sin(2 * np.pi * 1800 * t) * np.exp(-t / 0.004) * 0.22
    metal = bell(ring, n, rng, decay=0.9 + 0.3 * size) * 0.2
    air = filt(noise(n, rng), "band", [150, 2200]) * np.exp(-t / (0.8 + 0.3 * size)) * 0.17
    y = 0.7 * sub + 1.25 * h2 + 0.85 * thump + 1.0 * body + crack + metal + air
    y[: int(0.0012 * SR)] *= np.linspace(0, 1, int(0.0012 * SR))
    y = np.tanh(y * 0.85)
    y = np.concatenate([y, np.zeros(int(tail * SR))])
    return send(y, ir(3.8, 7, 5200), 0.55 + 0.1 * size)[: len(y)]


def sfx_boom(item, rng, harmony, ir_, fps):
    size = float(item.get("size", 2.0))
    return norm(boom_core(rng, size, float(item.get("root", 41.2)), float(item.get("ring", 329.63))), 0.95), "hit", 0


def choir_core(notes, dur, att, rng, wet=0.45, bright=1.0, release=1.4):
    n = int(dur * SR)
    t = t_of(n)
    L = np.zeros(n)
    R = np.zeros(n)
    for m in notes:
        for det, side in ((-0.15, 0), (0.0, 2), (0.14, 1)):
            f = hz(m) * 2 ** (det / 12)
            vib = 1 + 0.0045 * np.sin(2 * np.pi * (4.6 + rng.random() * 1.2) * t + rng.random() * 6.28)
            v = saw(f * vib, n, phase=rng.random())
            if side == 0:
                L += v
            elif side == 1:
                R += v
            else:
                L += 0.6 * v
                R += 0.6 * v

    def vowel(x):
        y = np.zeros(n)
        for fc, g, bw in ((800, 1.0, 260), (1150, 0.55, 320), (2900, 0.22, 700)):
            y += g * filt(x, "band", [fc - bw / 2, fc + bw / 2])
        return y

    breath = filt(noise(n, rng), "band", [900, 3200]) * 0.05
    e = env_adsr(n, a=att, d=dur, s=0.9, r=release, curve=0.3)
    Lc = filt(vowel(L) + breath, "lp", 4200 * bright) * e
    Rc = filt(vowel(R) + np.roll(breath, 40), "lp", 4200 * bright) * e
    st = np.stack([Lc, Rc], 1)
    return verb(st, ir(3.0, 9, 4500), wet)[: n + int(1.5 * SR)]


def sfx_choir(item, rng, harmony, ir_, fps):
    bar = int(item.get("bar", 0))
    notes = harmony.chord(bar, 3) + [harmony.chord(bar, 4)[0], harmony.chord(bar, 4)[2]]
    if item.get("octave_up"):
        notes = [n + 12 for n in notes]
    y = choir_core(notes, float(item.get("dur", 3.0)), float(item.get("attack", 0.5)), rng, float(item.get("wet", 0.45)))
    y = _tail(y, 30)
    return norm(y, 0.9), ("end" if item.get("swell") else "hit"), 0


def _brass(midis, dur, rng):
    n = int(dur * SR)
    t = t_of(n)
    y = np.zeros(n)
    for m in midis:
        f = hz(m)
        y += saw(f, n, rng.random()) + saw(f * 1.006, n, rng.random()) + saw(f * 0.994, n, rng.random())
    cut = 500 + 2600 * (1 - np.exp(-t / 0.06)) * np.exp(-t / 0.5)
    y = filt(y, "lp", cut)
    return y * env_adsr(n, a=0.02, d=0.45, s=0.35, r=0.25, curve=2.5) * 0.11


def sfx_tutti(item, rng, harmony, ir_, fps):
    """the biggest hit: boom + choir + brass + bell cascade + crash, all in the bar's chord"""
    size = float(item.get("size", 3.0))
    bar = int(item.get("bar", 0))
    ch3 = harmony.chord(bar, 3)
    ch4 = harmony.chord(bar, 4)
    b = boom_core(rng, size, 41.2, hz(ch4[0]) if not item.get("ring") else float(item["ring"]), 3.2)
    dur = 3.6 + 0.5 * size
    cho = choir_core(ch3 + [ch4[0], ch4[2]], dur, 0.05, rng, 0.5)
    brass = verb(_brass(ch3 + [ch4[0]], 1.4, rng), ir(2.0, 11), 0.25)
    bells = np.zeros(int((2.4 + 0.5 * size) * SR))
    for k, m in enumerate(ch4 + [ch4[0] + 12, ch4[2] + 12, ch4[1] + 24]):
        i = int(k * 0.045 * SR)
        nn = len(bells) - i
        bells[i:] += bell(hz(m + 12), nn, rng, decay=1.3) * (0.16 - 0.012 * k)
    bells = verb(bells, ir(3.0, 13), 0.4)
    n = int((1.2 + 0.6 * size) * SR)
    crash = filt(noise(n, rng), "hp", 3200) * np.exp(-t_of(n) / 1.1) * 0.17 * np.minimum(1, t_of(n) / 0.004)
    crash = filt(crash, "lp", 9000)
    y = _mix(b * 1.0, cho * 0.42, brass * 0.7, bells * 0.95, crash)
    return norm(_tail(y, 40), 0.95), "hit", 0


def sfx_rewind(item, rng, harmony, ir_, fps):
    """the sound of time running backwards: the tail of a boom played in reverse (it swells into the hit), a rising bell glide, a
    hissing swell. Aligned by its END: the end frame is the moment the next hit lands (put it ~90 ms before the hit for the silence)."""
    dur = item["frames"] / fps
    n = int(dur * SR)
    t = t_of(n)
    p = t / dur
    b = boom_core(rng, float(item.get("size", 2.5)), 41.2, 329.63, 1.0)
    rev = b[:n][::-1].copy()
    rev *= (0.35 + 0.65 * p ** 1.5)[:, None]
    f = 180 * 2 ** (3.6 * p ** 1.4)
    glide = np.sin(2 * np.pi * np.cumsum(f) / SR) * p ** 2.6 * 0.22 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * p ** 3 * 0.1
    glide = filt(glide, "lp", 4200)
    hiss = filt(noise(n, rng), "band", [600, 5200]) * p ** 3.2 * 0.16
    st = _mix(rev, np.stack([glide, np.roll(glide, 33)], 1), np.stack([hiss, np.roll(hiss, 71)], 1))
    st = verb(st, ir(1.6, 17), 0.2)[:n]
    k = int(0.03 * SR)
    st[-k:] *= (np.linspace(1, 0, k) ** 2)[:, None]
    return norm(st, 0.9), "end", n - k - 1


def sfx_revswell(item, rng, harmony, ir_, fps):
    dur = item["frames"] / fps
    n = int(dur * SR)
    t = t_of(n)
    p = t / dur
    x = filt(noise(n, rng), "hp", 600 + 3500 * p) * p ** 2.6
    x = filt(x, "lp", 9000)
    f = 300 * 2 ** (2.4 * p)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * p ** 3 * 0.16
    st = np.stack([x * 0.5 + tone, np.roll(x, 61) * 0.5 + tone], 1)
    k = int(0.03 * SR)
    st[-k:] *= (np.linspace(1, 0, k) ** 2)[:, None]
    return norm(st, 0.85), "end", n - k - 1


def sfx_shock(item, rng, harmony, ir_, fps):
    """the room changes: a soft low-mid rush that follows the ring's own speed, a warm sub thump on the ring's birth"""
    frames = float(item.get("frames", 30))
    dur = frames / fps + 0.5
    n = int(dur * SR)
    t = t_of(n)
    p = np.clip(t / (frames / fps), 0, 1.5)
    env = np.where(t < 0.02, t / 0.02, np.exp(-t / (0.32 * frames / 30)))
    x = filt(noise(n, rng), "lp", 350 + 1900 * env * float(item.get("bright", 0.6)))
    thump = np.sin(2 * np.pi * np.cumsum(58 + 50 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.35) * 0.9
    chord = np.zeros(n)
    for m in item.get("notes", [40, 47, 52]):
        chord += np.sin(2 * np.pi * hz(m) * t) * 0.18
    chord *= np.exp(-t / 0.9) * np.minimum(1, t / 0.03)
    y = x * env * 0.45 + thump + chord
    st = verb(np.stack([y, np.roll(y, 29)], 1), ir(2.2, 19), 0.3)[:n]
    return norm(_tail(st, 30), 0.85), "hit", 0


def sfx_ping(item, rng, harmony, ir_, fps):
    """a sonar ping in the key: a bell with two echoes that pan out"""
    midi = float(item.get("midi", 76))
    dec = float(item.get("decay", 1.4))
    n = int((dec * 3 + 1.2) * SR)
    y = bell(hz(midi), n, rng, decay=dec) * 0.7 + np.sin(2 * np.pi * hz(midi) * t_of(n)) * np.exp(-t_of(n) / 0.05) * 0.3
    L = y.copy()
    R = y.copy() * 0.0
    for k, (dt, g, pn) in enumerate(((0.19, 0.42, 1), (0.38, 0.22, -1), (0.57, 0.11, 1))):
        if item.get("echoes", 3) <= k:
            break
        i = int(dt * SR)
        (R if pn > 0 else L)[i:] += y[: n - i] * g
    st = verb(np.stack([L, R + 0.35 * y], 1), ir(2.6, 21), 0.35)[:n]
    return norm(_tail(st, 30), 0.85), "hit", 0


def sfx_tick_land(item, rng, harmony, ir_, fps):
    midi = float(item.get("midi", 88))
    n = int(0.5 * SR)
    y = bell(hz(midi), n, rng, decay=0.16) * 0.8 + filt(noise(n, rng), "band", [1800, 4200]) * np.exp(-t_of(n) / 0.003) * 0.16
    return norm(_tail(np.stack([y, y], 1), 10), 0.7), "hit", 0


def sfx_sand(item, rng, harmony, ir_, fps):
    """the sand jumping on the plate: grains of filtered noise whose density follows the picture's complexity"""
    dur = item["frames"] / fps
    n = int(dur * SR)
    d0, d1 = float(item.get("d0", 30)), float(item.get("d1", 300))
    dens = np.linspace(d0, d1, n) / SR
    hits = np.nonzero(rng.random(n) < dens)[0]
    y = np.zeros((n, 2))
    for i in hits:
        m = int(rng.uniform(0.0012, 0.004) * SR)
        if i + m >= n:
            continue
        fc = rng.uniform(1800, 5200)
        g = filt(noise(m, rng), "band", [fc, fc * 1.5]) * np.exp(-t_of(m) / (m / SR * 0.35)) * rng.uniform(0.3, 1.0)
        p = rng.uniform(-1, 1)
        y[i:i + m, 0] += g * (1 - p) / 2
        y[i:i + m, 1] += g * (1 + p) / 2
    y *= np.minimum(1, t_of(n) / 0.05)[:, None] * np.minimum(1, (dur - t_of(n)) / 0.08)[:, None]
    return norm(y, 0.6), "start", 0


def sfx_glide(item, rng, harmony, ir_, fps):
    """a chord that slides up (soft, in key): the line bending into a ring, or a word melting"""
    dur = item["frames"] / fps
    n = int(dur * SR) + int(0.4 * SR)
    t = t_of(n)
    p = np.clip(t / dur, 0, 1)
    semis = float(item.get("semis", 12))
    g = 2 ** (semis * (p ** 1.6 - 1) / 12)  # arrives on the chord tones at the end
    bar = int(item.get("bar", 0))
    notes = harmony.chord(bar, 3) + [harmony.chord(bar, 4)[0]]
    L = np.zeros(n)
    R = np.zeros(n)
    for j, m in enumerate(notes):
        f = hz(m) * g
        ph = np.cumsum(f) / SR
        v = np.sin(2 * np.pi * ph) + 0.28 * np.sin(4 * np.pi * ph) + 0.08 * np.sin(6 * np.pi * ph)
        (L if j % 2 else R).__iadd__(v * 0.8)
        (R if j % 2 else L).__iadd__(v * 0.3)
    env = np.minimum(1, t / (0.35 * dur + 0.05)) ** 1.5 * np.where(t < dur, 1, np.exp(-(t - dur) / 0.15))
    st = np.stack([filt(L, "lp", 2400) * env, filt(R, "lp", 2400) * env], 1) * 0.2
    st = verb(st, ir(2.4, 23), 0.3)[:n]
    return norm(_tail(st, 30), 0.8), "end", int(dur * SR)


def _drum(kind, rng):
    if kind == "kick":
        return kick(rng, 1.3)
    if kind == "kick_soft":
        return kick(rng, 0.5) * 0.8
    if kind == "snare":
        n = int(0.32 * SR)
        t = t_of(n)
        y = filt(noise(n, rng), "band", [1400, 7000]) * np.exp(-t / 0.09) * 0.7 + np.sin(2 * np.pi * (190 + 90 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.07) * 0.8
        return np.tanh(y * 1.4)
    if kind == "clap":
        n = int(0.32 * SR)
        x = filt(noise(n, rng), "band", [900, 3400])
        e = np.zeros(n)
        for k, dt in enumerate((0, 0.011, 0.023)):
            i = int(dt * SR)
            e[i:] += np.exp(-t_of(n - i) / (0.008 if k < 2 else 0.11)) * (0.7 if k < 2 else 1)
        return x * e * 0.6
    if kind == "tom":
        n = int(0.8 * SR)
        t = t_of(n)
        y = np.sin(2 * np.pi * np.cumsum(90 + 120 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.28) + filt(noise(n, rng), "lp", 900) * np.exp(-t / 0.03) * 0.5
        return np.tanh(y * 1.5)
    if kind == "taiko":
        n = int(1.3 * SR)
        t = t_of(n)
        y = np.sin(2 * np.pi * np.cumsum(58 + 90 * np.exp(-t / 0.06)) / SR) * np.exp(-t / 0.4) + filt(noise(n, rng), "lp", 700) * np.exp(-t / 0.05) * 0.5
        y += np.sin(2 * np.pi * 116 * t) * np.exp(-t / 0.2) * 0.3
        return np.tanh(y * 1.6)
    if kind == "hat":
        n = int(0.06 * SR)
        return filt(filt(noise(n, rng), "hp", 6500), "lp", 11000) * np.exp(-t_of(n) / 0.014) * 0.22
    raise SystemExit(f"unknown drum {kind}")


def sfx_drum(item, rng, harmony, ir_, fps):
    y = _drum(item.get("kind", "kick"), rng)
    st = verb(y, ir(1.8, 29), float(item.get("wet", 0.18)))
    return norm(_tail(st, 20), 0.9), "hit", 0


def sfx_bellrun(item, rng, harmony, ir_, fps):
    """a fast run of bells (the letters lighting up): notes is a list of midi, step is the gap in seconds"""
    notes = item["notes"]
    step = float(item.get("step", 4 / 60))
    n = int((len(notes) * step + 2.6) * SR)
    y = np.zeros(n)
    for k, m in enumerate(notes):
        i = int(k * step * SR)
        nn = n - i
        y[i:] += bell(hz(m), nn, rng, decay=1.2) * (0.5 + 0.04 * k)
    st = verb(np.stack([y, np.roll(y, 25)], 1), ir(3.0, 31), 0.4)[:n]
    return norm(_tail(st, 30), 0.85), "hit", 0


def sfx_stab_hit(item, rng, harmony, ir_, fps):
    notes = item.get("notes")
    if notes is None:
        bar = int(item.get("bar", 0))
        notes = harmony.chord(bar, 3) + [harmony.chord(bar, 4)[0]]
    y = _brass(notes, float(item.get("dur", 0.9)), rng) * 2.0
    st = verb(np.stack([y, y], 1), ir(2.0, 37), 0.3)
    return norm(_tail(st, 20), 0.85), "hit", 0


def sfx_sweep(item, rng, harmony, ir_, fps):
    """a soft rising sweep in two octaves of the chord (no noise above 3 kHz): the zoom-out and the ring closing"""
    dur = item["frames"] / fps
    n = int(dur * SR) + int(0.3 * SR)
    t = t_of(n)
    p = np.clip(t / dur, 0, 1)
    bar = int(item.get("bar", 0))
    base = harmony.chord(bar, 3)[0]
    f = hz(base) * 2 ** (float(item.get("oct", 2)) * p ** 1.5)
    tone = (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)) * p ** 1.8
    tone2 = np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * p ** 2.2 * 0.5
    air = filt(noise(n, rng), "lp", 300 + 2500 * p) * p ** 2 * 0.12
    env = np.where(t < dur, 1, np.exp(-(t - dur) / 0.08))
    y = (tone + tone2 + air) * env * 0.25
    st = verb(np.stack([y, np.roll(y, 37)], 1), ir(2.2, 41), 0.28)[:n]
    return norm(_tail(st, 30), 0.8), "end", int(dur * SR)


def sfx_lockclick(item, rng, harmony, ir_, fps):
    """the frame locks: a crystal click, a short bell and a soft sub"""
    n = int(1.6 * SR)
    t = t_of(n)
    y = filt(noise(n, rng), "band", [1600, 4800]) * np.exp(-t / 0.004) * 0.4
    y += bell(hz(item.get("midi", 88)), n, rng, decay=0.55) * 0.6
    y += np.sin(2 * np.pi * np.cumsum(52 + 40 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.3) * 0.8
    st = verb(np.stack([y, y], 1), ir(2.0, 43), 0.3)[:n]
    return norm(_tail(st, 30), 0.85), "hit", 0


def sfx_converge(item, rng, harmony, ir_, fps):
    """three voices a little out of tune (the three colour plates of a print out of register) that swell and pull into one pitch exactly
    at the end: the sound of registration. Aligned by its END."""
    dur = item["frames"] / fps
    n = int(dur * SR)
    t = t_of(n)
    p = t / dur
    bar = int(item.get("bar", 0))
    notes = harmony.chord(bar, 3)[:2] + [harmony.chord(bar, 4)[0]]
    st = np.zeros((n, 2))
    spread = (1 - p ** 1.6) * 0.75  # semitones apart, zero at the end
    for j, m in enumerate(notes):
        for k, det in enumerate((-1.0, 0.0, 1.0)):
            f = hz(m) * 2 ** ((det * spread) / 12)
            ph = np.cumsum(f) / SR
            v = (np.sin(2 * np.pi * ph) + 0.35 * np.sin(4 * np.pi * ph) + 0.12 * np.sin(6 * np.pi * ph))
            pan = (k - 1) * 0.7
            a_ = (pan + 1) * math.pi / 4
            st[:, 0] += v * math.cos(a_)
            st[:, 1] += v * math.sin(a_)
    env = p ** 1.8 * (1 - np.exp(-t / 0.05))
    st = np.stack([filt(st[:, 0], "lp", 2600), filt(st[:, 1], "lp", 2600)], 1) * env[:, None] * 0.09
    k = int(0.03 * SR)
    st[-k:] *= (np.linspace(1, 0, k) ** 2)[:, None]
    return norm(st, 0.8), "end", n - k - 1


EPIC = {
    "boom": sfx_boom, "tutti": sfx_tutti, "choir": sfx_choir, "rewind": sfx_rewind, "revswell": sfx_revswell, "shock": sfx_shock,
    "ping": sfx_ping, "tick_land": sfx_tick_land, "sand": sfx_sand, "glide": sfx_glide, "drum": sfx_drum, "bellrun": sfx_bellrun,
    "stab_hit": sfx_stab_hit, "sweep": sfx_sweep, "lockclick": sfx_lockclick, "converge": sfx_converge,
}
EPIC_ROLE = {
    "boom": "boom", "tutti": "boom", "choir": "success", "rewind": "riser", "revswell": "riser", "shock": "whoosh", "ping": "pop",
    "tick_land": "tick", "sand": "ambience", "glide": "whoosh", "drum": "impact_small", "bellrun": "success", "stab_hit": "impact_small",
    "sweep": "whoosh", "lockclick": "click", "converge": "riser",
}


# ── the music bed ────────────────────────────────────────────────────────────
def _wide_pad(notes, dur, rng, bright=1200, att=0.6):
    n = int(dur * SR)
    y = pad_chord(notes, dur, rng, bright)
    return y


def build_music_epic(score, harmony, rng, n_total, _ir):
    fps = score["fps"]
    out = np.zeros((n_total, 2))
    bus = np.zeros((n_total, 2))
    IRL = ir(3.4, 47, 5000)

    def add(x, f, g=1.0, pan=0.0, send=0.0):
        i = int(round(f / fps * SR))
        if i >= n_total or i + len(x) <= 0:
            return
        s = pan2(x, pan) if x.ndim == 1 else x
        j0 = max(0, -i)
        seg = s[j0: n_total - i]
        out[i + j0: i + j0 + len(seg)] += seg * g
        if send:
            bus[i + j0: i + j0 + len(seg)] += seg * g * send

    beat = 60.0 / score["bpm"] * fps  # frames per beat
    bar_f = beat * 4
    k_kick = kick(rng, 1.1)
    k_soft = kick(rng, 0.5)
    k_tai = _drum("taiko", rng)
    k_clap = _drum("clap", rng)
    for sec in score["epic"]:
        kit = sec["kit"]
        a, b = float(sec["from"]), float(sec["to"])
        g = float(sec.get("gain", 1.0))
        bar0 = int(a // bar_f)
        if kit == "drone":
            n = int((b - a) / fps * SR)
            t = t_of(n)
            lfo = 0.85 + 0.15 * np.sin(2 * np.pi * 0.35 * t)
            root = hz(28)  # E1
            # the hum: E1 for weight, but most of the energy at E2/E3/B3 (a laptop speaker plays nothing below 90 Hz)
            d = (np.sin(2 * np.pi * root * t) * 0.35 + np.sin(2 * np.pi * 2 * root * t) * 0.6 + np.sin(2 * np.pi * 3.003 * root * t) * 0.32
                 + np.sin(2 * np.pi * 4 * root * t) * 0.16 + np.sin(2 * np.pi * 6.01 * root * t) * 0.07) * lfo
            air = filt(noise(n, rng), "band", [150, 900]) * 0.05
            ramp = np.minimum(1, t / float(sec.get("fade_in", 1.2))) ** 2 * np.minimum(1, (n / SR - t) / float(sec.get("fade_out", 0.05)))
            y = (d + air) * ramp * 0.42
            add(np.stack([y, y], 1), a, g, send=0.2)
            continue
        f = a
        while f < b - 1e-6:
            bar = int(f // bar_f)
            bi = int(round((f - bar * bar_f) / beat))  # beat inside the bar
            root = harmony.chord(bar, 2)[0]
            span = min(b, (bar + 1) * bar_f) - f
            if bi == 0 or f == a:
                if kit in ("space", "heart", "groove", "build", "montage", "together", "finale", "outro"):
                    br = {"space": 950, "heart": 1100, "groove": 1500, "build": 1700, "montage": 1900, "together": 2400, "finale": 1700, "outro": 1100}[kit]
                    if kit in ("finale", "together", "outro"):
                        notes = harmony.chord(bar, 3) + [harmony.chord(bar, 4)[0], harmony.chord(bar, 4)[2]]
                        ch = choir_core(notes, span / fps + 0.8, 0.9 if kit != "together" else 0.4, rng, 0.4)
                        add(ch, f, g * {"finale": 0.5, "together": 0.62, "outro": 0.42}[kit], send=0.2)
                    else:
                        add(pad_chord(harmony.chord(bar, 3) + [harmony.chord(bar, 4)[0]], span / fps + 0.5, rng, br), f, g * 0.9, send=0.35)
                    nsub = int(span / fps * SR)
                    add(sine(hz(root - 12), nsub) * env_adsr(nsub, a=0.02, d=span / fps, s=0.85, r=0.06, curve=0.3) * 0.15, f, g)
            if kit == "space" and bi in (0, 2):
                add(k_tai, f, g * (0.7 if bi == 0 else 0.4), send=0.5)
            if kit in ("heart", "groove", "build", "montage", "together") and kit != "heart" or kit == "heart":
                if kit == "heart":
                    add(k_soft, f, g * 0.55)
                    notes = harmony.chord(bar, 5)
                    for q in range(2):
                        add(pluck(notes[(bi * 2 + q) % 3], rng, 0.3, 0.6), f + q * beat / 2, g * 0.34, pan=0.4 * math.sin(f + q), send=0.45)
                    if bi % 2 == 1:
                        add(k_clap, f, g * 0.3, send=0.2)
                elif kit in ("groove", "montage", "together"):
                    add(k_kick, f, g * 0.95)
                    if bi % 2 == 1:
                        add(k_clap, f, g * (0.7 if kit != "montage" else 0.85), send=0.2)
                    for q in range(4):
                        h = _drum("hat", rng)
                        add(h, f + q * beat / 4, g * (0.5 if q % 2 else 0.35), pan=0.3 * (-1) ** q)
                    add(_bass(root, beat / fps * 0.45, rng), f + beat / 2, g * 0.9)
                    if bi % 2 == 0:
                        add(_bass(root, beat / fps * 0.25, rng), f, g * 0.5)
                    notes = harmony.chord(bar, 5)
                    for q in range(4):
                        add(pluck(notes[(bi * 4 + q) % 3], rng, 0.26, 0.7), f + q * beat / 4, g * 0.3, pan=0.5 * math.sin(f + q), send=0.5)
                    if kit in ("montage", "together") and bi in (0, 2):
                        add(_stab_notes(harmony.chord(bar, 4), rng), f + beat / 2, g * 0.7, send=0.25)
                elif kit == "build":
                    add(k_kick, f, g * 0.9)
                    add(_bass(root, beat / fps * 0.45, rng), f + beat / 2, g * 0.8)
                    for q in range(4):
                        add(_drum("hat", rng), f + q * beat / 4, g * 0.35, pan=0.3 * (-1) ** q)
            if kit == "finale":
                if bi == 0 and int(round(f - a)) % int(bar_f) == 0:
                    add(k_tai, f, g * 0.55, send=0.5)
                notes = harmony.chord(bar, 5)
                for q in range(2):
                    add(pluck(notes[(bi * 2 + q + 1) % 3], rng, 0.5, 0.8), f + q * beat / 2, g * 0.22, pan=0.5 * math.sin(f * 0.3 + q), send=0.6)
            f += beat
    # silences before the drops
    gap = score.get("gap_ms", 90) / 1000
    for gf in score.get("gaps", []):
        i1 = int(gf / fps * SR)
        i0 = int(i1 - gap * SR)
        fade = int(0.006 * SR)
        if 0 < i0 < n_total:
            w = np.ones(n_total)
            w[i0:i1] = 0
            w[max(0, i0 - fade):i0] = np.linspace(1, 0, min(fade, i0))
            out *= w[:, None]
            bus *= w[:, None]
    from scipy.signal import fftconvolve
    wet = np.stack([fftconvolve(bus[:, c], IRL[:, c])[:n_total] for c in range(2)], 1)
    y = out + wet * 0.5
    return np.tanh(y * 1.1) / 1.1


def _bass(midi, dur, rng):
    n = int(dur * SR)
    f = hz(midi)
    x = saw(f, n) * 0.6 + sine(f / 2, n) * 0.7
    x = filt(x, "lp", 380 + 900 * np.exp(-t_of(n) / 0.06))
    return x * env_adsr(n, a=0.004, d=0.25, s=0.55, r=0.03) * 0.5


def _stab_notes(notes, rng):
    return stab(notes, rng, 0.22)
