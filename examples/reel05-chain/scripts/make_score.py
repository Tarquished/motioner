#!/usr/bin/env python3
"""Turn audio/events.json (exported from the picture's own code) into audio/score.json for synth_score.py.
Every sound sits on the frame of the physical event that makes it."""
import json
import math
from pathlib import Path

E = json.loads(Path("audio/events.json").read_text())
fps, frames = E["fps"], E["frames"]
ev = E["events"]
sfx = []


def add(type_, frame=None, **kw):
    d = {"type": type_}
    if frame is not None:
        d["frame"] = round(float(frame), 3)
    d.update(kw)
    if type_ in ("roll", "wave", "zap", "motor", "gear", "whoosh", "zoom", "tap"):
        d["sync"] = False  # diffuse sounds (no sharp point for cross-correlation)
    sfx.append(d)


# chords: bar k (beat0 = frame 60, 120 frames per bar) -> chords[k % 4]; the tune starts on a bar line with Gm
CHORDS = ["iv", "vii", "iii", "i"]
DOM_H0 = 2.6
byk = {}
for e in ev:
    byk.setdefault(e["kind"], []).append(e)

f_button = E["fFlood"]

# 1 TICK
for e in byk["pin"]:
    add("pin", e["f"], gain_db=-6, label="pin")
for e in byk["swing"]:
    sp = e["speed"]
    add("whoosh", start=e["f"], speed=sp, bright=0.35, gain_db=-14, label="swing")
for e in byk["tock"]:
    add("tock", e["f"], v=e["v"] * 8, gain_db=1, label="tock")
add("sub", byk["tock"][0]["f"], gain_db=-16, label="tock sub")

# 2 ROLL (the two 'roll' events: the bead on the ramp, then the last bead on its rail)
rolls = byk["roll"]
add("roll", start=rolls[0]["f"], speed=rolls[0]["speed"], r=0.6, gain_db=-5, label="roll")

# 3 TOPPLE: every contact plays the next note of a G dorian run; the wood tok gets lower as the dominoes grow
DEG = lambda i: round(i * 0.72)
for e in byk["clack"]:
    i = e["i"]
    size = E["dominoH"][i] / DOM_H0
    add("clack", e["f"], degree_i=i, midi=None, size=round(size, 2), v=round(e["v"], 3), gain_db=-1 + 0.12 * i, label=f"clack {i}")

# 4 LAUNCH
for e in byk["slam"]:
    add("slam", e["f"], gain_db=0, label="slam")
for e in byk["launch"]:
    add("launch", e["f"], gain_db=-1, label="launch")
