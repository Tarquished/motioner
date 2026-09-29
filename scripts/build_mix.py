#!/usr/bin/env python3
"""Render a frame-based cue sheet into one mastered soundtrack (WAV), sample-accurately.

Why offline: placing <Audio> by file start in a video tool makes every sound with a quiet lead-in
late and every whoosh early. Here each cue is placed by the point that matters (attack on contact,
peak on the fastest frame, riser end on the reveal), the music is edited on bar lines and ducked
under important cues, and the result is mastered to a loudness target with true-peak control.
The picture then plays this single file (Remotion: <Audio src={staticFile('audio/mix.wav')} />,
or mux it with FFmpeg).

cue sheet (JSON):
{
  "fps": 60, "duration_frames": 900, "sample_rate": 48000,
  "master": {"lufs": -14, "true_peak_db": -1.5, "max_limiting_db": 4},
  "music": {"file": "music/track.mp3", "under_mix_lu": 9,
            "edits": [[0, 12.0], [480, 47.8]],        # [film_frame, song_seconds] pieces, cut on bar lines
            "xfade_ms": 30, "fade_in_ms": 20, "fade_out_ms": 1500, "end_frame": 900},
  "duck": {"attack_ms": 40, "hold_ms": 180, "release_ms": 500},
  "sounds": {"whoosh1": {"file": "sfx/whoosh.wav", "role": "whoosh", "gain_db": 0, "max_ms": 2500}},
  "cues": [
    {"frame": 118, "sound": "whoosh1", "align": "peak", "label": "card flies to detail"},
    {"frame": 131, "sound": "tap", "align": "hit", "gain_db": -2, "rate": 1.06, "pan": -0.2},
    {"frame": 300, "sound": "boom", "align": "peakcut", "duck_db": 9}
  ]
}
align: hit (attack at half peak lands on the frame; default for contacts), peak (loudest moment on
the frame; whooshes on the fastest frame), end (a riser's peak/resolution on the frame), start (file
start), peakcut (everything before the peak is cut so nothing sounds early; for booms with long
lead-ins). Per sound: role (sets default level and ducking), gain_db, trim_start_ms, max_ms,
fade_out_ms. Per cue: gain_db, rate (varispeed; also shifts pitch), pan -1..1, duck_db, max_ms,
fade_out_ms, label, sync (false = a diffuse sound such as a zoom sweep that has no sharp point to find;
sync_check skips it).

Outputs next to --out: the mix WAV, <name>.music.wav and <name>.sfx.wav stems, <name>.cues.json
(actual placement of every cue, used by sync_check.py), <name>.cues.md and <name>.timeline.png.
Levels are set by measurement, not by ear: listen to the stems and the mix whenever you can.

Usage: python build_mix.py cues.json --out public/audio/mix.wav [--root DIR]
"""

import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _media import load_audio  # noqa: E402

import numpy as np

try:
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    from scipy.signal import lfilter, resample_poly
except ImportError:  # pragma: no cover
    sys.exit("build_mix.py needs scipy and numpy: pip install numpy scipy")

SR = 48000
REF_LUFS = -12.0
# default level (dB against the loudness reference) and music ducking per role
ROLE_GAIN = {
    "boom": -3.0, "impact": -3.0, "impact_small": -5.0, "sub": -5.0, "riser": -7.0, "whoosh": -6.0,
    "swish": -8.0, "cam": -9.0, "click": -7.0, "tick": -8.0, "key": -9.0, "pop": -7.0, "ui": -7.0,
    "success": -8.0, "reward": -8.0, "coin": -9.0, "sparkle": -11.0, "paper": -5.0, "glitch": -7.0,
    "stamp": -4.0, "fanfare": -4.0, "ambience": -16.0, "other": -7.0,
}
ROLE_DUCK = {"boom": 9.0, "impact": 5.0, "impact_small": 3.0, "sub": 3.0, "whoosh": 3.0, "swish": 2.0,
             "riser": 2.0, "success": 3.0, "reward": 4.0, "fanfare": 6.0, "stamp": 3.0, "glitch": 2.0}


