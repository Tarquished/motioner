# Nested-world dive: one camera, no cuts

Read when the concept is "the film is one continuous zoom": every scene is a small window inside the previous scene, the camera dives into it, and the next scene fills the frame. Worked example: `examples/reel04-dive` (a word, a ridgeline of sound, a Bauhaus tile field, a particle galaxy, an isometric city, drops of ink, and the word again). Nothing is cut; the seams are impossible to see because the geometry is exact.

## The maths (all pure functions of the frame)

- Every world is authored on its own 1920x1080 frame, but its content must cover the **disc of radius RD = 1110 px around the frame centre** (half the diagonal plus a margin): during a dive the child world is visible through a round window and shows more than its frame.
- A world has a **window** (portal): a disc `{x, y, r}` in its own coordinates (the period of a wordmark, a sun, the centre tile, the core of a galaxy, a sphere, an ink drop). The next world is drawn inside that disc at scale `k = r / RD` with its frame centre at the window centre. The window may be a function of the frame (a bobbing sphere) and may **open** (`open` 0..1 scales the clip radius): the window of the ink world grows as the drops merge, the window of the word opens when the dot pops.
- Dive `i` zooms world `i` by `K = RD / r` about the fixed point `q = (p - centre/K) / (1 - 1/K)`; the log of the scale is linear in the eased progress `t`: `s = exp(t * ln K)`, screen = `(w - q) * s + q`. At `t = 1` the child world is at scale 1 and exactly fills the frame (its disc covers the corners), and the parent is no longer drawn.
- Camera progress `u(f)` (world index as a float): between arrivals the camera drifts 0.05 of a world (`ease.inOut`, so it never stops dead); during the dive (from `S_i` to the arrival `A_{i+1}`) it follows **one cubic bezier `(0.22, 0, 0.06, 1)`**: a soft 12-frame ease-in, peak speed in the first fifth (about 3.5x the average), 57 % of the zoom done at a quarter of the time and only 3 % in the last quarter. Fast while the target is still far, long clean settling into the arrival. Do not use a symmetric ease for a dive: with `ease.snap` (0.45, 0, 0.15, 1) the camera was still rushing at half time and the landing felt abrupt. Arrivals are 8 beats apart, dives start 6 beats after an arrival.
- Drawing: a recursive `drawTree(world, s, tx, ty, bbox)`: fill the background with the world's colour (a huge rect), draw its content under transform `screen = s * local + t`, then clip to the window disc in screen space and recurse into the child with `s * k`. Skip a world's content when its child's disc already covers the whole screen; skip children whose disc is under about 1 px; pass a level-of-detail (`s / 0.25`) and the visible bounding box so heavy worlds (thousands of particles, a metaball raster) only work on what is seen.
- Use a **canvas** (one `<canvas>`, drawn synchronously in `useLayoutEffect`), not DOM/SVG: it is crisp at any scale, handles thousands of primitives, clips to discs, and supports the motion blur below. Fonts: `ctx.font = "800 expanded 260px 'Archivo Variable'"` after the font gate; lay text out with fixed advance widths (fontTools) so the layout is pure.
- **Motion blur by temporal supersampling**: when the log-zoom rate is high, draw the whole scene at `n` sub-frames (1 + rate * 140, at most 9) across a 0.55-frame shutter and accumulate with alpha `1 / (k + 1)`. Radial zoom blur appears for free and it is physically right.
- The world's colours chain: each window's colour is the next world's background (coral sun, paper sun, blue disc, black core, paper sphere, black drop), so the first frame of every child inside its window matches the parent.

## Making it read

- **Callouts** on every window (a leader line and a chip with the next level and its magnification: `-> 02 TILES x16`) and a HUD readout of the running total magnification (`x48,600,000`): the viewer understands the mechanism in one glance.
- **Telegraph** every dive with two rings leaving the window 16 and 7 frames before the dive.
- No camera shake on the landing: the smooth settling is the point (a shake made the arrival feel jittery). The arrival is marked by sound (a soft impact and the chord) and by the callout, not by moving the camera.
- Give each world a different visual language (typography, line art, flat geometry, particles, isometric depth, organic ink) but the same four colours, so the dive feels like passing through different kinds of motion in one universe.
- Bookend: the last window opens onto the first world again (index N = a settled copy of world 0 plus the tagline); the film could loop.

## Sound for a dive (uses the picture's own numbers)

- `src/events.ts` exports the camera's log-zoom rate per frame of every dive (`scripts/export_events.mjs` bundles it with esbuild and writes `audio/events.json`; `build.mjs` runs it when `exportEvents` is set), and `make_score.py` passes that curve to `synth_score.py` as a `zoom` cue (with `bar` = the bar of the arrival): the arrival chord as pure tones (sine plus faint 2nd and 3rd harmonics, low-passed at 1.9 kHz) that glides up one octave following the zoom's own progress and settles onto the chord tones exactly when the zoom lands (parallel motion, so it is consonant all the way), with a faint air layer. Its amplitude is the smoothed zoom speed, so it swells with the rush, fades out before the move ends and hands over to the arrival chord. No sub and no drone. Mark it `sync: false` (a diffuse sound has no sharp point for `sync_check`).
- **Do not use a Shepard glissando for the zoom** (`style: "shepard"` still exists): the first version of reel 04 used one and the client found it uncomfortable. Measured: spectral centroid 6.8 kHz, 41 % of the energy above 4 kHz, a pitch sweeping through every note with no relation to the key. The soft version measures centroid 1.8 kHz, 2 % above 4 kHz.
- Arrival = 90 ms silence (a `drop` section), then a soft impact + sub + chord on the arrival frame. Rings before the dive = two rising pops. World events (tile turns, ring pulses, drops merging) are scored from the same JSON the picture reads.

## Pitfalls seen while building it

- The child world must fill the whole disc: an empty corner shows as a hole in the window. Author content for the RD disc, not for the frame.
- A window whose position or size changes must feed the camera (`q` is recomputed every frame from the current window), or the child lands off-centre at the arrival.
- Guard streak/trail effects against wrap-around (a particle reborn at the rim draws one long line across the frame).
- Metaballs: compute the field in screen space at half resolution and take the edge from the field gradient (`sd = (v - 1) / |grad v|`), otherwise the edge gets blurry when the drop is zoomed.
