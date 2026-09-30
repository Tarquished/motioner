#!/usr/bin/env python3
"""audio/score.json for synth_score.py from src/timeline.json: every sound sits on the frame of the picture event that makes it
(the same numbers the picture reads), and the ring landings are computed with the picture's own time warp."""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / "src" / "timeline.json").read_text())
ATL = json.loads((ROOT / "src" / "atlas.json").read_text())
fps, frames = TL["fps"], TL["durationInFrames"]
sfx = []


def add(type_, frame=None, **kw):
    d = {"type": type_}
    if frame is not None:
        d["frame"] = round(float(frame), 3)
    d.update(kw)
    if type_ in ("rewind", "revswell", "shock", "sand", "glide", "sweep", "zoom", "choir"):
        d["sync"] = False  # diffuse sounds: no sharp point for cross-correlation
    sfx.append(d)


GAP = 110 / 1000 * fps  # a hole before every drop: everything fades in 40 ms, the rest is silence
CHORDS = ["i", "vi", "iii", "vii", "i", "vi", "iii", "vii", "i", "vi", "iii", "vii", "i", "vi", "i"]
ROOT_HZ = {"i": 329.63, "vi": 261.63, "iii": 392.0, "vii": 293.66}
def ring_hz(bar):
    return ROOT_HZ[CHORDS[bar]]