# ── loudness ─────────────────────────────────────────────────────────────────
def k_weight(x):
    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = math.tan(math.pi * f0 / SR)
    Vh, Vb = 10 ** (G / 20), 10 ** (G / 20) ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    b = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    x = lfilter(b, a, x, axis=0)
    f0, Q = 38.13547087602444, 0.5003270373238773
    K = math.tan(math.pi * f0 / SR)
    a = [1, 2 * (K * K - 1) / (1 + K / Q + K * K), (1 - K / Q + K * K) / (1 + K / Q + K * K)]
    return lfilter([1, -2, 1], a, x, axis=0)


def blocks(y, win, hop):
    n, h = int(win * SR), int(hop * SR)
    if len(y) < n:
        return np.array([np.mean(y ** 2, axis=0).sum()]) if len(y) else np.array([])
    c = np.cumsum(np.concatenate([np.zeros((1, y.shape[1])), y ** 2]), axis=0)
    starts = np.arange(0, len(y) - n + 1, h)
    return ((c[starts + n] - c[starts]) / n).sum(1)


def lufs(p):
    return -0.691 + 10 * np.log10(np.asarray(p) + 1e-12)


def integrated(x):
    mom = blocks(k_weight(x), 0.4, 0.1)
    g = mom[lufs(mom) > -70]
    if not len(g):
        return -70.0
    g = g[lufs(g) > lufs(g.mean()) - 10]
    return float(lufs(g.mean()))


def max_momentary_100ms(x):
    b = blocks(k_weight(x), 0.1, 0.02)
    return float(lufs(b.max())) if len(b) else -70.0


def true_peak(x):
    return float(np.max(np.abs(resample_poly(x, 4, 1, axis=0))))


# ── sound handling ───────────────────────────────────────────────────────────
def stereo(x):
    return np.stack([x, x], 1) if x.ndim == 1 else x[:, :2]


def env_of(x, ms=5):
    hop = max(1, int(SR * ms / 1000))
    return np.sqrt(np.maximum(0, uniform_filter1d((x ** 2).mean(1), hop)))


def trim_silence(x, lead_db=-45, tail_db=-55):
    e = env_of(x)
    pk = e.max() + 1e-12
    on = int(np.argmax(e > pk * 10 ** (lead_db / 20)))
    on = max(0, on - int(0.004 * SR))
    above = np.where(e > pk * 10 ** (tail_db / 20))[0]
    end = int(above[-1]) + int(0.03 * SR) if len(above) else len(x)
    return x[on:end].copy(), on


def fade_tail(x, ms):
    k = min(len(x), int(ms / 1000 * SR))
    if k > 0:
        x[-k:] *= (np.cos(np.linspace(0, np.pi / 2, k)) ** 2)[:, None]
    return x


def varispeed(x, rate):
    if abs(rate - 1) < 1e-6:
        return x
    n = int(len(x) / rate)
    t = np.arange(n) * rate
    return np.stack([np.interp(t, np.arange(len(x)), x[:, c]) for c in range(2)], 1)


def points(x):
    e = env_of(x)
    smooth = uniform_filter1d(e, int(0.015 * SR))
    peak = int(np.argmax(smooth))
    hit = int(np.argmax(e >= 0.5 * e.max()))
    return hit, peak


def place(buf, x, start):
    if start >= len(buf) or start + len(x) <= 0:
        return
    if start < 0:
        x, start = x[-start:], 0
    e = min(len(buf), start + len(x))
    buf[start:e] += x[: e - start]


# ── dynamics ─────────────────────────────────────────────────────────────────
def limiter(x, ceiling, look=0.004, release=0.06):
    need = np.minimum(1.0, ceiling / np.maximum(np.max(np.abs(x), axis=1), 1e-9))
    L = max(1, int(look * SR))
    g = minimum_filter1d(need, size=2 * L + 1)
    a = 1 - math.exp(-1 / (release * SR))
    out = np.empty_like(g)
    cur = 1.0
    # instant attack, exponential release; vectorised in chunks where no new reduction starts
    for i in range(len(g)):
        v = g[i]
        cur = v if v < cur else cur + (min(1.0, v) - cur) * a
        out[i] = cur
    out = uniform_filter1d(out, size=L)
    return x * out[:, None], out


