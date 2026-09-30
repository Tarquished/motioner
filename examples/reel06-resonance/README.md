# Example: motioner. reel 06, "resonance" (30 s, 2560x1440, 60 fps, 120 BPM)

One shader draws the whole film. Everything is a distance field: a dot, a word, a box, the film's own waveform. A ring travels along the level sets of a shape, and every transition is a change of weights or of time, so nothing is cut and nothing is faded. **No 3D.**

A coral dot hums in the dark. At the first hit a shock wave turns the room to paper and rings run out of the dot, one per beat. Then time runs backwards: the rings rewind and land on the outline of the word SOUND, the seed becoming its full stop. A wave floods the room blue and SOUND melts, letter by letter, into MOTION. The camera falls into the counter of the O and comes out inside the film's **own soundtrack**: the real waveform of the mix, with a playhead on this very frame. It zooms out to the whole 30 seconds, and the line bends into a ring that opens like a lens onto a **plate of sand**: every note of the arpeggio is a different Chladni pattern. Then the plate goes out of register: three additive plates (coral, blue, yellow) slide into a **colour separation** that locks on the note. Out of it a window opens, and from there **the name is built out of the film itself**: each world you have seen (the hum, the rings, SOUND, MOTION, the waveform, the plate) is a window that shrinks on a beat into one letter of *motioner.*, the rectangle morphing into the glyph's own outline. The seed drops in as the full stop, the letters live (each keeps its world running and pings on its note), a click locks the name, and the sand of the plate is pulled onto the outline, fills, and leaves the clean wordmark with a last ping.

![whole film](review/film.png)

## Concept

- **Archetype**: distance field, "sound made visible" (a fifth one: seed journey, word as world, nested dive, cause chain, distance field). Seed: the coral dot. Bookend: hum in the dark, the dot returns as the period of the wordmark and pings.
- **Chapters** (one verb each, shown in the HUD): 01 HUM, 02 PING, 03 SOUND (rewind), 04 MOTION (melt), 05 FRAME (push-through, the film's waveform), 06 PLATE (sand), 07 TOGETHER (registration, recap: worlds shrink into the letters), 08 MOTIONER. (lock, sand writes the wordmark).
- **Becomes chain**: dot, shock ring, rings, rings rewound, SOUND, blue flood, MOTION, counter of the O, scope, whole-film waveform, ring, lens, plate of sand, colour separation, window, worlds shrunk into letters, the living name, lock, sand, motioner.
- **Sound as the picture's cause**: a hit every beat moves the field lines by one spacing; every note of the plate's arpeggio is its own nodal pattern; the waveform on screen is measured from the delivered mix.
- **Palette**: ink `#0F0E11`, paper `#EFEBE4`, coral `#FF5436`, blue `#2F3BF4`, yellow `#F6C445` (only in "together"). Archivo (extended, heavy), Instrument Serif italic, JetBrains Mono.

## How it is built (see `references/field-technique.md`)

- `scripts/atlas.py`: real Archivo outlines rendered at 4x, exact distance transform, an RG16F atlas (glyph distance, counter distance) and the word layouts.
- `src/shader.ts`, `src/frame.ts`, `src/engine.ts`: one WebGL2 pass; layers, slots, groups, pulses, field lines, rosette, all read from a float data texture; 12 sub-frames per frame for motion blur; grain and dither.
- `src/scenes.ts`: the film as a pure function of the fractional frame (worlds, transitions, montage, finale); `src/timeline.json`: every event frame, read by the picture, the score and the review plan.
- `scripts/make_score.py` writes the score from the same timeline (ring landings are computed with the picture's own time warp); `synth_epic.py` of the skill renders it; `analyze_audio.py` turns the mastered mix into the waveform the picture draws.
- `src/Film.tsx`: HUD (colour taken from what is under each element), the plate's live note readout, the tagline.

## Measured on the delivered file

verify PASS (2560x1440, 1800 frames, 60 fps, h264 yuv420p bt709, AAC, 30.0 s); **-14.0 LUFS, -1.51 dBTP** (limiting 0.15 dB at the biggest hits); 139 cues (108 different sounds); **77 verified by cross-correlation in the delivered file** (median 0.0 ms, worst 3.9 ms; every big hit and every letter drum lands on its own frame). The rest are diffuse sounds (rewinds, risers, floods, sand, glides), pings that ring into each other at 1 beat steps and a few late-ringing sounds that the correlation cannot separate (`LATE`/`MASKED?` lines in the sync check: those are ambiguous matches, not measured errors). Silence before every drop: 110 ms, entered with a 40 ms cosine fade, so nothing is cut. Transition review: the flags left are the intended ones (hits, floods, the registration colour steps, the pane shrinks that switch worlds, the click that locks the name).

## Review notes

- Expected flags: COLORJUMP/POP on the first hit and on the flood to blue, COLORJUMP at the fastest frame of the push-through, COLORJUMP/POP on the registration's colour steps and on every pane shrink (each pane switches world on a whole frame; all sub-frames of a frame belong to one shot), FLASH at the lock.
- Found and fixed while building: the coral disc of the plate popped into the ring at the frame it closed (it is now born at the seed and runs out to meet the ring); montage cuts and layer switches were blending two shots inside the shutter (a cut now belongs to one frame); the Chladni lines vanished (`dFdx` inside a loop with a dynamic bound returns zero on ANGLE, the gradient is now analytic); the shader took 30 s to compile (loops unrolled: bounds now come from the data texture); the first mix was 90 % sub-bass and out of phase (reverb on the sub: sends are high-passed, bass below 150 Hz is mono, the hum keeps most of its energy at 2x to 4x the root).
- Found and fixed after the first delivery (the client found three things weak): the collapse of "together" (an iris that shrank two words and a disc: replaced by a whirl that twists the layers and turns the coral room to dust), the wordmark simply appearing (replaced by the plate of sand, whose nodal lines are pulled onto the outline of the word), and "together" itself (words now orbit on counter-rotating rings, every layer is born out of dust on its beat, and it lasts 1.5 s instead of 1).
- Found and fixed after the second delivery (client: the "together" section from 17 s to the end still weak, the 21 s to outro transition forced, some SFX cut off and unpleasant): the whole section was redesigned as the recap above (the whirl/dust/iris idea is gone, so is the forced blow-away into the outro); every abrupt drop in the mix was traced to its cue with `find_cuts.py` (float64): what was left are the intended silences before drops, now faded with a cosine; glitch and noise layers on the cuts were removed and the crash, ticks and hats softened. Research behind the design: `references/inspiration-recap-and-registration.md`.
- Audio was measured, not heard.

## Run

`npm install`, `python scripts/atlas.py` (writes `public/atlas.bin`), set `MOTIONER_SCRIPTS` to the skill's `scripts` folder, then `node scripts/build.mjs`: score, mix, waveform, render (about 15 minutes at 12 sub-frames on a modern GPU), mux, verification, sync check, transition review. Stills: `node scripts/stills.mjs 120 300 --scale 0.5`.