bar_of = lambda f: int(f // 120)

# ---- 1 HUM
add("ping", TL["hum"]["dot"], midi=88, decay=0.5, echoes=0, gain_db=-24, label="dot appears")
for t, m in zip(TL["hum"]["rings"], (76, 79, 83)):
    add("ping", t, midi=m, decay=0.8, echoes=1, gain_db=-24, label="hum ring")
add("revswell", start=TL["hum"]["riser"][0], frames=(120 - GAP) - TL["hum"]["riser"][0], gain_db=-9, label="riser", **{})
sfx[-1]["frame"] = round(120 - GAP, 3)
del sfx[-1]["start"]

# ---- 2 PING: the first hit
h = TL["ping"]["hit"]
add("boom", h, size=3.4, ring=ring_hz(1), gain_db=0, label="PING")
add("shock", h, frames=26, notes=[40, 47, 52], bright=0.6, gain_db=-7, label="front")
add("ping", h, midi=76, decay=2.2, echoes=3, gain_db=-8, label="ping bell")
for t, m in zip(TL["ping"]["pings"][1:], (79, 83, 88)):
    add("ping", t, midi=m, decay=1.5, echoes=2, gain_db=-9, label="ping")
    add("drum", t, kind="tom", gain_db=-13, label="ping tom")

# ---- 3 SOUND: the rewind
def hermite(u, p0, m0, p1, m1):
    u2, u3 = u * u, u * u * u
    return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1

a, lock = TL["sound"]["rewind"][0], TL["sound"]["lock"]
def rewind_time(f):
    if f <= a:
        return f
    return hermite((f - a) / (lock - a), a, lock - a, 112, (lock - a) * -3)
land = []
for tj in reversed(TL["ping"]["pings"]):  # the last ping lands first
    lo, hi = a, lock
    for _ in range(40):
        mid = (lo + hi) / 2
        if rewind_time(mid) > tj:
            lo = mid
        else:
            hi = mid
    land.append((lo + hi) / 2)
add("rewind", lock - GAP, frames=(lock - GAP) - a, size=2.6, gain_db=-4, label="rewind")
for f0, m in zip(land, (83, 88, 91, 95)):
    if f0 < lock - GAP - 1:
        add("tick_land", f0, midi=m, gain_db=-10, label="ring lands")
add("tutti", lock, size=2.8, bar=bar_of(lock), gain_db=-1, label="SOUND locks")
add("bellrun", lock, notes=[67, 71, 74, 79, 83], step=4 / 60, gain_db=-11, label="letters ring")
for t, m in zip((330, 360), (76, 79)):
    add("ping", t, midi=m, decay=1.2, echoes=2, gain_db=-15, label="echo")

# ---- 4 MOTION: flood, melt, wave through the letters
f0, f1 = TL["motion"]["flood"]
add("boom", f0, size=2.0, ring=ring_hz(3), gain_db=-3, label="flood")
add("shock", f0, frames=f1 - f0, notes=[38, 45, 50], bright=0.55, gain_db=-6, label="flood rush")
m0, m1 = TL["motion"]["melt"]
add("glide", m1, frames=m1 - m0, semis=7, bar=3, gain_db=-8, label="melt")
sfx[-1]["frame"] = round(m1, 3)
for i, m in enumerate((67, 71, 74, 76, 79, 83)):
    add("ping", TL["motion"]["lock"] + 3.2 * i, midi=m, decay=0.7, echoes=0, gain_db=-9, label="letter")
add("ping", TL["motion"]["echo"][1], midi=79, decay=1.2, echoes=2, gain_db=-14, label="echo")

# ---- 5 FRAME: the push-through
z0, z1 = TL["frame"]["zoom"]
Z_END = None
oc = ATL["chars"]["O"]["counter"]
sc = 0.8
Z_END = 1.6 * max(1280 / (oc["rx"] * sc), 720 / (oc["ry"] * sc)) / 1.045

def bez(x, x1=0.77, y1=0.0, x2=0.175, y2=1.0):
    lo, hi = 0.0, 1.0
    for _ in range(50):
        t = (lo + hi) / 2
        xt = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3
        if xt < x:
            lo = t
        else:
            hi = t
    t = (lo + hi) / 2
    return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3
lz = [math.log(Z_END) * bez(min(1, i / (z1 - z0))) for i in range(int(z1 - z0) + 1)]
speed = [max(0.0, lz[i + 1] - lz[i]) for i in range(len(lz) - 1)]
add("zoom", z0, start=z0, speed=speed, bar=4, style="glide", octaves_per_unit=6.0, gain_db=-7, label="push-through")
sfx[-1].pop("frame")
add("lockclick", z1, midi=88, gain_db=-4, label="frame locks")
add("drum", z1, kind="kick_soft", gain_db=-6, label="lock thump")

# ---- the scope: the zoom out and the ring closing
o0, o1 = TL["frame"]["out"]
b0, b1 = TL["frame"]["bend"]
add("sweep", o0, frames=o1 - o0, bar=5, oct=2, gain_db=-9, label="zoom out")
sfx[-1]["frame"] = round(o1, 3)
add("glide", b1 - GAP, frames=(b1 - GAP) - b0, semis=12, bar=5, gain_db=-7, label="bend")

# ---- 6 PLATE: the ring closes, the room turns coral, every note is a pattern
p0 = TL["ring"]["portal"][0]
add("tutti", p0, size=3.1, bar=bar_of(p0), gain_db=-0.5, label="PLATE")
add("shock", p0, frames=24, notes=[43, 50, 55], bright=0.5, gain_db=-6, label="portal")
add("bellrun", p0, notes=[55, 59, 62, 67, 71, 74, 79], step=3 / 60, gain_db=-10, label="run")
for k, (t, m) in enumerate(zip(TL["ring"]["notes"], (52, 55, 59, 64, 67, 71, 76, 79))):
    add("ping", t, midi=m, decay=1.6, echoes=2, gain_db=-7, label=f"note {m}")
add("boom", TL["plate"]["flood1"][0], size=1.5, ring=ring_hz(7), gain_db=-7, label="plate turns blue")
add("shock", TL["plate"]["flood1"][0], frames=32, notes=[38, 45, 50], bright=0.5, gain_db=-8, label="blue rush")
add("sand", TL["ring"]["portal"][1], frames=TL["build"]["from"] - TL["ring"]["portal"][1], d0=40, d1=700, gain_db=-24, label="sand")

# ---- 7 BUILD
bd0, bd1 = TL["build"]["from"], TL["build"]["to"]
add("boom", bd0, size=1.4, ring=ring_hz(8), gain_db=-8, label="build")
add("revswell", bd1 - GAP, frames=(bd1 - GAP) - bd0, gain_db=-5, label="riser")
steps = TL["build"]["steps"]
for i, t in enumerate(steps):
    if t >= bd1 - GAP:
        continue
    add("drum", t, kind="snare", gain_db=-10 + 9 * i / (len(steps) - 1), label="roll")
    if i % 3 == 0:
        add("drum", t, kind="tom", gain_db=-8 + 5 * i / (len(steps) - 1), label="roll tom")

# ---- 8 RECAP: the film rewinds; every chapter shrinks into a letter of the name
RC = TL["recap"]
OU = TL["outro"]
CHORD_MIDI = {"i": [64, 67, 71], "vi": [60, 64, 67], "iii": [67, 71, 74], "vii": [62, 66, 69]}  # triads of the bar's chord (E minor key)


def chord_pool(bar, lo=62, hi=91):
    """every tone of the bar's chord between lo and hi, ascending: the sounds of the name always sit in the harmony under them"""
    base = CHORD_MIDI[CHORDS[bar]]
    return sorted(m + 12 * o for m in base for o in range(-2, 4) if lo <= m + 12 * o <= hi)


def climb(bar, k, n=8, lo=64, hi=88):
    pool = chord_pool(bar, lo, hi)
    return pool[round(k * (len(pool) - 1) / (n - 1))]


add("converge", RC["from"] - GAP, frames=(RC["from"] - GAP) - 1004, gain_db=-10, label="registration")
add("boom", RC["from"], size=2.8, ring=ring_hz(9), gain_db=-1, label="the film rewinds")
add("ping", RC["from"], midi=76, decay=2.2, echoes=3, gain_db=-8, label="hum ping")
add("shock", RC["from"], frames=24, notes=[40, 47, 52], bright=0.5, gain_db=-9, label="rewind rush")
KINDS = ["kick", "snare", "kick", "tom", "kick"]
for k, S in enumerate(RC["S"]):
    F = S + RC["shrink"]
    bar = bar_of(F)
    note = climb(bar, k)
    if k <= 4:  # the first five letters carry a drum, a stab and a soft shrink sweep; the last three only ring (the sounds stopped fighting the bed)
        add("drum", S, kind=KINDS[k], gain_db=-7, label=f"chapter {k + 1} -> letter")
        low = [m for m in chord_pool(bar, 48, 66)][:3]
        add("stab_hit", S, notes=low, dur=0.4, gain_db=-12, label="stab")
        add("sweep", F, frames=RC["shrink"], bar=bar, oct=1, gain_db=-15, label="shrink")
    if k < 7:
        add("ping", F, midi=note, decay=1.4, echoes=2, gain_db=-8 if k < 5 else -5, label=f"letter {'motioner'[k]}")
d0, d1 = RC["drop"]
add("revswell", d1 - 0.5, frames=d1 - d0 - 0.5, gain_db=-14, label="the full stop falls")
add("ping", d1, midi=climb(bar_of(d1), 3, 8, 74, 88), decay=2.4, echoes=3, gain_db=-8, label="the full stop lands")
add("boom", d1, size=1.2, ring=ring_hz(11), gain_db=-12, label="the name is whole")

# ---- 9 the name lives, then sets
lv0, lk = RC["living"][0], RC["lock"]
add("choir", lv0 + 5, bar=bar_of(lv0), dur=3.4, attack=0.5, gain_db=-8, label="choir")
LIVING = [74, 78, 81, 86, 81, 78, 74, 69]  # D F# A D A F# D A: an arpeggio on the bar's own chord (D major)
for k, t in enumerate(RC["notes"][:7]):  # the eighth note gives way to the snare roll
    add("ping", t, midi=LIVING[k], decay=1.2, echoes=1, gain_db=-6, label=f"living {k}")
add("revswell", lk - GAP, frames=(lk - GAP) - 1380, gain_db=-8, label="riser")
for i, t in enumerate([1408, 1416, 1422, 1426, 1429, 1431.5, 1433.5, lk - GAP - 0.4]):
    add("drum", t, kind="snare", gain_db=-11 + 6 * i / 7, label="roll")
add("tutti", lk, size=4.6, bar=bar_of(lk), gain_db=2, ring=ring_hz(12), label="motioner.")
add("shock", lk, frames=40, notes=[40, 47, 52, 59], bright=0.6, gain_db=-5, label="the room")
add("bellrun", lk, notes=[64, 67, 71, 76, 79, 83, 88, 91], step=4 / 60, gain_db=-8, label="letters")
add("ping", lk, midi=76, decay=3.0, echoes=3, gain_db=-8, label="ring")

# ---- 10 OUTRO: the name falls into its full stop, the film begins again, the first ping is struck again and the rings write the name
dv0, dv1 = OU["dive"]
lzE = math.log(OU["zEnd"])
n_dive = int(dv1 - dv0) - 6  # the fall ends 6 frames early: the silence before the hum room
dive_speed = [max(0.0, lzE * (bez((i + 1) / (dv1 - dv0)) - bez(i / (dv1 - dv0)))) for i in range(n_dive)]
add("zoom", dv0, start=dv0, speed=dive_speed, bar=bar_of(dv0), style="glide", octaves_per_unit=4.0, gain_db=-8, label="the fall into the full stop")
sfx[-1].pop("frame")
add("revswell", dv1 - GAP, frames=(dv1 - GAP) - (dv0 + 8), gain_db=-7, label="the fall (weight)")
hm0, hit = OU["hum"][0], OU["hit"]
add("ping", hm0 + 2, midi=88, decay=0.5, echoes=0, gain_db=-24, label="dot returns")
for t, m in zip(OU["humRings"], (76, 79, 83)):
    add("ping", t, midi=m, decay=0.8, echoes=1, gain_db=-24, label="hum ring")
add("revswell", hit - GAP, frames=(hit - GAP) - (hm0 + 12), gain_db=-9, label="riser")
add("boom", hit, size=3.4, ring=ring_hz(bar_of(hit)), gain_db=0, label="PING again")
add("shock", hit, frames=26, notes=[40, 47, 52], bright=0.6, gain_db=-7, label="front")
add("ping", hit, midi=76, decay=2.2, echoes=3, gain_db=-8, label="ping bell")
for t, m in zip(OU["pings"][1:], (79, 83, 88)):
    add("ping", t, midi=m, decay=1.5, echoes=2, gain_db=-9, label="ping")
    add("drum", t, kind="tom", gain_db=-13, label="ping tom")
ra, olock = OU["rewind"][0], OU["lock"]
def ou_rewind_time(f):
    if f <= ra:
        return f
    return hermite((f - ra) / (olock - ra), ra, olock - ra, hit - 8, (olock - ra) * -3)
oland = []
for tj in reversed(OU["pings"]):
    lo, hi = ra, olock
    for _ in range(40):
        mid = (lo + hi) / 2
        if ou_rewind_time(mid) > tj:
            lo = mid
        else:
            hi = mid
    oland.append((lo + hi) / 2)
add("rewind", olock - GAP, frames=(olock - GAP) - ra, size=2.6, gain_db=-4, label="rewind onto the name")
for f0, m in zip(oland, (83, 88, 91, 95)):
    if f0 < olock - GAP - 1:
        add("tick_land", f0, midi=m, gain_db=-10, label="ring lands")
add("tutti", olock, size=4.0, bar=bar_of(olock), gain_db=0, ring=ring_hz(bar_of(olock)), label="motioner. (final)")
add("bellrun", olock, notes=[64, 67, 71, 76, 79, 83], step=4 / 60, gain_db=-10, label="letters ring")
add("choir", olock, bar=bar_of(olock), dur=2.4, attack=0.35, gain_db=-9, label="final choir")
add("ping", olock, midi=76, decay=3.4, echoes=3, gain_db=-8, label="final bell")
add("ping", OU["echo"][1], midi=83, decay=1.5, echoes=2, gain_db=-13, label="echo")
fn = TL["finale"]
for t, d in zip((1726, 1738, 1750), (4, 6, 9)):
    add("pop", t, degree=d, octave=5, gain_db=-11, label="tagline")
add("boom", fn["lastPing"], size=0.9, ring=ring_hz(bar_of(fn["lastPing"])), gain_db=-15, label="last ping")
add("ping", fn["lastPing"], midi=88, decay=3.6, echoes=3, gain_db=-8, label="last ping bell")

score = {
    "fps": fps, "frames": frames, "bpm": 120, "beat0_frame": 0, "key": "E", "scale": "minor", "seed": 6,
    "chords": CHORDS, "gap_ms": 110, "reverb_s": 2.2, "under_mix_lu": 16, "fade_out_ms": 1100, "master_fade_ms": 1300, "sfx_bus": {"ratio": 1.25, "below_peak_db": 6}, "master": {"lufs": -14, "true_peak_db": -1.2, "max_limiting_db": 6},
    "music_engine": "epic",
    "gaps": [120, lock, p0, RC["from"], lk, OU["dive"][1], OU["hit"], OU["lock"]],
    "epic": [
        {"kit": "drone", "from": 6, "to": 120, "fade_in": 1.6, "fade_out": 0.04, "gain": 1.0},
        {"kit": "space", "from": 120, "to": 510, "gain": 0.95},
        {"kit": "heart", "from": 510, "to": 720, "gain": 0.9},
        {"kit": "groove", "from": 720, "to": 960, "gain": 0.9},
        {"kit": "build", "from": 960, "to": 1080, "gain": 0.9},
        {"kit": "montage", "from": 1080, "to": 1245, "gain": 0.8},
        {"kit": "montage", "from": 1245, "to": RC["living"][0], "gain": 0.5},
        {"kit": "together", "from": RC["living"][0], "to": lk, "gain": 0.6},
        {"kit": "finale", "from": lk, "to": OU["dive"][1], "gain": 0.95},
        {"kit": "drone", "from": OU["hum"][0], "to": OU["hit"], "fade_in": 0.25, "fade_out": 0.04, "gain": 1.0},
        {"kit": "space", "from": OU["hit"], "to": OU["lock"], "gain": 0.9},
        {"kit": "outro", "from": OU["lock"], "to": 1800, "gain": 0.95},
    ],
    "sections": [],
    "sfx": sfx,
}
sys.path.insert(0, str(Path(__file__).resolve().parent))
Path("audio").mkdir(exist_ok=True)
Path("audio/score.json").write_text(json.dumps(score, indent=1))
print("audio/score.json", len(sfx), "sfx; ring landings", [round(x, 1) for x in land], "Z_END", round(Z_END, 1))
