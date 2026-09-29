# Review loop and delivery checks

Read after the first draft render and again before delivery. Judge the **encoded file**, never only source code or chosen stills. The scripts find suspects; you must look at the images they produce and decide.

## The loop

```
render draft (muted is fine)
  -> transition_review.py film.mp4 --plan transitions.json --out review/
  -> open review/overview.png and EVERY review/NN_*.png; write a verdict per boundary
  -> contact_sheet.py film.mp4 --every 12 --width 160  (whole film, muted, phone size)
  -> fix, re-render, re-run, re-verdict   (repeat until every boundary is good)
then sound:
  sfx_scan.py -> cue sheet (whoosh peaks from the measured motion events) -> build_mix.py
  render muted + mux WAV (build.mjs) -> sync_check.py -> verify_video.py
  -> final transition_review + contact sheet on the delivered file
```

`transitions.json` lists every boundary and any other important move, with a few frames of margin on both sides:

```json
[{"name": "merge-notes-to-card", "start": 268, "end": 318, "kind": "morph"},
 {"name": "flood-from-share", "start": 536, "end": 600, "kind": "seamless"},
 {"name": "hard cut on beat 4", "start": 780, "end": 790, "kind": "cut"}]
```

`kind`: morph, seamless, whip, zoom, cut, flash (cut/flash/whip allow one intended spike). Give a beat montage its own window with `kind: cut`; every half-beat cut in it will be listed as POP/COLORJUMP, which is expected: check instead that each cut lands on its beat and has its own hit. For every morph add the exact carrier frames, e.g. `"handoffs": [504, 540]`, so jumps on those frames are reported as HANDOFF-JUMP.

## Reading the flags

| Flag | Means | Usually |
|---|---|---|
| POP | one frame changes far more than its neighbours | a snap, a mismatched layer swap, an off-by-one Sequence, or a spliced curve. Always look. |
| STUTTER | a frame repeats while its neighbours move | "patah-patah": a hold key mid-travel, frame-rate mismatch, rounded positions |
| HITCH | speed collapses for 1 to 2 frames and resumes | chained eases passing through a key |
| FLASH | brightness spikes/dips and returns | an unintended white/black frame, a layer missing for a frame |
| BLANK | a nearly uniform frame | nothing on screen: a gap between two scenes |
| COLORJUMP | mean colour jumps in one frame | unmotivated hue switch, a scene appearing without a bridge |
| GHOST | a region loses detail while barely moving (2+ frames) | crossfade, double exposure, ghost text; also intended blur-fades and occlusion edges, so look |
| MUDDY | contrast and sharpness sag mid-window below both ends | a washed-out midpoint; carrier colour close to the background |
| SOFT | the settled frames after are less sharp than before | an upscaled raster, leftover blur (skipped when the new scene is simply plainer) |
| HANDOFF-JUMP | a small region jumps on a morph's exact first/last frame (needs `"handoffs"` in the plan) | frozen carrier content, a glow/shadow/decoration that differs between scene and carrier, idle motion still at speed, an element not carried that vanishes, an overlay hidden by the carrier's stacking. Confirm with a zoom at `at_px`: an unrelated element animating on the same frame (a caption letter rising) also triggers it. |
| TELEPORT | a small region changes in one frame only | an object jump; also legitimate glyph pops, typing, impacts: zoom in and decide |
| JERK | a small region goes from still (with a still neighbourhood) to full speed in one frame, or stops dead | a move without ease-in on something already visible, a violent curve, a staggered start; text entrances also trigger it |

Local flags report `at_px` (the video pixel where it happened). Zoom in on every one:

```
python scripts/contact_sheet.py film.mp4 --frames 537-543 --crop 1400,300,420,260 --width 420 --out review/zoom.png
```

The verdict line is `suspect` when POP/STUTTER/HITCH/FLASH/BLANK/COLORJUMP fire, `check` for GHOST/MUDDY/SOFT or a rough speed curve, `clean` otherwise. `clean` is not approval: still look at the sheet.

