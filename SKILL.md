---
name: motioner
description: Direct, build and verify finished motion graphics, showreels and product videos (usually with Remotion) at the level of the best code-made films - one object that transforms through every scene, seamless morphs, kinetic type that acts out its words, cuts on the beat, and music and sound effects written in code and placed on the exact frame. Use for product demos, feature tours, app promos, brand reels, kinetic typography, logo reveals and social videos, and for fixing a film whose transitions glitch, whose SFX feel early/late/wrong or whose ideas feel flat. Not for static images or ordinary UI micro-interactions in a web app.
---

# Motioner

Make a film where one idea travels through every scene, every scene is born out of the last one, every move is smooth, and every sound lands on the frame it belongs to. Remotion is the default tool; the brief overrides every taste default here.

Four things decide whether the film is good. Spend the effort there:

1. **A creative concept**: a seed object that keeps transforming, chapters of one visible verb each, a "becomes" chain with no plain cuts or fades, a bookend. Study [reference films](references/reference-films.md) (12 benchmark films broken down frame by frame) and follow the [creative playbook](references/creative-playbook.md).
2. **Smooth animation**: curves chosen by role, no velocity breaks, nothing frozen while the eye reads it. See [motion craft](references/motion-craft.md).
3. **Seamless morphs**: one carrier object crosses each boundary; source, carrier and target are never visible at the same time. See [morph transitions](references/morph-transitions.md).
4. **Sound on the frame**: music and SFX synthesized for this film on its beat grid (a whoosh shaped like the move, a riser peaking on the reveal, a silence before the drop), sync proven in the delivered MP4. See [sound design](references/sound-design.md).

Nothing is finished until the encoded file has been measured and looked at.

## Workflow

### 1. Contract and research
- Record: audience, message, aspect ratio, size, fps, exact frame count, codec, audio rules, delivery path, read-only folders.
- Study the real product or brand before scripting: real UI, labels, colours, fonts, logo. Never invent an official-looking logo or claim.
- When the user allows internet assets, research and download them without asking per file, and log source, creator, licence and use ([asset sourcing](references/asset-sourcing.md)).

### 2. Concept before anything else
Write the four lines from the [creative playbook](references/creative-playbook.md): **seed**, **chapters** (5 to 8 verbs), **becomes chain**, **bookend**. Pick a transformation from the catalogue for every arrow (different kinds in a row), a behaviour for every important word (type that acts out its meaning), a palette of 4 fields (dark, paper, hot accent, cool accent), a type pairing (extended grotesk + italic serif + mono) and the film chrome (HUD). Show the concept to the user in plain words when the brief is open.

### 3. Plan on one clock
- Pick the tempo first (120 BPM = 30 frames per beat at 60 fps). Put every chapter change on a whole beat, prefer bar starts; accelerate to half-beat cuts before the logo; leave 1 to 1.5 s of held end card. If you use a found track instead of a synthesized score, run `scripts/beat_grid.py` on it and plan on its grid.
- Write a single timeline file (`src/timeline.json`) with every event frame. Picture, score and review plan all read it. Never type the same frame number in two places.
- For every boundary: outgoing subject → **carrier** → incoming subject, rects, colours, recipe, frames, sound. For every tap/click: target, contact frame, state before, response, state after.

