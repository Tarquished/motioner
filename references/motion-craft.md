# Motion craft: smooth, alive, readable

Read before animating. Helpers are in `templates/remotion/motion.ts`.

## Curves by role

| Role | Curve | Notes |
|---|---|---|
| Something arrives, UI responds | `ease.out` (0.16, 1, 0.3, 1) | fast start, long settle; the default for entrances |
| Object travels A to B on screen, camera move | `ease.inOut` (0.65, 0, 0.35, 1) | symmetric; use `inOutSoft` for slow drifts |
| Morph carrier, shared element | `ease.snap` (0.45, 0, 0.15, 1) | eases out of rest over ~4 frames, decisive middle, gentle landing |
| Reveal growing from an element (flood, iris) | `ease.expand` (0.5, 0, 0.15, 1) | leaves the element gently, fills fast, lands soft |
| Whip-pan, zoom-through | `ease.whip` (0.77, 0, 0.175, 1) | violent middle, very slow ends |
| Exit that leaves the frame | `ease.in` | only when it really leaves; never for things that stay |
| Wind-up before a big move | `ease.anticip` or a small opposite move | 5 to 10 % of the distance, half a beat |
| Tactile feedback (tap, pop, reward) | `spring` damping 10 to 14, stiffness 170 to 260 | overshoot only on things that are hit or rewarded |

Never `linear` for visible motion except constant drifts, progress bars and rotation loops. Never `scale(0)` to `1` for UI: start at 0.6 to 0.85 with opacity.

## Velocity continuity (the cause of "choppy")

The eye sees acceleration changes, not positions. A move feels choppy when its speed jumps or drops to zero mid-flight.

