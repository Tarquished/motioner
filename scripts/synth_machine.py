#!/usr/bin/env python3
"""Instruments for films whose sounds come from physical events (a cause chain): a mallet on a bead, a rolling ball that follows
its speed, dominoes that also play marimba notes, wooden slams, a button, steel balls that ring in chord tones, gears that tick,
a music-box comb, letters that thud and sing. Every function makes the sound for ONE event and returns (stereo, align, align_sample)
like the sfx_* functions of synth_score.py; synth_score.sfx_for calls them through MACHINE.

Design rules (they come from a rejected zoom sound): nothing bright and harsh. Transients are short but their energy sits in the
low-mid; ringing partials are tuned to the film's key; noise layers are low-passed; long tails go through the reverb.
Types: tock pin roll clack slam launch button wave zap pawl cradle paddle gear lever motor mbox letter period tap
"""
import math

import numpy as np

from synth_score import SR, env_adsr, filt, hz, noise, norm, sine, t_of, verb


def _st(y, pan=0.0):
    a = (max(-1.0, min(1.0, pan)) + 1) * math.pi / 4
    return np.stack([y * math.cos(a), y * math.sin(a)], 1) * math.sqrt(2)


def _modes(n, freqs, decays, gains=None, rng=None):
    t = t_of(n)
    y = np.zeros(n)
    for k, (f, d) in enumerate(zip(freqs, decays)):
        g = 1.0 if gains is None else gains[k]
        y += g * np.sin(2 * np.pi * f * t + (rng.random() * 6.28 if rng is not None else 0)) * np.exp(-t / d)
    return y


def _click(n, rng, lo, hi, tau):
    return filt(noise(n, rng), "band", [lo, hi]) * np.exp(-t_of(n) / tau)


def sfx_tock(item, rng, harmony, ir, fps):
    """a wooden mallet on a bead: a short woody knock, the body of a woodblock and a soft thump"""
    n = int(0.5 * SR)
    v = float(item.get("v", 1.0))
    y = _modes(n, [780, 1490, 2350], [0.05, 0.028, 0.014], [1, 0.5, 0.25], rng)
    y += 0.9 * sine(150 * np.exp(-t_of(n) / 0.3) + 90, n) * np.exp(-t_of(n) / 0.05)
    y += 0.5 * _click(n, rng, 1500, 4500, 0.002)
    y = filt(y, "lp", 5200)
    return norm(verb(y, ir, 0.16)[:n], 0.8 * min(1.0, 0.55 + v)), "hit", 0


def sfx_pin(item, rng, harmony, ir, fps):
    n = int(0.12 * SR)
    y = _click(n, rng, 2200, 6000, 0.003) * 0.6 + sine(2100, n) * np.exp(-t_of(n) / 0.012) * 0.5
    return norm(_st(y), 0.6), "hit", 0


def sfx_roll(item, rng, harmony, ir, fps):
    """a ball rolling: noise whose level and brightness follow the measured speed (units per frame) and whose texture repeats at the rotation rate"""
    sp = np.asarray(item["speed"], float)
    r = float(item.get("r", 0.6))
    n = int(len(sp) / fps * SR) + int(0.2 * SR)
    tf = np.arange(len(sp)) / fps
    t = t_of(n)
    v = np.interp(t, tf, sp, right=0.0)
    v = v / (v.max() or 1)
    x = noise(n, rng)
    body = filt(x, "lp", 700)
    top = filt(x, "band", [900, 2600])
    rot = np.cumsum(np.interp(t, tf, sp, right=0.0) * fps / (2 * math.pi * r)) / SR  # revolutions
    am = 1 + 0.45 * np.sin(2 * np.pi * rot)
    rumble = sine(48 + 70 * v, n) * 0.5
    y = (body * 0.8 + top * 0.35 * v + rumble) * (v ** 1.35) * am
    return norm(_st(y), 0.7), "start", 0