Also read `motion events ... start-end@peak`: every fast move with its fastest frame. Use those frames for whoosh peaks, and check that no move you did not intend appears there.

## What to look for on each sheet

1. Source, carrier and target never visible together; no element missing for a frame.
2. First and last frames of the carrier match the scenes on either side (compare start-1 with start, end-1 with end) **as zoomed crops of the objects inside**, not just the full frame: small things (dots, shadows, glows, badges) are where handoffs break.
2b. Anything that moved before the morph keeps moving smoothly through it; nothing freezes and then leaps.
3. The eye has one thing to follow at every frame; the carrier stays readable (contrast, size) at the midpoint.
4. Colours: identifiable carrier colour, no grey/brown midpoint, no sudden hue.
5. Text: no ghost text, no letter soup, no line re-wrapping, nothing clipped, captions clear of the moving edge.
6. Speed: the motion curve under the sheet rises and falls smoothly (one hump per gesture).
7. Interaction: target hit at the contact frame; the result absent before, visible right after.
8. After the move: the new scene settles and holds long enough to read; nothing stray at the edges.

Write per boundary: `name (frames): GOOD/WEAK/BROKEN. What you saw, which frames, cause, fix.` Re-verdict after the fix.

## Expected flags (say so in the verdict)

- A flood, iris or band wipe replaces the whole frame's colour in 4 to 8 frames: COLORJUMP on its middle frames is the design, not a glitch. Look for what matters instead: the edge's curve (no pop), text of the next scene entering only behind the edge, the carrier's colour matching the flood on its first frame.
- A push-through changes almost every pixel at the swap: one POP there is expected if the zoomed element's fill already equals the new background on the frame before the swap.
- A beat pulse (equalizer, dot pulse) raises a small local jump on the beat: give it a 2-frame attack so it is a pulse, not a one-frame POP.
- BLANK on the first frames of a film that opens on an empty frame before its seed appears.
- A zoom or dive: the whole frame moves, so GHOST, TELEPORT and JERK appear along its length (`kind: zoom`); judge the seam at the arrival by zoomed crops, and note that an intended camera shake on landing raises a HANDOFF-JUMP at the arrival frame.

## Creative check (against the benchmark)

On the whole-film sheet, answer in writing: What is the seed and where does it return? What does each chapter become? Are chapter changes on beats? Is the frame filled (statements 40 to 60 % of the width, objects big enough to read at phone size)? Does each chapter own a field colour? Is any word just sitting there instead of acting out its meaning? Compare one sheet side by side with a film from [reference films](reference-films.md): if yours looks emptier, smaller or slower, fix that before polishing.

## Whole-film review (muted)

On a contact sheet every 0.2 to 0.3 s at phone width: dead stretches (8+ nearly identical thumbnails), two focal events at once, unreadable captions at phone size, crowded frames, repetitive transitions, missing brand/logo, anything in platform UI zones (top 250 px and bottom 400 px on 9:16 social video).

## Sound checks

- `sync_check.py` on the delivered file: every cue within half a frame; no constant offset; investigate every `MASKED?`.
- `build_mix.py` report: music 8 to 10 LU under the mix (6 to 8 for a synthesized bed), no warnings about masked cues, true peak at or under -1.5 dBTP, limiting under 4 dB.
- Cue coverage: every event in the timeline that moves or changes state has a cue or a deliberate silence.
- Variation: no single sound used for more than about a third of the cues without pitch/take changes; build_mix warns about flams (the same take twice within 60 ms).
- Ending: the final visual hit is on the music's own ending or a designed fade, never a chop.

## Delivery

1. `verify_video.py film.mp4 --width W --height H --fps F --frames N --codec h264 --pixel-format yuv420p --require-audio` passes (exact frame count, audio as long as the video).
2. The transition verdict list (all GOOD), sync summary, loudness/true peak, cue and sound counts.
3. Asset manifest with source, licence and use for every external file; required credits placed off-screen (post description) unless the brief says otherwise.
4. State plainly what you measured versus what you could see or hear. If full playback with sound was not possible, call the film a draft for human review.
