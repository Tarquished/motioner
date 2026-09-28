# Creative playbook: concepts at benchmark level

Read before writing the storyboard. It turns what the benchmark films do (see [reference films](reference-films.md)) into a method. Smooth motion and clean morphs are necessary but not enough: a film is memorable when one object goes on a journey and every scene is born out of the last one.

## 1. The concept in four lines

Write these before any code. If one is missing, the film will be a slideshow.

1. **Seed**: the single object the film starts from and keeps transforming. Usually a dot in the accent colour, or the brand's own atom (the period of the wordmark, a cursor, a keyframe diamond, a pixel, a note head, a photo's aperture). It must be able to become a button, a ring, a lens, a flood, a particle core and the logo's detail.
2. **Chapters**: 5 to 8 verbs, one per chapter, each shown by the picture itself (bounce, stretch, wait, fit, flow, order, relight, ship). For a product: one feature per chapter as challenge → action → visible result.
3. **Becomes chain**: one line that lists what turns into what, across the whole film. Example (opus_5): `word → its period → pill → button → aperture → photo → grid → full-bleed photo → slider knob → lens → next photo → phone → browser → check → black disc → frame on a wall → aperture → pill → dot → word`. Every arrow is a transformation you can draw; none is a cut or a fade.
4. **Bookend**: how the last frame answers the first (the dot returns as the period, the film loops, the logo shrinks back to the seed, the opening question gets its answer).

## 2. Beat map

Pick the tempo first (120 BPM = 30 frames per beat at 60 fps, 128 BPM = 28.125, 140 BPM = 25.7). Put every chapter change on a whole beat, strongly prefer bar starts (every 4 beats). A 15 s film at 128 BPM is 32 beats (8 bars):

| Beats | Time (128 BPM) | Chapter role | Sound |
|---|---|---|---|
| 0 to 4 | 0 to 1.9 s | Seed appears in silence or a pad; one or two small actions (it pulses, splits, draws a line) | pad, one pluck per action, riser in the last beat |
| 4 | 1.9 s | **Drop**: first flood / iris into a full colour field, title or first big word | kick starts, impact on the flood |
| 4 to 16 | 1.9 to 7.5 s | 2 to 3 demonstration chapters (4 beats each) | groove; one sound per visible action |
| 16 to 24 | 7.5 to 11.3 s | 1 to 2 richer chapters (3D, particles, data, product payoff) | variation, fills, a riser into beat 24 |
| 24 to 28 | 11.3 to 13.1 s | **Montage**: half-beat or quarter-beat cuts through colour fields, recaps, glitches | a 60 to 120 ms silence just before beat 24, then one hit per cut |
| 28 | 13.1 s | **Resolve**: collapse to the seed, the logo grows out of it | low impact plus a bright tonal hit |
| 28 to 32 | 13.1 to 15 s | End card held, one living detail (dot pulse, grain, a caret) | ring-out tail, last 0.3 s fading |

For 30 s product films, double the demonstration section, not the intro. Longer holds are allowed where people read (statements, prices), but the frame is never dead: a counter rolls, a cursor moves, a caret blinks.

## 3. Transformation catalogue (how scene N becomes scene N+1)

Pick a different one for each boundary; two in a row of the same kind feel mechanical. Kit components are in `templates/remotion/`.

