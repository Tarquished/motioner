"""Write audio/score.json (synth_score.py input) from the same timeline the picture uses.
Whoosh peaks sit on the fastest frames measured by transition_review.py on the draft."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / "src" / "timeline.json").read_text())
FPS = TL["fps"]


def rand(seed):
    x = math.sin(seed * 12.9898 + 78.233) * 43758.5453
    return x - math.floor(x)


def type_frames(text, start, cps=19, seed=1):
    out, f = [], start
    for i, ch in enumerate(text):
        out.append(round(f))
        f += (FPS / cps) * (0.7 + 0.6 * rand(seed * 100 + i)) * (1.3 if ch == " " else 1) * (2.2 if ch in ".,!?" else 1)
    return out


S = []
add = lambda **k: S.append(k)  # noqa: E731

# 01 seed: a pop when it appears, one note per bounce climbing the chord
add(type="pop", frame=TL["seed"]["appear"], degree=0, octave=5, gain_db=-4, label="dot appears")
for c, d in zip(TL["seed"]["contacts"], [0, 2, 4, 7]):
    add(type="pluck", frame=c, degree=d, octave=4, label=f"bounce {c}")
add(type="riser", frame=TL["seed"]["flood"][0] - 5, frames=40, label="riser into the drop")
add(type="impact", frame=TL["seed"]["flood"][0], label="flood: drop")
add(type="whoosh", frame=130, frames=22, gain_db=-4, label="flood edge")

# 02 idea: a thud per word, the shrink as a falling pop, the dot's travel
for w in TL["idea"]["words"][1:]:
    add(type="thud", frame=w + 6, label="word lands")
add(type="pop", frame=TL["idea"]["dotPop"], degree=4, octave=5, label="period pops")
add(type="swell", frame=TL["idea"]["shrink"][1], frames=18, gain_db=-8, label="SMALL shrinks")
add(type="whoosh", frame=239, frames=20, gain_db=-5, label="dot travels")

# 03 motion: paper iris, split ticks, four arrivals as an arpeggio
add(type="whoosh", frame=268, frames=24, gain_db=-4, label="paper iris + split")
for i in range(4):
    add(type="tick", frame=TL["motion"]["split"][0] + 6 + i * 4, pan=-0.3 + 0.2 * i, label="split")
    arrive = TL["motion"]["railStart"] + i * TL["motion"]["railStep"] + TL["motion"]["railDur"]
    add(type="pop", frame=arrive, degree=[0, 2, 4, 7][i], octave=5, pan=0.5, label=f"rail {i} arrives")
add(type="whoosh", frame=352, frames=16, gain_db=-7, label="converge")

# 04 shape: blue flood hit, the shape grows, a stab per morph
add(type="burst", frame=TL["shape"]["flood"][0], label="merge + blue flood")
add(type="whoosh", frame=369, frames=22, gain_db=-5, label="blue flood edge")
for m in TL["shape"]["morphs"]:
    add(type="stab", frame=m, octave=4, gain_db=-3, label="shape morph")
add(type="riser", frame=478, frames=30, gain_db=-4, label="zoom into square")
add(type="whoosh", frame=477, frames=20, label="zoom-through")

# 05 rhythm: each word drops on its beat
for d in TL["rhythm"]["drops"]:
    add(type="thud", frame=d, label="word drops")
add(type="pop", frame=TL["rhythm"]["dotPop"], degree=7, octave=5, label="coral period")
add(type="whoosh", frame=586, frames=24, gain_db=-3, label="band wipe + dot flight")

# 06 prompt: the pill opens, typing, click, burst, riser into the montage
add(type="swell", frame=TL["prompt"]["pill"][1], frames=16, gain_db=-2, label="pill opens")
text = "a dot that becomes a logo"
add(type="type", frames=type_frames(text, TL["prompt"]["type"]), gain_db=-2, label="typing")
add(type="click", frame=TL["prompt"]["press"], label="send")
add(type="burst", frame=TL["prompt"]["press"] + 2, gain_db=-3, label="send burst")
add(type="riser", frame=TL["montage"]["start"] - 5, frames=26, label="riser into montage")

# montage: a glitch on every other cut (the music's stabs cover the rest)
for k in range(TL["montage"]["count"]):
    f = TL["montage"]["start"] + k * TL["montage"]["step"]
    if k % 2 == 0:
        add(type="glitch", frame=f, frames=8, gain_db=2, label="cut")

# logo: the field closes into the dot, the word rises, the dot pulses
add(type="whoosh", frame=847, frames=14, gain_db=-3, label="iris closes")
add(type="impact", frame=TL["logo"]["close"][1], label="logo: dot lands")
add(type="sub", frame=TL["logo"]["close"][1], gain_db=-4, label="sub")
for i in range(4):
    add(type="tick", frame=TL["logo"]["rise"] + i * 4 + 6, gain_db=-6, pan=-0.4 + 0.1 * i, label="letter")
add(type="chime", frame=TL["logo"]["tagline"] + 4, label="tagline")
for p in TL["logo"]["pulses"]:
    add(type="pop", frame=p, degree=0, octave=6, gain_db=-8, label="dot pulse")

score = {
    "fps": FPS, "frames": TL["durationInFrames"], "bpm": TL["bpm"], "beat0_frame": 0,
    "key": "A", "scale": "minor", "chords": ["i", "VI", "III", "VII"], "seed": 11,
    "sections": [
        {"from": 0, "to": 4, "kit": "intro"},
        {"from": 4, "to": 16, "kit": "groove", "drop": True},
        {"from": 16, "to": 24, "kit": "lift"},
        {"from": 24, "to": 28, "kit": "montage", "drop": True},
        {"from": 28, "to": 33, "kit": "outro", "drop": True},
    ],
    "gap_ms": 90, "under_mix_lu": 7, "fade_out_ms": 450,
    "sfx": S,
}
(ROOT / "audio").mkdir(exist_ok=True)
(ROOT / "audio" / "score.json").write_text(json.dumps(score, indent=1))
print(f"{len(S)} sfx entries -> audio/score.json")