def sfx_clack(item, rng, harmony, ir, fps):
    """a domino touching the next one: a dry wood click plus a marimba note in the key (the row plays a scale)"""
    midi = float(item.get("midi", 67))
    size = float(item.get("size", 1.0))  # 1 small ... 4 big
    v = float(item.get("v", 0.5))
    n = int(0.9 * SR)
    t = t_of(n)
    f0 = hz(midi)
    note = np.sin(2 * np.pi * f0 * t) * np.exp(-t / (0.32 + 0.12 * (60 / max(midi, 40)))) + 0.42 * np.sin(2 * np.pi * 4.0 * f0 * t) * np.exp(-t / 0.06) + 0.1 * np.sin(2 * np.pi * 9.2 * f0 * t) * np.exp(-t / 0.02)
    note *= np.minimum(1, t / 0.0015)
    tok = _modes(n, [520 / size ** 0.5, 1150 / size ** 0.5], [0.022, 0.012], [1, 0.4], rng) * 0.6 + _click(n, rng, 1200, 4200, 0.0025) * 0.5
    y = filt(note * 0.75 + tok, "lp", 6500)
    g = 0.55 + 0.45 * min(1.0, v * 3)
    return norm(verb(y, ir, 0.14)[:n], 0.7 * g), "hit", 0


def sfx_slam(item, rng, harmony, ir, fps):
    """the giant domino lands on the see-saw: a heavy wooden slam"""
    n = int(1.4 * SR)
    t = t_of(n)
    y = sine(52 + 60 * np.exp(-t / 0.05), n) * np.exp(-t / 0.28) * 1.2
    y += _modes(n, [180, 340, 610], [0.14, 0.09, 0.05], [0.8, 0.5, 0.3], rng)
    y += filt(noise(n, rng), "lp", 1600) * np.exp(-t / 0.05) * 0.6 + _click(n, rng, 800, 3500, 0.004) * 0.6
    y = np.tanh(y * 1.1)
    return norm(verb(y, ir, 0.22)[:n], 0.9), "hit", 0


def sfx_launch(item, rng, harmony, ir, fps):
    """the see-saw slaps the stop bar and throws the ball: a metal-wood clack, a spring twang and a short lift"""
    n = int(1.2 * SR)
    t = t_of(n)
    y = _modes(n, [330, 720, 1650, 2900], [0.07, 0.05, 0.03, 0.015], [1, 0.6, 0.35, 0.2], rng)
    y += 0.5 * _click(n, rng, 900, 3800, 0.003)
    f = 240 + 260 * np.exp(-t / 0.05)
    y += 0.55 * sine(f, n) * np.exp(-t / 0.22) * (1 + 0.25 * sine(31, n))  # twang
    lift = filt(noise(n, rng), "lp", 900 + 2200 * np.minimum(1, t / 0.25)) * np.exp(-t / 0.28) * np.minimum(1, t / 0.03) * 0.35
    y = filt(y + lift, "lp", 5000)
    return norm(verb(y, ir, 0.2)[:n], 0.85), "hit", 0


def sfx_button(item, rng, harmony, ir, fps):
    """a big arcade button: click, thump and a short spring rattle"""
    n = int(0.9 * SR)
    t = t_of(n)
    y = _click(n, rng, 1100, 3600, 0.004) * 0.9
    y += sine(96 * np.exp(-t / 0.4) + 60, n) * np.exp(-t / 0.11) * 1.0
    i = int(0.042 * SR)
    y[i:] += (_click(n - i, rng, 700, 2600, 0.005) * 0.5 + sine(150, n - i) * np.exp(-t_of(n - i) / 0.05) * 0.4)
    ratt = filt(noise(n, rng), "band", [600, 1900]) * np.exp(-t / 0.09) * (0.6 + 0.4 * np.sin(2 * np.pi * 70 * t)) * 0.35
    y = filt(y + ratt, "lp", 4800)
    return norm(verb(y, ir, 0.15)[:n], 0.85), "hit", 0


def sfx_wave(item, rng, harmony, ir, fps):
    """the wave of light: a warm chord blooms on the press and shimmers outward; in the key, nothing harsh"""
    dur = float(item.get("dur", 3.2))
    n = int(dur * SR)
    t = t_of(n)
    chord = item.get("notes") or [43, 50, 55, 58, 62, 67, 74]
    y = np.zeros(n)
    for k, m in enumerate(chord):
        f = hz(m)
        att = np.minimum(1, t / 0.02)
        ten = np.exp(-t / (dur * (0.5 + 0.06 * k)))
        tr = 1 + 0.18 * np.sin(2 * np.pi * (2.2 + 0.7 * k) * t + k)
        y += (np.sin(2 * np.pi * f * t) + 0.22 * np.sin(2 * np.pi * 2 * f * t) + 0.07 * np.sin(2 * np.pi * 3 * f * t)) * att * ten * tr * (0.9 if m < 60 else 0.55)
    # soft outward shimmer: band noise that widens and fades
    sh = filt(noise(n, rng), "band", [1500, 5200]) * np.exp(-t / 0.7) * np.minimum(1, t / 0.05) * 0.06
    y = filt(y * 0.5 + sh, "lp", 5600)
    return norm(verb(_st(y), ir, 0.35)[:n], 0.85), "hit", 0


