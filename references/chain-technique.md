# Cause chain in 3D: technique (from `examples/reel05-chain`)

A film where one thing physically triggers the next. It is the strongest way to show "sound on the frame", because every sound has a visible cause. Read `examples/reel05-chain` first.

## 1. Structure

- Split the machine into **links**. Each link is one file with: `f0` (the frame it is triggered by the previous link), `f1` (the frame it triggers the next), `events` (contacts the score will play), `build(scene)`, `pose(f)` (a pure function of the frame, evaluated at fractional frames for motion blur) and `focus(f)` (where the action is: the spot light and the callout follow it). A `chain.ts` creates the links in order, each one taking the previous link's contact frame and position.
- The hand-over is a real contact (a tap, a slam, a ring of light reaching a photocell, a pulse along a cable). Vary the kind: momentum, gravity, light, signal, spring. Two hits of the same kind in a row feel mechanical.
- Design **backwards from the beat grid**: choose the frames that matter (the tap on beat 2, the drop on beat 20, the melody on a bar line, the first letter on beat 48). Solve a free parameter of the link to land on them (pendulum length so the quarter period is exact, length of the floor run so the bead touches the first domino on the frame, flight time from the launch so the ball lands on the drop frame).
- Let the machine **grow** (bead 1.2 units, dominoes 2.6 to 10, gears 10, letters 6 tall on a bigger stage): the camera pulls back with it and the last scene feels like an arrival.
- The seed is the object that started the chain and finishes it (here the coral bead is the full stop of the wordmark).

## 2. Physics that reads as physical

Simulate, do not formula. All of it runs at module load (fixed sub-steps, no randomness), is cached as sampled tracks and read at any fractional frame.

- **Rolling ball on a track**: energy `v^2 = v0^2 + (10/7) g dh`, integrate arclength, rotate about `up x direction` by `ds/r` (a stripe on the bead makes the roll visible).
- **Pendulum**: RK4; quarter period by integration; elastic exchange for a cradle (swap angular velocities of touching balls, propagate within the instant).
- **Dominoes** (`sim/dominoes.ts`): a slab pivoting about its front-bottom edge, contact constraint `d(phi_i, phi_{i+1}) >= 0` between the top-front corner and the next back face, solved by sequential impulses with a small positional bias. Kinematic pushing (moving the next domino to satisfy the constraint) made the wave accelerate without limit; impulses give a steady wave whose period you can tune with the spacing ratio (period 7.5 frames at ratio 0.49 for 2.6-unit dominoes). Growing dominoes (x1.06 each) slow the wave from 10 to 14 frames per domino: an augmentation that reads as tension.
- **Launch**: prescribe the see-saw rotation (short ramp to constant speed, hard stop against a bar) and solve the ballistic launch so the ball lands on the target frame. Tip speed at release sets the ball speed.
- **Rise (letters)**: a damped second-order step response (zeta 0.5) from lying to upright: the overshoot is the life. Hinge about the back-bottom edge so the front face lies face-up.
- **Gears**: `theta_b = -(Na/Nb) theta_a + phase`, with the phase chosen so a tooth of A meets a gap of B on the line of centres. Ticks per tooth come from the angle curve.
- **Music box**: constant motor speed after a ramp; pins are placed by *time*: `phi0 = phi_release - theta_drum(t_note)`, so every note is on the grid whatever the ramp.

## 3. Rendering (`src/gfx.ts`, `src/world.ts`)

Three.js in one canvas, rendered by an accumulation loop, not one pass:

- Every frame is the average of N sub-frames (24 to 32) in linear half/full float. Per sub-frame (Halton sequence, the same pattern every frame so nothing flickers): time inside a 0.5-frame shutter (motion blur), sub-pixel offset (anti-aliasing, with 4x MSAA), the key light on a small disc (soft shadows), a shadow-casting sky light over the hemisphere (ambient occlusion), the camera on an aperture disc while the focus point stays fixed (depth of field, per-shot aperture).
- Final pass: bloom (3-level), Khronos PBR neutral tone map (keeps the palette), vignette, grain, dither.
- **A wave of light** (the drop): render each sub-frame twice, once in the dark look and once in the lit look, with every material writing `smoothstep(R, R - w, distance to the button)` into its alpha (`onBeforeCompile` on `opaque_fragment`); the mix pass composites by that alpha and adds a soft rim glow on `m (1 - m)`. Objects and shadows are correct on both sides of the ring. Do this only while the ring crosses the room.
- The dark studio: black clear colour, one spot light that follows `focus(f)` (glide the focus for 18 frames when the link changes, a jump in the pool is a POP), paper floor with a two-scale dot grid so camera moves have parallax cues.
- For the finale multiply the floor albedo down so paper letters stand on black with one pool of light.
- ~0.6 s per frame for the heaviest frames at 32 sub-frames on a modern GPU; the whole film about 8 minutes.

## 4. Camera (`src/camera.ts`)

One take. Waypoints `(frame, position, look-at, fov, aperture)`, written against the moving objects (`follow(bead) + offset`), joined by **monotone cubic (PCHIP)** curves per channel: smooth, no overshoot. Shot plan that worked: macro on the seed (shallow focus) → follow the bead down the ramp → alongside the wave, rising and receding as it grows → tilt up into the dark after the ball (a tight lens at the apex) → down to the button → crane up for the reveal → run to the next machine → macro on the mechanism, orbiting (never hold the same angle for 8 s) → low in front of the word, pull back to the whole word.

## 5. Sound (`scripts/synth_machine.py`, `references/sound-design.md`)

- `export_events.mjs` bundles `src/events.ts` with esbuild and writes `audio/events.json` (contacts with speed, roll and flight speed curves, gear tooth frames, notes, letter frames). `make_score.py` maps events to `synth_score.py` entries. Never type a frame twice.
- Instruments for physical events (all soft: centroid 0.8 to 2.6 kHz, almost nothing above 4 kHz): `tock` (wood mallet), `roll` (noise following the measured speed, texture at the rotation rate), `clack` (a dry click plus a marimba note: the row plays a scale), `slam`, `launch`, `button`, `wave` (a warm chord that blooms with the light), `zap` (pulse along a cable), `cradle` (steel tick plus one chord tone per ball), `gear` (one tick per tooth), `motor`, `mbox` (struck steel tongue with inharmonic partials), `letter` (thud plus a chord tone), `period`.
- The machine is the music. Keep the bed 12 to 13 LU under the mix (`under_mix_lu`), tempo-locked sections with a silence before each drop, chords rotated so the tune starts on a bar line (`beat0_frame`).
- Use the glide zoom sound for a fall (`zoom`, `style: glide`): the arrival chord rises with the speed of the fall and lands on the button.
- Mark diffuse cues `sync: false`; verify melodic notes with a band-pass onset check in the delivered audio when cross-correlation is ambiguous (sustained tones overlap).

## 6. Pitfalls found

- Pushing the next domino kinematically: unbounded wave. Use impulses.
- The spot light target jumping between links: POP. Glide it.
- A pressed button that sinks under its own ring: the coral disappears. Limit the travel.
- A held shot: the drum played for 8 s from one angle. Orbit.
- Light text on a light floor: switch the HUD colour with the lighting (do not rely on `mix-blend-mode: difference`, it fails at mid grey).
- Cradle balls keep swinging after the scene: do not sound collisions that happen off camera.
