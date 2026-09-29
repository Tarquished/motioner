"""Timeline + camera events -> audio/score.json for synth_score.py (reel 04: the dive).
The zoom sounds follow the picture's own camera (audio/events.json is exported from src/camera.ts)."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / "src" / "timeline.json").read_text())
EV = json.loads((ROOT / "audio" / "events.json").read_text())
FPS = TL["fps"]
A, S = TL["A"], TL["S"]


def rand(seed):
    x = math.sin(seed * 127.1 + 311.7) * 43758.5453123
    return x - math.floor(x)


sfx = []
add = lambda **k: sfx.append(k)  # noqa: E731

# ── world 0: the word assembles (centre out), the dot opens the first window ──────────────
add(type="whoosh", frame=34, frames=44, gain_db=-6, bright=1.2, label="slices fly in")
for i in range(8):
    land = round(4 + abs(i - 3.5) * 5 + 4 * 1.4 + 14)
    add(type="tick", frame=land, bright=0.8 + 0.07 * i, gain_db=-3, pan=(i - 3.5) / 4.5, label=f"letter {i} locks")
add(type="riser", frame=TL["word"]["dot"] - 3, frames=48, gain_db=-8, label="riser into the dot")
add(type="pop", frame=TL["word"]["dot"], degree=4, octave=5, gain_db=-1, label="the dot opens")
add(type="thud", frame=TL["word"]["dot"], gain_db=-3, label="landing tremor")
add(type="chime", frame=TL["word"]["dot"] + 6, gain_db=-6, label="window ring")

# ── every dive: telegraph rings, the zoom, the arrival ─────────────────────────────────────────────
for i, d in enumerate(EV["dives"]):
    add(type="pop", frame=S[i] - 16, degree=0, octave=6, gain_db=1, label=f"ring {i} a")
    add(type="pop", frame=S[i] - 7, degree=4, octave=6, gain_db=1, label=f"ring {i} b")
    add(type="zoom", start=d["start"], speed=d["rate"], bar=A[i + 1] // 120, gain_db=-3, label=f"dive {i}")
    fa = A[i + 1]
    add(type="impact", frame=fa, gain_db=-1, label=f"arrival {i + 1}")
    add(type="sub", frame=fa, gain_db=-3, label=f"arrival {i + 1} sub")
    add(type="stab", frame=fa + 1, octave=4, gain_db=-4, label=f"arrival {i + 1} chord")
    add(type="click", frame=fa + 8, gain_db=-2, pan=0.4, label="callout appears")

# callout of the first world
add(type="click", frame=TL["word"]["dot"] + 14, gain_db=-2, pan=0.5, label="callout appears")

# ── world 1: ridge. the halo rings leave the sun on the beat ─────────────────────────────────────
for k, f in enumerate(range(A[1] + 30, S[1] - 8, 30)):
    add(type="pluck", frame=f, degree=[0, 2, 4, 2][k % 4], octave=6, gain_db=-1, pan=[-0.3, 0.3][k % 2], label="sun ring")

# ── world 2: tiles. every wave turns the rings of tiles; a pluck on the middle of each ring's turn ─
waves = [w for w in TL["tiles"]["waves"] if A[2] - 60 <= w <= S[2] + 90]
for n, F in enumerate(waves):
    order = [0, 2, 4, 7] if n % 2 == 0 else [7, 4, 2, 0]
    for m, d in enumerate([1, 3, 5, 7]):
        add(type="pluck", frame=round(F + 2.4 * d + 8), degree=order[m], octave=5, gain_db=-2, pan=-0.5 + 0.33 * m, label="tile ring")

# ── world 3: flow. a sonar ping leaves the core on every beat ─────────────────────────────────────
for k, F in enumerate(TL["flow"]["beats"]):
    if A[3] <= F <= S[3] + 40:
        add(type="pluck", frame=F, degree=[0, 4, 2, 7][k % 4], octave=5, gain_db=1, pan=[0.4, -0.4][k % 2], label="core ping")

# ── world 4: city. the ring that pushes the columns up is a low thud on the beat ────────────────
for k, F in enumerate(TL["city"]["beats"]):
    if A[4] - 30 <= F <= S[4] + 60 and all(abs(F - a) > 4 for a in A):
        add(type="thud", frame=F, gain_db=-3, label="city ring")
        add(type="pluck", frame=F, degree=[0, 4, 0, 5][k % 4], octave=3, gain_db=3, label="city ring tone")

# ── world 5: ink. every drop that is drawn in is a note; the pitch climbs with the merged ink ───────
merge = TL["ink"]["merge"]
for k, M in enumerate(merge):
    arrive = M + TL["ink"]["mergeDur"] - 6
    add(type="pop", frame=arrive, degree=k * 0.7 if False else k, octave=5, gain_db=0, pan=(rand(k * 3.3) - 0.5) * 1.2, label="drop merges")
    if k < 6:
        add(type="thud", frame=arrive, gain_db=-7, label="big drop lands")
    if k % 6 == 0:
        add(type="chime", frame=arrive + 4, gain_db=-3, sync=False, label="ripple")

# ── world 6: the word again; the tagline; the dot keeps time ─────────────────────────────────────
E = TL["end"]
add(type="chime", frame=E["tagline"] + 4, gain_db=-1, label="tagline")
for k in range(5):
    add(type="tick", frame=E["footer"] + 4 + k * 5, bright=1.0 + 0.05 * k, gain_db=-3, pan=-0.4 + 0.2 * k, label="footer")
for k, p in enumerate(E["pulses"]):
    add(type="pop", frame=p, degree=0 if k % 2 == 0 else 4, octave=6, gain_db=-3, label="dot pulse")

score = {
    "fps": FPS, "frames": TL["durationInFrames"], "bpm": TL["bpm"], "beat0_frame": 0,
    "key": "G", "scale": "dorian", "chords": ["i", "iv", "vii", "iii"], "seed": 41,
    "sections": [
        {"from": 0, "to": 8, "kit": "intro"},
        {"from": 8, "to": 16, "kit": "groove", "drop": True},
        {"from": 16, "to": 24, "kit": "lift", "drop": True},
        {"from": 24, "to": 32, "kit": "lift", "drop": True},
        {"from": 32, "to": 40, "kit": "montage", "drop": True},
        {"from": 40, "to": 48, "kit": "break", "drop": True},
        {"from": 48, "to": 56, "kit": "outro", "drop": True},
    ],
    "gap_ms": 90, "under_mix_lu": 7, "fade_out_ms": 900,
    "sfx": sfx,
}
(ROOT / "audio").mkdir(exist_ok=True)
(ROOT / "audio" / "score.json").write_text(json.dumps(score))
print(f"{len(sfx)} sfx entries -> audio/score.json")