| Transformation | What happens | Kit |
|---|---|---|
| Seed flood | the dot (or any disc) scales past the frame and becomes the next background; the new scene's content appears after the edge passes | `FloodReveal` |
| Double iris | two concentric rings of different colours (paper ring leading, colour disc following 4 to 6 frames later) | `FloodReveal` twice with a delay |
| Absorb into the period | a word slides into its own final dot with horizontal motion blur, letters compress and vanish into it; the dot holds a beat | `AbsorbWord` |
| Squash and stretch into UI | the dot stretches along its travel into a pill, overshoots, settles as a button / toggle / progress bar | `MorphCarrier` with a `rectArc`, `squashStretch` |
| Shape morph with ghosts | circle → triangle → star → square with faint outlines of the previous shapes left behind for a few frames | `PathMorph` + `Ghosts` |
| Aperture | six blades close over a scene and open onto the next (camera, photo, reveal inside a frame) | `Aperture` |
| Lens / portal | a small round element (knob, dot) detaches, grows into a glass lens that shows the next scene inside it, then expands to become the frame | `LensPortal` |
| Pull-back | the camera pulls back and the scene turns out to be inside something (a phone, a tile of a wall, one cell of a grid); keep pulling until it tiles into a pattern | `SharpZoom` / `poseTrack` |
| Push-through | zoom into one element (a tile, a letter's counter, a button) until its colour is the new background | `ZoomThrough` |
| Tile / grid metamorphosis | a pattern's tile becomes a dot; dots become plus signs, diamonds, cubes; a flat grid tilts into 3D and extrudes | `DotField` + CSS 3D or `@remotion/three` |
| Particles | a word or shape explodes into particles that swirl (flow field, vortex, galaxy) and collapse to a bright point; the next thing grows out of that point | `ParticleForm` |
| Text becomes geometry | lines of text bend into rings around a dot, spin, blur into a disc, collapse | `TextRing` |
| Strike and replace | a line strikes through a word; on the beat the field changes colour and the replacement slams in | `StrikeSwap` |
| Wipe with a shape of the story | diagonal band, stepped stairs, slats retracting in a stagger, a tube snaking across: the wipe object has its own colour and edge | `SlatReveal`, `BandWipe` |
| Burst | a small object pops into radial lines and a ring on impact; the burst hides a swap underneath | `Burst` |
| Montage cut | a hard cut on a half beat with a different colour field; allowed only in the accelerating section, each cut with its own hit | cut + `RgbSplit` on the incoming frame |
| Recap wall | the frame splits into a grid of the film's earlier scenes, all still moving, then collapses into the logo | `Sequence`s in a grid |

The morph rules in [morph transitions](morph-transitions.md) still apply to every one of these: one carrier, no ghosting, live content, matched shadow and velocity at the handoffs.

## 4. Type that acts out its meaning

Give each important word a behaviour that demonstrates it. Build letters as separate spans with locked widths (no reflow).

| Word idea | Behaviour |
|---|---|
| stretch, grow, scale, big | letters scale on a locked baseline, the middle letter most, others less (elastic, `eio(p*1.36 - |i-mid|*0.12)`) |
| bounce, jump, play | each letter drops and bounces with squash, staggered 45 ms |
| spin, turn, change | each letter rotates in Y (rotateY 0 → 360 or 450°) with a stagger, backface showing a mirrored copy |
| snap, sharp, precise | arrives with no easing between red guide lines, one frame of overshoot |
| ease, smooth, calm | one long ease, motion blur only in the middle |
| linear, constant | slides at constant speed out of the frame |
| every, never, always, more | repeated in rows behind, alternating directions, outline and fill versions |
| wait, slow | a live timer counts; the word holds too long, then is struck through |
| noise, error, glitch | RGB split, slice offsets, pixel blocks for 6 to 10 frames |
| flow, form | drawn by particles, or with liquid shapes swimming through the letters |
| fit, order, stack | letters or blocks drop into slots with a click each |
| one word per beat | EVERY / FRAME / ON PURPOSE: each word slams in on a beat, alone on its own field |

Pairings that work: extended black grotesk caps (Unbounded, Archivo Expanded, Bricolage Grotesque Condensed/Black, Anton for condensed) for statements, an italic serif (Instrument Serif, Fraunces Italic, Playfair Italic) for the human line under it, a mono (JetBrains Mono, IBM Plex Mono) at 11 to 14 px letterspaced for chrome. Kinetic words are huge (40 to 60 % of the frame width); captions stay small.

## 5. Visual system

- **Palette as fields**: 1 dark, 1 paper, 1 hot accent, 1 cool accent (+1 optional). Each chapter owns a field; floods and wipes switch fields on beats. The accent colour belongs to the seed.
- **Chrome**: crop marks, reel title and chapter label in mono, timecode and BPM / bar counter, a progress rule with ticks (`HudFrame`). It never moves with the scene.
- **Annotations**: onion-skin echoes (`EchoTrail`), bezier handles, bounding boxes with live readouts, handwritten notes in a script font with a drawn arrow. Use them when the film is about craft or about how something works.
- **Texture**: subtle animated film grain (2 to 4 % opacity) and a soft vignette; RGB fringing only on glitch accents.
- **Depth**: 3D fields (voxel blocks, dot planes, particle galaxies, chrome or glass blobs) are chapter content, not decoration. Use `@remotion/three` for real 3D; flat CSS 3D (perspective + rotateX) is enough for tilting grids and UI.
- **Real product UI** stays crisp and full-size; the camera goes to it (zoom into the element that matters), with cursor, typing and clicks that cause visible results (spinner → check → status → progress).

## 6. Product film pattern (opus_4, 5, 7, 9)

1. The brand mark or its atom is the seed; the logo turns into the product's first control (logo → button, logo → app window).
2. The pain in one line, acted out (a timer ticking while "Thinking...", blocks overflowing "doesn't fit.", a crowd of empty composer cards).
3. The product answers: one feature per chapter, each a statement on the left and a live, zoomed UI on the right, with a real interaction and a visible result.
4. Payoff: the camera pulls back or the object leaves the screen for the real world (a print in hands, a calendar wall, numbers rolling up).
5. Logo resolves from the last object, stats or CTA, bookend to the seed.

## 7. Self-check before building

- Can you say what each scene **becomes**? Any arrow that is "cut to" or "fade to" outside the montage needs a transformation.
- Does the seed appear in the first second and in the last frame?
- Is there a chapter label or a verb for every chapter, and is each verb visible without the caption?
- Are all chapter changes on beats? Is there an acceleration before the logo and a moment of silence before the drop?
- Pause at any frame: is there one clear focal object, and does the still look like a designed poster?
- Is anything on screen for more than one beat without moving (outside the end card)?
- Does every word on screen do something only that word would do?
