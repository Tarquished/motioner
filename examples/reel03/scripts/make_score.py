"""Timeline -> audio/score.json for synth_score.py (reel 03: the word 'motioner')."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / "src" / "timeline.json").read_text())
FPS = TL["fps"]
# measured on the draft: frames where each TIMING letter and each keyframe diamond appears
TIMING_LETTERS = [252, 255, 258, 261, 263, 267]
DIAMONDS = [253, 261, 270]

S = []
add = lambda **k: S.append(k)  # noqa: E731

# 01 the word: particles spiral in, a scan line writes it solid
add(type="swell", frame=TL["intro"]["particles"][1], frames=80, gain_db=-8, label="particles gather")
add(type="whoosh", frame=56, frames=60, gain_db=-6, label="spiral")
add(type="riser", frame=TL["intro"]["wipe"][0], frames=50, gain_db=-4, label="riser into the word")
add(type="pluck", frame=TL["intro"]["wipe"][0], degree=0, octave=4, label="scan starts")
for i in range(3):
    add(type="tick", frame=TL["intro"]["wipe"][0] + 3 + i * 5, gain_db=-4, pan=-0.5 + 0.33 * i, label="scan letter")
add(type="pop", frame=TL["intro"]["wipe"][1] - 4, degree=4, octave=5, label="coral tittle")

# 02 timing: letters fall, the t grows, its bar becomes a timeline
add(type="impact", frame=TL["timing"]["drop"][0], label="drop: letters fall")
add(type="whoosh", frame=146, frames=36, gain_db=-5, label="t grows")
add(type="whoosh", frame=180, frames=22, gain_db=-4, bright=1.3, label="bar extends")
add(type="whoosh", frame=202, frames=20, gain_db=-5, label="bar becomes the field")
for k, f in enumerate(TIMING_LETTERS):
    add(type="pluck", frame=f, degree=[0, 2, 4, 5, 7, 9][k], octave=4, gain_db=-1, label="TIMING letter")
# the keyframe diamonds pop together with TIMING letters, so the letter plucks carry them

# 03 sound: the line becomes waves, SOUND rises and rides, the wave floods
add(type="whoosh", frame=312, frames=24, gain_db=-6, label="TIMING falls into the string")
add(type="thud", frame=314, gain_db=-2, label="first letter hits the string")
add(type="pluck", frame=324, degree=0, octave=3, gain_db=0, label="string twangs")
# SOUND is flung out of the string one letter at a time (popcorn), rising in pitch
for i in range(5):
    add(type="pop", frame=330 + i * 4, degree=[0, 2, 4, 5, 7][i], octave=5, gain_db=-1, pan=-0.4 + 0.2 * i, label="letter flung out")
# every kick plucks the string (low), the off-beats pluck it lightly
for f in [360, 390, 420, 450]:
    add(type="pluck", frame=f, degree=0, octave=3, gain_db=1, label="string pluck")
for f in [375, 405, 435]:
    add(type="pluck", frame=f, degree=4, octave=3, gain_db=-5, label="string off-beat")
add(type="riser", frame=TL["sound"]["flood"][1] - 5, frames=44, label="riser into the flood")
add(type="whoosh", frame=462, frames=40, gain_db=-3, label="wave floods")

# 04 idea: the o floats up as a lens and reads the sentence
add(type="impact", frame=480, gain_db=-3, label="drop: idea")
add(type="whoosh", frame=500, frames=30, gain_db=-7, label="bubble rises")
add(type="pop", frame=TL["idea"]["bubble"][1], degree=4, octave=5, label="lens settles")
for k, f in enumerate([524, 538, 552, 564, 580, 596, 614]):
    add(type="tick", frame=f, gain_db=-5, pan=-0.5 + k * 0.16, label="word read")
add(type="chime", frame=TL["idea"]["center"][1] - 4, label="idea found")
add(type="riser", frame=TL["idea"]["portal"][0], frames=24, gain_db=-5, label="into the portal")
add(type="whoosh", frame=658, frames=26, label="portal opens")

# 05 scenes: pull back to the wall, one word per beat, the playing column sweeps
add(type="whoosh", frame=700, frames=60, gain_db=-5, label="pull back")
for f in TL["scenes"]["words"]:
    add(type="thud", frame=f, label="word")
for s in range(0, 9):
    add(type="tick", frame=TL["scenes"]["seq"][0] + s * 15, gain_db=-8, pan=-0.6 + (s % 6) * 0.24, label="column plays")

# 06 the word again: scenes shrink to dots, fly in as particles, the word lands on beat 32
add(type="swell", frame=TL["outro"]["shrink"][1], frames=40, gain_db=-6, label="scenes shrink")
add(type="whoosh", frame=921, frames=50, gain_db=-4, label="particles fly")
add(type="riser", frame=TL["outro"]["wipe"][0] - 5, frames=60, gain_db=-4, label="riser into the word")
add(type="impact", frame=TL["outro"]["wipe"][0] + 2, label="the word lands")
add(type="pop", frame=TL["outro"]["wipe"][1] - 4, degree=7, octave=5, label="coral tittle")
add(type="chime", frame=TL["outro"]["tagline"] + 4, label="tagline")
for p in TL["outro"]["pulses"]:
    add(type="pop", frame=p, degree=0, octave=6, gain_db=-8, label="tittle pulse")

score = {
    "fps": FPS, "frames": TL["durationInFrames"], "bpm": TL["bpm"], "beat0_frame": 0,
    "key": "D", "scale": "minor", "chords": ["i", "VI", "III", "VII"], "seed": 23,
    "sections": [
        {"from": 0, "to": 4, "kit": "intro"},
        {"from": 4, "to": 10, "kit": "groove", "drop": True},
        {"from": 10, "to": 16, "kit": "lift"},
        {"from": 16, "to": 24, "kit": "groove", "drop": True},
        {"from": 24, "to": 28, "kit": "montage"},
        {"from": 28, "to": 32, "kit": "break"},
        {"from": 32, "to": 37, "kit": "outro", "drop": True},
    ],
    "gap_ms": 90, "under_mix_lu": 7, "fade_out_ms": 500,
    "sfx": S,
}
(ROOT / "audio").mkdir(exist_ok=True)
(ROOT / "audio" / "score.json").write_text(json.dumps(score, indent=1))
print(f"{len(S)} sfx entries -> audio/score.json")
