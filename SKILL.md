---
name: motioner
description: Direct, build and verify finished motion graphics and product videos (usually with Remotion) whose quality depends on smooth animation, seamless morph and shared-element transitions, and sound effects and music placed exactly on the frame. Use for product demos, feature tours, app promos, kinetic typography, logo reveals and branded social videos, and for fixing a film whose transitions glitch or whose SFX feel early, late or wrong. Not for static images or ordinary UI micro-interactions in a web app.
---

# Motioner

Make a film where every move is smooth, every scene handoff is one continuous object, and every sound lands on the frame it belongs to. Remotion is the default tool; the brief overrides every taste default here.

Three things decide whether the film is good. Spend the effort there:

1. **Smooth animation**: curves chosen by role, no velocity breaks, nothing frozen while the eye reads it. See [motion craft](references/motion-craft.md).
2. **Seamless morphs**: one carrier object crosses each boundary; the source, the carrier and the target are never visible at the same time. See [morph transitions](references/morph-transitions.md).
3. **Sound on the frame**: each cue placed by its attack or peak, not by the file start; music under the effects, cut on bar lines; sync proven in the delivered MP4. See [sound design](references/sound-design.md).

Everything else (story, type, imagery) supports those three. Nothing is finished until the encoded file has been measured and looked at.

## Workflow

### 1. Contract and research
- Record: audience, message, aspect ratio, size, fps, exact frame count, codec, audio rules (music, SFX, no voice unless asked), delivery path, read-only folders.
- Study the real product or brand before scripting. Use its real UI, labels, colours, fonts and logo; never invent an official-looking logo or claim. Staged states are fine if faithful and documented.
- When the user allows internet assets, research and download them without asking per file. Log source, creator, licence and use for every file. See [sound design](references/sound-design.md) and [asset sourcing](references/asset-sourcing.md).

### 2. Plan on one clock
- Pick the music first (or the tempo if there is none) and run `scripts/beat_grid.py` to get beats, bars, phrases and the song's real ending in frames. Put scene changes, morph landings and big hits on beats; land the final reveal on the song's own ending.
- Write a single timeline file (for example `src/timeline.json`) with every event frame: entrances, contacts, morph start/end, taps, reveals. Picture, cue sheet and review plan all read this file. Never type the same frame number in two places.
- For every scene boundary write one line: outgoing subject → **carrier** → incoming subject, the carrier's start/end rect and colour, the recipe (from the morph catalogue), frames, and the sound. For every tap/click: target, contact frame, state before, response, state after.

### 3. Build with the kit
- Copy `templates/remotion/*` into the project (`src/motioner/`): `motion.ts` (curves, smooth tracks, arcs, OKLab colour, fastest-frame finder), `Morph.tsx` (`handoff`, `MorphCarrier`, `PathMorph`, `LetterMorph`), `transitions.tsx` (`FloodReveal`, `ZoomThrough`, `WhipPan`, `MotionBlur`, `SharpZoom`), `build.mjs` (render + mux + verification pipeline). Read [Remotion setup](references/remotion-setup.md).
- Everything is a pure function of the frame. No CSS transitions, timers, `Math.random()`, or layout measured with `getBoundingClientRect` under a transform.
- Hold rendering until fonts are loaded; lock text layout so lines never reflow while animating.

### 4. Review every transition, then fix
Render a draft and run the review loop in [review checks](references/review-checks.md):
- `scripts/transition_review.py film.mp4 --plan transitions.json` → per-transition contact sheets plus automatic flags (POP, STUTTER, HITCH, FLASH, BLANK, COLORJUMP, GHOST, MUDDY, SOFT) and the measured fastest frame of every move.
- **Open every sheet and look.** Give each boundary a written verdict: good / weak / broken, with frame numbers and cause. Numbers find suspects; your eyes decide. Fix, re-render, re-review until every boundary is good. Do not ship a film because its best transition is good.
- `scripts/contact_sheet.py` for the whole film at phone size (muted review: dead stretches, clutter, unreadable text, two focal points at once).

### 5. Sound
- Screen candidates with `scripts/sfx_scan.py --role ...` (shape, lead-in, attack, peak, length vs move, noise). Reject wrong shapes before you place anything.
- Write the cue sheet from the timeline, taking whoosh peaks from the **measured** fastest frames. Render it with `scripts/build_mix.py`: sample-accurate placement by `hit`/`peak`/`end`/`peakcut`, music edit with crossfades on bar lines, ducking, music held about 9 LU under the mix, true-peak-safe mastering without crushed transients.
- Render the picture muted and mux the WAV with FFmpeg (`build.mjs` does it). Then run `scripts/sync_check.py film.mp4 mix.cues.json`: every cue must be within half a frame in the delivered file.

### 6. Deliver
- `scripts/verify_video.py` (size, fps, exact frames, codec, yuv420p, audio length).
- Report: the file, the transition verdicts (with the fixes made), the cue count and sync result, loudness and true peak, the asset manifest, and what you could only measure. If you cannot hear audio, say so; offer short audio previews for the user to judge.

## Hard rules (each one comes from a real failure)
- A morph is one carrier. Hide the source on the carrier's first frame, show the target on its last frame, draw nothing else of either in between. An element that travels on its own carrier must be removed from its container's content.
- Stagger carriers with `delay` inside one start/end window; shifting a carrier's start leaves the element undrawn for those frames.
- Swap content inside a carrier sequentially (out, then in). Never cross-dissolve two texts or two UIs in one place.
- Mix colours in OKLab and keep the carrier separated from the background (lift, shadow) while it passes through in-between tones; a pale midpoint on a pale background reads as a washed-out frame.
- One continuous easing curve per move. Two eased segments spliced together (a "punch" then a "creep") pop and then stall.
- Only let letters travel between two words when they share a run of 3+ letters; otherwise roll the text (out, then in).
- Incoming text or UI appears only after a reveal's edge has passed its position; two scenes' text must never meet at the rim.
- Place every sound by its alignment point: attack on contact, whoosh peak on the fastest frame, riser end on the reveal, booms with long lead-ins cut to start on the hit. Never by file start.
- Layers are stacked by render order; do not give overlays a global `zIndex` that lifts them above a later reveal.
- The music bed sits under the effects; clients notice "music too loud" first. Effects must not be masked (build_mix warns under +2 dB).
- Do not let the renderer encode audio for delivery; mux the mastered WAV with FFmpeg and prove sync in the final file.
- Deliver `yuv420p` with a bt709 colour space, not full-range `yuvj420p`.

For open-ended branded work, [direction profile](references/direction-profile.md) gives taste defaults and the list of things clients have rejected. [Typography](references/typography.md) covers font choice and text motion.