### 4. Build with the kit
- Copy `templates/remotion/*` into `src/motioner/`: `motion.ts` (curves, smooth tracks, arcs, OKLab colour, fastest-frame finder), `Morph.tsx` (`handoff`, `MorphCarrier`, `PathMorph`, `LetterMorph`, `shadowOf`), `transitions.tsx` (`FloodReveal`, `ZoomThrough`, `WhipPan`, `MotionBlur`, `SharpZoom`), `creative.tsx` (`HudFrame`, `Grain`, `Burst`, `Aperture`, `LensPortal`, `SlatReveal`, `BandWipe`, `EchoTrail`, `KineticWord`, `AbsorbWord`, `Counter`, `TypeOn`, `ParticleForm`, `RgbSplit`, `squashStretch`, `beatFrame`, `speedCurve`) and `build.mjs` (score + render + mux + verification). Read [Remotion setup](references/remotion-setup.md).
- When a film is camera-driven or has thousands of primitives (particles, columns, metaballs, nested zooms), draw it on one `<canvas>` in `useLayoutEffect` instead of DOM/SVG, and export the numbers the score needs (camera speed, event frames) from the same TypeScript (`export_events.mjs`, see `examples/reel04-dive`).
- Everything is a pure function of the frame. No CSS transitions, timers, `Math.random()`, or layout measured with `getBoundingClientRect` under a transform. Hold rendering until fonts load; measure letters once with `measureWidths` and position them absolutely so words never reflow.
- `examples/reel06-resonance/` (30 s, 2560x1440, no 3D: the whole picture is one distance-field shader; a dot pings, rings rewind onto the word SOUND, it melts letter by letter into MOTION, a push-through into an O opens the film's own waveform, which rolls into a ring that opens onto a Chladni plate of sand, a montage and "everything together" collapse into the dot, and the rings rewind onto *motioner.*; a code-written epic score with booms, choir and time-reversed sound; see [field technique](references/field-technique.md)), `examples/reel05-chain/` (a cause chain in 3D: a pendulum, a domino wave, a see-saw, a wave of light, a cradle, gears, a music box and eight letters that spring up, each triggering the next; simulated physics, an HDR accumulation renderer with soft shadows, motion blur and depth of field, a camera on PCHIP waypoints, and 142 sounds on the frame of their causes; see [chain technique](references/chain-technique.md)), `examples/reel04-dive/` (one continuous zoom through six nested worlds: canvas engine, exact window geometry, motion blur, and a score that follows the camera; see [dive technique](references/dive-technique.md)), `examples/reel02/` (a seed dot that becomes every scene) and `examples/reel03/` (a film built from the letters of one word: particles → word → t → timeline → waves → lens → scene wall → word) are complete films with their score scripts and review notes; read one before building your first film. Do not reuse their seed or their archetype: a new film needs its own idea, and a different one from the last film you made (seed journey, word as world, nested dive, cause chain and distance field are five archetypes, not templates). Their prompt-bar chapters ("Just describe it.", "describe the video in your head") were rejected by the client as uncreative: never reuse that device.

### 5. Review every transition, then fix
Render a draft and run the loop in [review checks](references/review-checks.md):
- `scripts/transition_review.py film.mp4 --plan transitions.json` → sheets and flags (POP, STUTTER, HITCH, FLASH, BLANK, COLORJUMP, GHOST, MUDDY, SOFT, HANDOFF-JUMP, TELEPORT, JERK) and the measured fastest frame of every move. Give each morph `"handoffs"`.
- Zoom into every local flag with `scripts/contact_sheet.py --frames a-b --crop x,y,w,h`.
- **Open every sheet and look.** Write a verdict per boundary: good / weak / broken, frames, cause. Floods and montage cuts raise COLORJUMP/POP by design: say so in the verdict, do not ignore them silently.
- Whole film at phone size (`contact_sheet.py --every 16`): is the frame filled (big type, big objects), one focal point, no dead stretch, a different field colour per chapter?

### 6. Sound
- Default: **write it in code**. `scripts/make_score.py` (per project, from the timeline) → `scripts/synth_score.py` renders a tempo-locked music bed (intro / groove / lift / montage / outro, silence gap before each drop) and one synthesized sound per event (pluck per bounce in the key, riser ending on the drop, impact on floods, whooshes peaking on the measured fastest frames or following a `speedCurve`, a tick per letter, typing per character, glitch on montage cuts, chime on the tagline) → `build_mix.py` places and masters → `build.mjs` muxes.
- For a film whose hits must be huge (a finale, a drop that should give goosebumps) use `scripts/synth_epic.py` (`"music_engine": "epic"`): layered booms, tutti, choir, time-reversed rewinds, bell runs, sand, gliding chords, and a bed of kits; collapse the bass below 150 Hz to mono, keep reverb sends out of the sub, leave `sfx_bus` transients alone (`ratio` 1.25), and measure band shares per half second with a small analyser (see [sound design](references/sound-design.md), section "Epic instruments").
- Option B, found assets: screen with `sfx_scan.py`, cue with `build_mix.py`, music from `beat_grid.py` (see [sound design](references/sound-design.md)).
- Render the picture muted and mux the WAV with FFmpeg (`build.mjs`). Then `scripts/sync_check.py film.mp4 mix.cues.json`: every cue within half a frame.

### 7. Deliver
- `scripts/verify_video.py` (size, fps, exact frames, codec, yuv420p, audio length).
- Report: the file, the concept in one line, the transition verdicts (with fixes), cue count and sync, loudness and true peak, the asset manifest, and what you could only measure. If you cannot hear audio, say so; offer the stems.

## Hard rules (each one comes from a real failure or from the benchmark)
- A film is one journey. The seed appears in the first second and returns in the last frame; outside a montage accent, no scene starts with a plain cut or a crossfade: it grows, floods, morphs, zooms or collapses out of the previous one.
- Chapter changes land on beats; montage cuts are half beats and each has its own hit; there is a silence of 60 to 120 ms right before a drop and a held end card of at least 1 s with one living detail.
- No prompt boxes, typed instructions or lines addressed to the viewer ("describe the video…", "just describe it", "imagine…"): the client rejected them as not creative. Show the thing happening instead.
- Every important word does something only that word would do (stretch stretches, small shrinks, snap has no easing). Big type: statements 40 to 60 % of the frame width, never lost in the middle of an empty frame.
- A morph is one carrier. Hide the source on the carrier's first frame, show the target on its last frame, draw nothing else of either in between. A carrier that ends as a UI element (button, pill, lens) must also start as the exact shape it replaces; grow the new element out of it (same circle on its first frame).
- Carrier content that moves stays **live** (rendered with the current frame); a frozen snapshot jumps when the live scene takes over.
- Handoff frames match in everything: shadow and glow (`shadowOf`), decorations, velocity. Idle motion reaches zero speed at the handoff. Anything not carried leaves with its own animation.
- Moves start from rest with a visible ease-in; pulses and hits get a 2-frame attack, never a one-frame jump. Check start-1..start+1 and end-1..end+1 as zoomed crops.
- Stagger carriers with `delay` inside one window; swap content sequentially; mix colours in OKLab; one continuous curve per move.
- Incoming text appears only after a reveal's edge has passed it.
- Sounds are made or chosen for the event and placed by their alignment point (attack on contact, whoosh peak on the fastest frame, riser end on the reveal minus the silence gap). Repeated sounds use several takes; never the same take twice within 60 ms.
- Layers stack by render order; no global `zIndex` on overlays. Slowly scaled text groups (up to ~1.2x) get `will-change: transform`; text that grows more is re-laid at its real font size each frame, never scaled up as a bitmap.
- Anything that rides, bounces or reacts is simulated (gravity, contact, squash, lagging rotation) against a surface driven by events; a formula like a scrolling sine reads as stiff.
- Mux the mastered WAV with FFmpeg; deliver `yuv420p` bt709; prove sync in the final file.

For open-ended branded work, [direction profile](references/direction-profile.md) gives taste defaults and the list of things clients have rejected. [Typography](references/typography.md) covers font choice and text motion.