- **Passing through a key**: if an object or camera passes a position without stopping, do not chain `tween(...)` calls (each segment eases to zero speed at the key). Use `smoothTrack` / `poseTrack` (monotone cubic through the keys); mark real stops with `hold: true`.
- **One curve per gesture.** Do not splice "fast part" and "slow part" with separate eases. Pick a single bezier with the shape you want.
- **Handoffs between two animations** (a carrier landing and the target starting its own idle) must match velocity: let the target's idle fade in over 10 to 20 frames instead of starting at full amplitude.
- **Don't round** transforms to integer pixels during motion; it quantises slow moves into steps. Use fractional values.
- **Frame rate**: 60 fps for UI-heavy product films (smooth scrolling and small moves); 30 fps doubles per-frame steps, so avoid very slow drifts there. Nested compositions must use the same fps.
- **Start from rest.** A visible object that begins to move needs an ease-in the eye can see: over a 30-frame, 700 px move, `ease.snap` (0.45, 0, 0.15, 1) goes 1.4, 4.5, 8.5, 14, 20 px/frame; the rejected (0.2, 0, 0, 1) went 8, 32, 70 px/frame, which reads as a teleport. Check any curve by listing its per-frame distance for the real move length.
- **Idle motion meets a handoff at zero speed.** A float or bob drawn with `sin` is at full speed when it crosses zero; shape it with `sin²` (zero speed at both ends) or fade its amplitude out before the object is picked up by a carrier or another move.
- **Pulses need an attack.** A beat-reactive element (equalizer, dot pulse, flash) that jumps to full height in one frame reads as a glitch; ramp it over 2 frames, then decay over 8 to 12.
- **Squash and stretch the seed.** Stretch along the travel from its velocity (`squashStretch`), squash on contact with the origin at the contact point (`landingSquash`), anticipate a launch by sinking for 6 to 8 frames. Show the path with an onion-skin (`EchoTrail`) or a dotted arc chart when the film is about motion.
- **Things that ride or react need physics, not a formula.** Letters glued to a scrolling sine wave with rotation copied from its slope look stiff. Simulate them (a deterministic per-frame step, memoised: gravity, contact, launch by the surface's velocity, landing squash, rotation with a spring that lags the target) and drive the surface by events (a plucked string with standing modes that decay at different rates; every impact is a pluck). Cause and effect is what reads as alive (`examples/reel03`, SOUND).
- **Keep animated content alive through moves.** Content inside a moving card keeps its own animation (render with the current frame); freezing it for the move makes it jump when it resumes.
- `transition_review.py` flags STUTTER (a repeated frame inside a move), HITCH (speed collapses for 1 to 2 frames), JERK (a still object at full speed in one frame) and TELEPORT/HANDOFF-JUMP (a small region jumps); its motion curve is your speed graph.

## Timing (60 fps; halve frames for 30 fps)

| Action | Frames |
|---|---|
| Button press in / out | 4 to 6 / 6 to 10 |
| Checkbox, toggle, chip pop | 10 to 16 |
| Card or panel entrance | 18 to 28 |
| Large shared-element morph | 30 to 40 |
| Flood, full-screen reveal | 40 to 50 |
| Camera push (subtle) | 60 to 150 |
| Stagger between siblings | 3 to 8 |
| Readable hold for a caption | 48 + 15 per word (0.8 s + 0.25 s/word) |
| Pointer travel to a target | 18 to 30, on a slight arc |

Snap cuts, morph landings and key taps to beats from `beat_grid.py`. A beat at 105 BPM is 34.3 frames at 60 fps; a bar is 137.1.

## Interaction: cause, then effect

For every tap/click: approach on an arc with ease-in-out, press-in 4 to 5 frames before contact (scale 0.8 to 0.9, the target also dips 2 to 4 %), contact frame = the frame the response begins, then a visible response on the target itself (fill, check drawing, ripple, state change), then the new state holds. The result must not exist before contact. Vary the response per element (check draws, button darkens and compresses, card lifts then expands); a ring on everything is monotone. Remove the pointer before a reveal covers it, and keep it under the reveal layer.

## Alive but readable

- Something always moves: idle float/rotation (1 to 2°, 4 to 6 px, seeded phases), slow camera drift (2 to 5 % over several seconds), background light drift.
- But while text is being read, the text itself holds still; motion lives around it.
- One focal event at a time. Two events on the same frame (a reward and the next tap) compete; stagger them by at least 8 to 12 frames.
- No dead stretches: if a thumbnail strip at 0.3 s spacing shows 8+ nearly identical frames, add a motivated event (a nudge, a notification, a camera beat) or cut the time.
- Secondary motion sells weight: squash on landing (3 to 5 %), follow-through on exits, shadows that tighten as objects land, numbers that roll like an odometer.

## Sharpness

- Close-ups: never scale a small raster up. Use `SharpZoom` (CSS `zoom` then scale down) for DOM layers, vector art for icons and logos, and render 2x (`--scale 2`, then downscale with Lanczos) for masters with heavy zooms.
- Motion blur only along the direction of travel and only while fast (`MotionBlur`, `blurFromSpeed`). A uniform `blur()` on a moving object reads as out of focus.
- Blur-fades on content (a few px) are fine inside a carrier's content swap; keep them short.
- Never grow text with a CSS `scale()` beyond about 1.2, and never on a layer with `will-change: transform` (the bitmap stays at its first size and is enlarged): re-lay the glyph at its real font size every frame (position = scale about the anchor, `fontSize = size * s`).
- Slow scaling of a group with text (end-card push-in, 1.00 to 1.04 over seconds) makes Chrome re-rasterise the glyphs at stepped sizes: the text shimmers on some frames. Put `will-change: transform` on that group.

## Text in motion

- Lock layout: a caption's line breaks and width must be final from its first frame. Animating weight/width axes or letter-by-letter reveals must not reflow the line (reserve final glyph widths).
- Measure text layout once, after fonts load (`document.fonts.load` + `delayRender`), with layout values (`offsetLeft`) not screen boxes.
- Captions 2 to 6 words, natural language, no em dashes or middle dots as separators unless the brand uses them.