def sfx_zap(item, rng, harmony, ir, fps):
    """a pulse of light running along a cable: a soft rising chirp, `frames` long"""
    fr = int(item.get("frames", 6))
    dur = fr / fps
    n = int((dur + 0.18) * SR)
    t = t_of(n)
    p = np.minimum(1, t / dur)
    f = 700 + 2300 * p ** 1.6
    y = sine(f, n) * np.minimum(1, t / 0.004) * np.where(t < dur, 1, np.exp(-(t - dur) / 0.05)) * 0.5
    y += 0.25 * sine(f * 2, n) * np.exp(-t / 0.06)
    y = filt(y, "lp", 5200)
    return norm(_st(y), 0.55), "start", 0


def sfx_led(item, rng, harmony, ir, fps):
    n = int(0.6 * SR)
    t = t_of(n)
    y = (sine(1760, n) + 0.3 * sine(3520, n) * np.exp(-t / 0.05)) * np.exp(-t / 0.12) * np.minimum(1, t / 0.002)
    return norm(verb(y, ir, 0.25)[:n], 0.6), "hit", 0


def sfx_pawl(item, rng, harmony, ir, fps):
    n = int(0.5 * SR)
    y = _modes(n, [1180, 2050, 3300], [0.06, 0.035, 0.018], [1, 0.6, 0.3], rng) + 0.7 * sine(130, n) * np.exp(-t_of(n) / 0.04) + 0.4 * _click(n, rng, 1500, 5000, 0.002)
    return norm(verb(filt(y, "lp", 5500), ir, 0.14)[:n], 0.75), "hit", 0


def sfx_cradle(item, rng, harmony, ir, fps):
    """steel balls meeting: a soft tick and a chord ringing in the key (one partial per ball)"""
    v = float(item.get("v", 0.2))
    n = int(1.6 * SR)
    t = t_of(n)
    y = _modes(n, [2300, 3500, 5000], [0.05, 0.03, 0.02], [1, 0.6, 0.3], rng) * 0.35 + _click(n, rng, 1800, 5200, 0.0015) * 0.5
    for k, m in enumerate(item.get("notes", [67, 74, 79, 82, 86])):
        f = hz(m)
        y += 0.3 * (np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.05)) * np.exp(-t / (0.5 - 0.05 * k)) * np.minimum(1, t / 0.001)
    y = filt(y, "lp", 6500)
    return norm(verb(y, ir, 0.3)[:n], 0.75), "hit", 0


def sfx_paddle(item, rng, harmony, ir, fps):
    n = int(0.6 * SR)
    y = _modes(n, [410, 900, 1900], [0.09, 0.05, 0.03], [1, 0.6, 0.4], rng) + 0.5 * _click(n, rng, 900, 4000, 0.003) + 0.35 * sine(1320, n) * np.exp(-t_of(n) / 0.16)
    return norm(verb(filt(y, "lp", 5200), ir, 0.18)[:n], 0.8), "hit", 0


def sfx_gear(item, rng, harmony, ir, fps):
    """one tooth of a gear passing: a very small wooden tick, pitched by the gear"""
    tone = float(item.get("tone", 0))
    n = int(0.08 * SR)
    t = t_of(n)
    f = 520 * (2 ** tone) * (1 + 0.04 * rng.standard_normal())
    y = _click(n, rng, 1400, 4200, 0.0025) * 0.7 + sine(f, n) * np.exp(-t / 0.012) * 0.6
    return norm(_st(y), 0.5), "hit", 0


def sfx_lever(item, rng, harmony, ir, fps):
    n = int(0.6 * SR)
    y = _modes(n, [260, 590, 1400], [0.08, 0.05, 0.025], [1, 0.6, 0.3], rng) + 0.6 * _click(n, rng, 800, 3200, 0.004)
    return norm(verb(filt(y, "lp", 4500), ir, 0.15)[:n], 0.75), "hit", 0