def compress(x, thresh_db, ratio=3.0, attack=0.002, release=0.08):
    lvl = np.max(np.abs(x), axis=1)
    aa, ar = math.exp(-1 / (attack * SR)), math.exp(-1 / (release * SR))
    env = np.empty_like(lvl)
    cur = 0.0
    for i in range(len(lvl)):
        v = lvl[i]
        cur = aa * cur + (1 - aa) * v if v > cur else ar * cur + (1 - ar) * v
        env[i] = cur
    over = 20 * np.log10(np.maximum(env, 1e-9)) - thresh_db
    gr = np.where(over > 0, -over * (1 - 1 / ratio), 0.0)
    return x * (10 ** (gr / 20))[:, None], float(gr.min())


def master(mix, target, tp_max, max_lim_db=4.0):
    """Loudness to `target` with a look-ahead limiter whose ceiling keeps the 4x-oversampled true peak
    under `tp_max`. If that needs more than `max_lim_db` of gain reduction, the target is lowered
    instead: crushed transients (flat clicks and hits) are worse than a slightly quieter file, and
    platforms normalise loudness anyway. Returns (audio, max reduction dB, fraction > 1 dB, LUFS)."""
    def run(goal):
        ceil = 10 ** ((tp_max - 0.4) / 20)
        gain = 10 ** ((goal - integrated(mix)) / 20)
        y, gr = mix, np.ones(len(mix))
        for _ in range(10):
            y, gr = limiter(mix * gain, ceil)
            tp = true_peak(y)
            if tp > 10 ** (tp_max / 20):
                ceil *= 10 ** (tp_max / 20) / tp * 0.99
                continue
            err = goal - integrated(y)
            if abs(err) < 0.1:
                break
            gain *= 10 ** (err / 20)
        return y, gr, float(20 * np.log10(gr.min()))

    goal = target
    y, gr, worst = run(goal)
    if worst < -max_lim_db:
        lo, hi = target - 12.0, target  # bisection: loudest goal whose limiting stays within bounds
        best = None
        for _ in range(7):
            mid = (lo + hi) / 2
            ym, grm, wm = run(mid)
            if wm >= -max_lim_db:
                best, lo = (ym, grm, wm, mid), mid
            else:
                hi = mid
        if best is None:
            best = (*run(lo), lo)
        y, gr, worst, goal = best
    return y, worst, float(np.mean(gr < 10 ** (-1 / 20))), goal


def write_wav(path, y):
    from scipy.io import wavfile

    rng = np.random.default_rng(0)
    y = np.clip(y, -1, 1)
    d = (rng.random(y.shape) - rng.random(y.shape)) / 32768.0  # TPDF dither
    wavfile.write(str(path), SR, np.round((y + d) * 32767).astype(np.int16))


# ── music ────────────────────────────────────────────────────────────────────
def music_bed(spec, root, fps, n):
    src = stereo(load_audio(root / spec["file"]))
    edits = spec.get("edits") or [[0, float(spec.get("song_start_s", 0.0))]]
    end_frame = spec.get("end_frame")
    xf = spec.get("xfade_ms", 30) / 1000
    out = np.zeros((n, 2))
    for i, (f0, s0) in enumerate(edits):
        f1 = edits[i + 1][0] if i + 1 < len(edits) else (end_frame if end_frame is not None else n * fps / SR)
        t0, t1 = f0 / fps, f1 / fps
        pre = xf / 2 if i > 0 else 0.0
        post = xf / 2 if i < len(edits) - 1 else 0.0
        a = int(round((s0 - pre) * SR))
        L = int(round((t1 - t0 + pre + post) * SR))
        seg = np.zeros((L, 2))
        lo = max(0, a)
        piece = src[lo: max(lo, a + L)]
        seg[lo - a: lo - a + len(piece)] = piece[: L - (lo - a)]
        k = int(xf * SR)
        if i > 0 and k:
            seg[:k] *= np.sin(np.linspace(0, np.pi / 2, k))[:, None]
        if i < len(edits) - 1 and k:
            seg[-k:] *= np.cos(np.linspace(0, np.pi / 2, k))[:, None]
        place(out, seg, int(round((t0 - pre) * SR)))
    fi = int(spec.get("fade_in_ms", 15) / 1000 * SR)
    if fi:
        out[:fi] *= np.linspace(0, 1, fi)[:, None]
    stop = int(round((end_frame / fps) * SR)) if end_frame is not None else n
    fo = int(spec.get("fade_out_ms", 1200) / 1000 * SR)
    if fo:
        a = max(0, stop - fo)
        out[a:stop] *= (np.cos(np.linspace(0, np.pi / 2, stop - a)) ** 2)[:, None]
    out[stop:] = 0
    level = integrated(out)
    return out * 10 ** ((spec.get("bed_lufs", -26.0) - level) / 20) * 10 ** (spec.get("gain_db", 0) / 20)