fl = byk["flight"][0]
sp = fl["speed"]
# the way up is a soft whoosh; the way down is a gliding chord that lands on the button
apex = byk["apex"][0]["f"]
k_up = int(apex - fl["f"])
add("whoosh", start=fl["f"], speed=sp[: k_up + 1], bright=0.4, gain_db=-11, label="lift")
down = sp[k_up:]
add("zoom", start=apex, speed=[s * 0.05 for s in down], bar=int((f_button - 60) // 120) + 0, style="glide", octaves_per_unit=6.0, gain_db=-8, label="fall")
for e in byk["button"]:
    add("button", e["f"], gain_db=0, label="button")
    add("impact", e["f"], gain_db=-2, label="drop")
    add("sub", e["f"], gain_db=-3, label="drop sub")
    add("wave", e["f"], gain_db=-4, label="light wave")
for e in byk["hop"]:
    add("tap", e["f"], g=0.6, gain_db=-8, label="hop")

# 5 PASS
for e in byk["led"]:
    add("led", e["f"], gain_db=-8, label="led")
for e in byk["pulse"]:
    add("zap", e["f"], frames=e["frames"], gain_db=-12, label="pulse")
for e in byk["pawl"]:
    add("pawl", e["f"], gain_db=-4, label="pawl")
NOTES = [67, 74, 79, 82, 86]
for e in [c for c in byk["cradle"] if c["f"] < 800]:  # the cradle keeps swinging off camera; only the first exchanges are heard
    add("cradle", e["f"], v=round(e["v"], 3), notes=NOTES, gain_db=-3 - 1.5 * min(3, byk["cradle"].index(e)), label="cradle")
for e in byk["paddle"]:
    add("paddle", e["f"], gain_db=-2, label="paddle")

# 6 TURN
for e in byk["gearticks"]:
    for k, t in enumerate(e["ticks"]):
        add("gear", t, tone=e["tone"], gain_db=-13 if e["tone"] == 0 else -17, label="tooth")
for e in byk["lever"]:
    add("lever", e["f"], gain_db=-3, label="lever")

# 7 PLAY: brake, motor, and the tune (every pin on the eighth-note grid)
for e in byk["brake"]:
    add("pawl", e["f"], gain_db=-8, label="brake")
for e in byk["motor"]:
    add("motor", e["f"], frames=e["frames"], gain_db=-8, label="motor")
for e in byk["mbox"]:
    add("mbox", e["f"], midi=e["midi"], gain_db=-2, label=f"note {e['midi']}")
for e in byk["mbox_last"]:
    add("mbox", e["f"], midi=43, g=1.0, gain_db=1, label="last tooth")
    add("zap", e["f"] + 2, frames=6, gain_db=-10, label="pulse")

# 8 RISE
L = E["letters"]
add("pawl", L["fGate"], gain_db=-4, label="gate")
add("roll", start=L["fStart"], speed=rolls[1]["speed"], r=1.4, gain_db=-5, label="bead roll")
LETTER_NOTES = [55, 62, 67, 70, 74, 77, 79, 81]
for i, e in enumerate(byk["letter"]):
    add("letter", e["f"], midi=LETTER_NOTES[i], gain_db=-3 + 0.4 * i, label=f"letter {e['ch']}")
for e in byk["letter_go"]:
    add("whoosh", frames=18, frame=e["f"] + 8, bright=0.3, gain_db=-17, label="rise")
for e in byk["period"]:
    add("period", e["f"], gain_db=-1, label="period")
    add("wave", e["f"] + 4, notes=[43, 50, 55, 62, 67, 70, 74, 79], dur=3.6, gain_db=-5, label="wordmark")
# the tagline
for k, f0 in enumerate((1621, 1631, 1641)):
    add("pop", f0, degree=[4, 6, 9][k], octave=5, gain_db=-14, label="tagline")
add("chime", 1655, gain_db=-8, label="end chime")

score = {
    "fps": fps, "frames": frames, "bpm": 120, "beat0_frame": 60, "key": "G", "scale": "dorian", "seed": 11,
    "chords": CHORDS, "gap_ms": 90, "reverb_s": 2.0, "under_mix_lu": 13, "fade_out_ms": 900,
    "sections": [
        {"from": 0, "to": 18, "kit": "drone"},
        {"from": 18, "to": 27, "kit": "groove", "drop": True},
        {"from": 27, "to": 47, "kit": "bed"},
        {"from": 47, "to": 52, "kit": "lift", "drop": True},
        {"from": 52, "to": 60, "kit": "outro", "drop": True},
    ],
    "sfx": sfx,
}
# clack notes: resolved here so that synth_score sees a plain midi number
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
ROOT_G3 = 55
DOR = [0, 2, 3, 5, 7, 9, 10]
def degree_midi(d, base=ROOT_G3):
    o, i = divmod(int(d), 7)
    return base + 12 * o + DOR[i]
for s in sfx:
    if s["type"] == "clack":
        s["midi"] = degree_midi(DEG(s.pop("degree_i")))
Path("audio").mkdir(exist_ok=True)
Path("audio/score.json").write_text(json.dumps(score, indent=1))
print("audio/score.json", len(sfx), "sfx")