def sfx_motor(item, rng, harmony, ir, fps):
    """a clockwork spring motor: a low hum that spins up and runs, with a faint gear-train whirr"""
    fr = int(item.get("frames", 400))
    dur = fr / fps
    n = int((dur + 0.3) * SR)
    t = t_of(n)
    up = np.minimum(1, (t / 0.37)) ** 1.5
    f = 82 * (0.6 + 0.4 * up)
    y = (sine(f, n) + 0.4 * sine(2 * f, n) + 0.15 * sine(3 * f, n)) * 0.6
    wh = filt(noise(n, rng), "band", [280, 900]) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * up * t)) * 0.4
    y = (y + wh) * up * np.where(t < dur, 1, np.exp(-(t - dur) / 0.08))
    return norm(_st(y), 0.5), "start", 0


def sfx_mbox(item, rng, harmony, ir, fps):
    """a music-box tooth: a pure tone with the inharmonic partials of a struck steel tongue, in the tune's key"""
    midi = float(item["midi"])
    f = hz(midi)
    n = int(2.4 * SR)
    t = t_of(n)
    dec = 0.9 + 0.5 * (72 / max(midi, 36))
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / dec)
    y += 0.24 * np.sin(2 * np.pi * 6.27 * f * t) * np.exp(-t / 0.09) + 0.07 * np.sin(2 * np.pi * 17.5 * f * t) * np.exp(-t / 0.03)
    if midi < 58:
        y += 0.7 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.7) + 0.4 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.4)
    y *= np.minimum(1, t / 0.001)
    y += _click(n, rng, 2200, 5200, 0.002) * 0.12
    y = filt(y, "lp", 6500)
    g = float(item.get("g", 1.0))
    return norm(verb(y, ir, 0.3)[:n], 0.75 * g), "hit", 0


def sfx_letter(item, rng, harmony, ir, fps):
    """a letter reaches upright: a soft wooden thud and one note of the closing chord"""
    midi = float(item.get("midi", 55))
    n = int(1.6 * SR)
    t = t_of(n)
    y = sine(105 + 40 * np.exp(-t / 0.03), n) * np.exp(-t / 0.13) * 0.9 + filt(noise(n, rng), "lp", 800) * np.exp(-t / 0.035) * 0.5
    f = hz(midi)
    y += 0.55 * (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t / 0.7) * np.minimum(1, t / 0.006)
    return norm(verb(filt(y, "lp", 4200), ir, 0.28)[:n], 0.8), "hit", 0


def sfx_period(item, rng, harmony, ir, fps):
    """the bead settles as the full stop: two tiny taps and a bell in the key"""
    n = int(2.4 * SR)
    t = t_of(n)
    y = _click(n, rng, 900, 3200, 0.003) * 0.5
    i = int(0.09 * SR)
    y[i:] += _click(n - i, rng, 900, 3200, 0.003) * 0.3
    for k, m in enumerate((67, 74, 79, 86)):
        f = hz(m)
        ii = int((0.05 + 0.07 * k) * SR)
        tt = t[: n - ii]
        y[ii:] += 0.45 * (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2.76 * f * tt) * np.exp(-tt / 0.1)) * np.exp(-tt / 0.9)
    return norm(verb(_st(y), ir, 0.4)[:n], 0.8), "hit", 0


def sfx_tap(item, rng, harmony, ir, fps):
    """a small hop or a ball settling"""
    n = int(0.15 * SR)
    y = _click(n, rng, 700, 3000, 0.004) * 0.6 + sine(210, n) * np.exp(-t_of(n) / 0.03) * 0.5
    return norm(_st(y), 0.5 * float(item.get("g", 1.0))), "hit", 0


MACHINE = {
    "tock": sfx_tock, "pin": sfx_pin, "roll": sfx_roll, "clack": sfx_clack, "slam": sfx_slam, "launch": sfx_launch, "button": sfx_button,
    "wave": sfx_wave, "zap": sfx_zap, "led": sfx_led, "pawl": sfx_pawl, "cradle": sfx_cradle, "paddle": sfx_paddle, "gear": sfx_gear,
    "lever": sfx_lever, "motor": sfx_motor, "mbox": sfx_mbox, "letter": sfx_letter, "period": sfx_period, "tap": sfx_tap,
}
MACHINE_ROLE = {
    "tock": "impact_small", "pin": "click", "roll": "swish", "clack": "pop", "slam": "impact", "launch": "impact_small", "button": "impact_small",
    "wave": "impact_small", "zap": "tick", "led": "ui", "pawl": "click", "cradle": "pop", "paddle": "click", "gear": "tick", "lever": "click",
    "motor": "ambience", "mbox": "pop", "letter": "impact_small", "period": "success", "tap": "tick",
}