def duck_env(cues, n, fps, spec):
    att, hold, rel = spec.get("attack_ms", 40) / 1000, spec.get("hold_ms", 180) / 1000, spec.get("release_ms", 500) / 1000
    step = 0.005
    m = int(n / SR / step) + 2
    g = np.zeros(m)
    for c in cues:
        d = c["duck_db"]
        if not d:
            continue
        t = c["event_s"]
        for k in range(int((att + hold + rel) / step) + 2):
            tt = t - att + k * step
            j = int(tt / step)
            if not 0 <= j < m:
                continue
            if tt < t:
                w = (tt - (t - att)) / att
            elif tt < t + hold:
                w = 1.0
            else:
                w = max(0.0, 1 - (tt - t - hold) / rel)
            g[j] = min(g[j], -d * w)
    lin = 10 ** (g / 20)
    return np.interp(np.arange(n) / SR, np.arange(m) * step, lin)


def draw_timeline(path, mix, music, cues, fps, n):
    from PIL import Image, ImageDraw, ImageFont

    W, H = 2000, 420
    img = Image.new("RGB", (W, H), (20, 20, 24))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 11)
    except OSError:
        font = ImageFont.load_default()
    X = lambda s: 30 + (W - 60) * s / (n / SR)  # noqa: E731
    cols = np.array_split(np.abs(mix).max(1), W - 60)
    colm = np.array_split(np.abs(music).max(1), W - 60)
    for k, (c, cm) in enumerate(zip(cols, colm)):
        v, vm = float(c.max()), float(cm.max())
        d.line([(30 + k, 150 - v * 110), (30 + k, 150 + v * 110)], fill=(90, 120, 170))
        d.line([(30 + k, 150 - vm * 110), (30 + k, 150 + vm * 110)], fill=(70, 70, 90))
    dur = n / SR
    for s in range(0, int(dur) + 1):
        d.line([(X(s), 262), (X(s), 270)], fill=(160, 160, 160))
        d.text((X(s) - 4, 272), f"{s}s", fill=(160, 160, 160), font=font)
    rows = [0] * 6
    for c in cues:
        x = X(c["event_s"])
        d.line([(x, 30), (x, 262)], fill=(255, 190, 60), width=1)
        r = min(range(6), key=lambda i: rows[i])
        rows[r] = x + 8 + 6 * len(c["label"][:28])
        d.text((x + 2, 290 + r * 20), f"{c['frame']:g} {c['label'][:28]}", fill=(255, 210, 120), font=font)
    d.text((30, 6), "mix (blue), music bed after ducking (grey), cue event frames (orange)", fill=(230, 230, 230), font=font)
    img.save(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cuesheet", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--root", type=Path, help="folder that file paths are relative to (default: cue sheet folder)")
    args = ap.parse_args()
    sheet = json.loads(args.cuesheet.read_text(encoding="utf-8"))
    root = args.root or args.cuesheet.resolve().parent
    fps = float(sheet["fps"])
    n = int(round(sheet["duration_frames"] / fps * SR))
    if sheet.get("sample_rate", SR) != SR:
        sys.exit("only 48000 Hz output is supported")

    lib = {}
    for name, spec in sheet.get("sounds", {}).items():
        x = stereo(load_audio(root / spec["file"]))
        if spec.get("trim_start_ms"):
            x = x[int(spec["trim_start_ms"] / 1000 * SR):]
        x, lead = trim_silence(x)
        if spec.get("max_ms") and len(x) > spec["max_ms"] / 1000 * SR:
            x = fade_tail(x[: int(spec["max_ms"] / 1000 * SR)].copy(), min(400, spec["max_ms"] * 0.3))
        if spec.get("fade_out_ms"):
            x = fade_tail(x, spec["fade_out_ms"])
        role = spec.get("role", "other")
        g = 10 ** ((REF_LUFS - max_momentary_100ms(x)) / 20)
        g = min(g, 10 ** (-4 / 20) / (np.max(np.abs(x)) + 1e-12))  # K-weighting under-reads sub-bass hits
        g *= 10 ** ((ROLE_GAIN.get(role, -7.0) + spec.get("gain_db", 0)) / 20)
        lib[name] = {"x": x * g, "role": role, "file": spec["file"], "lead_trimmed_ms": round(lead / SR * 1000, 1)}

    sfx = np.zeros((n, 2))
    placed, warnings = [], []
    for c in sheet["cues"]:
        s = lib.get(c["sound"])
        if s is None:
            sys.exit(f"cue at frame {c.get('frame')} uses unknown sound {c['sound']!r}")
        rate = float(c.get("rate", 1.0))
        x = varispeed(s["x"], rate).copy()
        if c.get("max_ms") and len(x) > c["max_ms"] / 1000 * SR:
            x = fade_tail(x[: int(c["max_ms"] / 1000 * SR)].copy(), min(300, c["max_ms"] * 0.3))
        if c.get("fade_out_ms"):
            x = fade_tail(x, c["fade_out_ms"])
        hit, peak = points(x)
        align = c.get("align", "peak" if s["role"] in ("whoosh", "swish", "cam") else "end" if s["role"] == "riser" else "hit")
        if align == "peakcut":
            cut = max(0, peak - int(0.015 * SR))
            x = x[cut:].copy()
            k = int(0.004 * SR)
            x[:k] *= np.linspace(0, 1, k)[:, None]
            offset = peak - cut
        else:
            offset = {"hit": hit, "peak": peak, "end": peak, "start": 0}[align]
        pan = float(c.get("pan", 0.0))
        x *= 10 ** (c.get("gain_db", 0) / 20) * np.array([min(1, 1 - pan), min(1, 1 + pan)])
        event_s = c["frame"] / fps
        start = int(round(event_s * SR)) - offset
        if start < 0:
            warnings.append(f"frame {c['frame']} {c['sound']}: starts {-start / SR * 1000:.0f} ms before the film; its head is cut")
        if event_s * SR > n:
            warnings.append(f"frame {c['frame']} {c['sound']}: after the end of the film")
        place(sfx, x, start)
        placed.append({
            "frame": c["frame"], "event_s": round(event_s, 5), "sound": c["sound"], "file": s["file"], "role": s["role"],
            "align": align, "align_offset_ms": round(offset / SR * 1000, 1), "start_sample": int(start),
            "start_s": round(start / SR, 5), "rate": rate, "gain_db": c.get("gain_db", 0), "pan": pan,
            "length_ms": round(len(x) / SR * 1000, 1), "lead_trimmed_ms": s["lead_trimmed_ms"],
            "duck_db": float(c.get("duck_db", ROLE_DUCK.get(s["role"], 0.0))), "label": c.get("label", c["sound"]),
            "sync": bool(c.get("sync", True)),
            "_x": x,
        })
    placed.sort(key=lambda c: c["event_s"])
    for a, b in zip(placed, placed[1:]):
        if a["sound"] == b["sound"] and abs(a["event_s"] - b["event_s"]) < 0.06:
            warnings.append(f"frames {a['frame']} and {b['frame']}: the same sound twice within 60 ms (flams)")
    # density: how many cues sound at once
    for c in placed:
        together = [o for o in placed if abs(o["event_s"] - c["event_s"]) < 0.05]
        if len(together) > 4:
            warnings.append(f"frame {c['frame']}: {len(together)} cues within 50 ms; the hit will smear")
            break

    music = np.zeros((n, 2))
    if sheet.get("music"):
        music = music_bed(sheet["music"], root, fps, n)
        music *= duck_env(placed, n, fps, sheet.get("duck", {}))[:, None]
    pk = 20 * np.log10(np.max(np.abs(sfx)) + 1e-12)
    # light bus compression: only the tallest transients; balance comes from role levels, not squashing
    sfx_c, bus_gr = compress(sfx, pk - 9.0, ratio=2.5, attack=0.002) if np.any(sfx) else (sfx, 0.0)
    under = sheet.get("music", {}).get("under_mix_lu", 9.0) if sheet.get("music") else None
    if under is not None and np.any(music):
        # keep the bed a fixed distance under the finished mix (clients hear "music too loud" first)
        for _ in range(4):
            gap = integrated(music + sfx_c) - integrated(music)
            if abs(gap - under) < 0.2:
                break
            music *= 10 ** ((gap - under) / 20 * 0.9)
    mix = music + sfx_c
    m = sheet.get("master", {})
    y, max_gr, frac, goal = master(mix, m.get("lufs", -14.0), m.get("true_peak_db", -1.5), m.get("max_limiting_db", 4.0))
    if goal < m.get("lufs", -14.0) - 0.05:
        warnings.append(f"target lowered to {goal:.1f} LUFS to keep limiting under {m.get('max_limiting_db', 4.0)} dB "
                        "(the mix has tall transients over a quiet bed; that is fine, platforms normalise)")
    worst_at = None
    post = 10 ** ((integrated(y) - integrated(mix)) / 20) if integrated(mix) > -70 else 1.0

    out = args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    write_wav(out, y)
    stem = out.with_suffix("")
    write_wav(Path(str(stem) + ".music.wav"), music * post)
    write_wav(Path(str(stem) + ".sfx.wav"), sfx_c * post)

    # per-cue level against the music under it (loudest 100 ms)
    kw_m = k_weight(music * post)
    for c in placed:
        x = c.pop("_x") * post
        bx = blocks(k_weight(x), 0.1, 0.02)
        if not len(bx):
            c["over_music_db"] = None
            continue
        j = int(np.argmax(bx))
        s0 = min(max(0, c["start_sample"] + j * int(0.02 * SR)), max(0, n - int(0.1 * SR)))
        bm = blocks(kw_m[s0:s0 + int(0.1 * SR)], 0.1, 0.1)
        mus = float(lufs(bm.max())) if len(bm) and sheet.get("music") else -70.0
        c["sfx_lufs"] = round(float(lufs(bx.max())), 1)
        c["over_music_db"] = round(c["sfx_lufs"] - mus, 1)
        if sheet.get("music") and c["over_music_db"] < 2 and c["role"] not in ("ambience", "sparkle", "tick", "key"):
            warnings.append(f"frame {c['frame']} {c['sound']} ({c['label']}): only {c['over_music_db']} dB over the music, likely masked")

    report = {
        "fps": fps, "duration_frames": sheet["duration_frames"], "sample_rate": SR, "mix": str(out),
        "integrated_lufs": round(integrated(y), 2), "true_peak_dbtp": round(20 * math.log10(true_peak(y) + 1e-12), 2),
        "max_limiting_db": round(max_gr, 2), "limiting_over_1db_fraction": round(frac, 4),
        "music_lufs_in_mix": round(integrated(music * post), 1) if sheet.get("music") else None,
        "sfx_bus_compression_db": round(bus_gr, 1), "cue_count": len(placed),
        "distinct_sounds": len({c["sound"] for c in placed}), "warnings": warnings, "cues": placed,
    }
    Path(str(stem) + ".cues.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    lines = [f"# Cue list ({len(placed)} cues, {report['distinct_sounds']} sounds)", "",
             "| Frame | Time | Sound | Role | Align | Offset ms | Over music dB | Purpose |", "|---|---|---|---|---|---|---|---|"]
    for c in placed:
        lines.append(f"| {c['frame']:g} | {c['event_s']:.3f} | {c['sound']} | {c['role']} | {c['align']} | {c['align_offset_ms']} | "
                     f"{c.get('over_music_db')} | {c['label']} |")
    Path(str(stem) + ".cues.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    draw_timeline(Path(str(stem) + ".timeline.png"), y, music * post, placed, fps, n)

    print(f"{out}: {report['integrated_lufs']} LUFS, true peak {report['true_peak_dbtp']} dBTP, "
          f"max limiting {report['max_limiting_db']} dB ({100 * frac:.1f}% of samples > 1 dB)")
    if report["music_lufs_in_mix"] is not None:
        print(f"music bed in the mix: {report['music_lufs_in_mix']} LUFS ({report['integrated_lufs'] - report['music_lufs_in_mix']:+.1f} LU under the mix)")
    print(f"{len(placed)} cues from {report['distinct_sounds']} sounds; SFX bus compression {bus_gr:.1f} dB")
    roles = {}
    for c in placed:
        if c.get("over_music_db") is not None:
            roles.setdefault(c["role"], []).append(c["over_music_db"])
    for r, v in sorted(roles.items()):
        print(f"  {r:12s} n={len(v):3d}  over music: median {np.median(v):+5.1f} dB (min {min(v):+5.1f})")
    for w in warnings:
        print("WARNING " + w)
    return 0


if __name__ == "__main__":
    sys.exit(main())
