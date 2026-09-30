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


GAP = 90 / 1000 * fps  # 5.4 frames of silence before a drop
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

# ---- 8 MONTAGE: a hit per cut
cuts = TL["montage"]["cuts"]
chord_notes = [55, 59, 62, 64, 67, 71, 74, 76]
for i, c in enumerate(cuts):
    if i == 0:
        add("tutti", c, size=2.5, bar=bar_of(c), gain_db=-2, label="MONTAGE")
        continue
    quarter = i >= 8
    add("drum", c, kind="tom" if quarter else ("snare" if i % 2 else "kick"), gain_db=-3 if not quarter else -2, label="cut")
    add("stab_hit", c, notes=[chord_notes[(i + k) % 8] + 12 * (1 if k else 0) for k in range(3)], dur=0.5, gain_db=-4, label="cut stab")
    add("glitch", c, frames=8, gain_db=-8, label="cut glitch")

# ---- 9 EVERYTHING TOGETHER
tg = TL["montage"]["builds"]
add("choir", tg[0], bar=bar_of(tg[0]), dur=3.2, attack=0.4, gain_db=-6, label="choir in")
add("stab_hit", tg[1], bar=bar_of(tg[1]), dur=0.7, gain_db=-6, label="layer 2")
add("drum", tg[1], kind="snare", gain_db=-8, label="layer 2 snare")
add("bellrun", tg[2], notes=[64, 67, 71, 74, 76, 79, 83, 86], step=2 / 60, gain_db=-6, label="layer 3")
end_t = TL["montage"]["together"][1]
add("stab_hit", tg[4], bar=bar_of(tg[4]), dur=0.7, gain_db=-5, label="layer 5")
add("drum", tg[4], kind="snare", gain_db=-8, label="layer 5 snare")
add("stab_hit", tg[5], bar=bar_of(tg[5]), dur=0.7, gain_db=-4, label="layer 6")
add("drum", tg[5], kind="tom", gain_db=-7, label="layer 6 tom")
for i, t in enumerate([end_t - d for d in (12, 9, 7, 5, 3.5, 2.4, 1.5, 0.8)]):
    add("drum", t, kind="snare", gain_db=-8 + 6 * i / 7, label="final roll")
add("tutti", end_t, size=3.6, bar=bar_of(end_t), gain_db=-0.5, label="EVERYTHING")
ir0, ir1 = TL["collapse"]["iris"]
add("rewind", ir1 - GAP, frames=(ir1 - GAP) - ir0, size=3.0, gain_db=-5, label="inhale")

# ---- 10 the seed alone, then the rewind onto the wordmark
fn = TL["finale"]
add("ping", ir1 + 4, midi=88, decay=1.0, echoes=1, gain_db=-16, label="the dot is back")
add("ping", fn["dotPing"], midi=76, decay=2.0, echoes=2, gain_db=-9, label="dot ping")
add("sand", ir1, frames=(fn["rewind"][1] - GAP) - ir1, d0=25, d1=900, gain_db=-21, label="sand gathers")
add("ping", fn["dotPing"] + 30, midi=79, decay=2.0, echoes=2, gain_db=-7, label="dot ping")
r0, lk = fn["rewind"]
add("rewind", lk - GAP, frames=(lk - GAP) - r0, size=3.6, gain_db=-3, label="rewind")
for f0, m in zip([x for x in TL["sand"]["steps"] if x >= 1452], (76, 79, 83, 88, 91)):
    add("tick_land", f0, midi=m, gain_db=-11, label="sand steps")
add("ping", TL["sand"]["steps"][2], midi=83, decay=1.6, echoes=2, gain_db=-9, label="plate note")
add("ping", TL["sand"]["steps"][0], midi=71, decay=1.6, echoes=2, gain_db=-10, label="plate note")

# ---- 11 the wordmark
add("tutti", lk, size=4.6, bar=bar_of(lk), gain_db=2, ring=ring_hz(12), label="motioner.")
add("shock", lk, frames=40, notes=[40, 47, 52, 59], bright=0.6, gain_db=-5, label="the room")
add("bellrun", lk, notes=[64, 67, 71, 74, 76, 79, 83, 88], step=4 / 60, gain_db=-8, label="letters")
add("ping", lk, midi=76, decay=3.0, echoes=3, gain_db=-8, label="ring")
for t, m in zip((1530, 1560, 1590), (79, 83, 88)):
    add("ping", t, midi=m, decay=1.3, echoes=2, gain_db=-9, label="echo")
for k, (t, d) in enumerate(zip((1566, 1578, 1590), (4, 6, 9))):
    add("pop", t, degree=d, octave=5, gain_db=-10, label="tagline")
add("boom", fn["lastPing"], size=0.9, ring=ring_hz(14), gain_db=-15, label="last ping")
add("ping", fn["lastPing"], midi=76, decay=3.6, echoes=3, gain_db=-7, label="last ping bell")

score = {
    "fps": fps, "frames": frames, "bpm": 120, "beat0_frame": 0, "key": "E", "scale": "minor", "seed": 6,
    "chords": CHORDS, "gap_ms": 90, "reverb_s": 2.2, "under_mix_lu": 16, "fade_out_ms": 1100, "master_fade_ms": 1300, "sfx_bus": {"ratio": 1.25, "below_peak_db": 6}, "master": {"lufs": -14, "true_peak_db": -1.2, "max_limiting_db": 6},
    "music_engine": "epic",
    "gaps": [120, lock, p0, TL["montage"]["from"], end_t, lk],
    "epic": [
        {"kit": "drone", "from": 6, "to": 120, "fade_in": 1.6, "fade_out": 0.04, "gain": 1.0},
        {"kit": "space", "from": 120, "to": 510, "gain": 0.95},
        {"kit": "heart", "from": 510, "to": 720, "gain": 0.9},
        {"kit": "groove", "from": 720, "to": 960, "gain": 0.9},
        {"kit": "build", "from": 960, "to": 1080, "gain": 0.9},
        {"kit": "montage", "from": 1080, "to": 1260, "gain": 0.9},
        {"kit": "together", "from": 1260, "to": end_t, "gain": 0.9},
        {"kit": "drone", "from": ir1, "to": lk, "fade_in": 1.0, "fade_out": 0.04, "gain": 0.9},
        {"kit": "finale", "from": lk, "to": 1680, "gain": 0.95},
        {"kit": "outro", "from": 1680, "to": 1800, "gain": 0.9},
    ],
    "sections": [],
    "sfx": sfx,
}
sys.path.insert(0, str(Path(__file__).resolve().parent))
Path("audio").mkdir(exist_ok=True)
Path("audio/score.json").write_text(json.dumps(score, indent=1))
print("audio/score.json", len(sfx), "sfx; ring landings", [round(x, 1) for x in land], "Z_END", round(Z_END, 1))
