# Distance-field films: technique (from `examples/reel06-resonance`)

A film where **the whole picture is one fragment shader over distance fields**: a dot, a word, a box, a waveform are all "distance to the shape", and a transition is not a cut or a fade but a change of weights or of time. Morphs become clean by construction (the shape *is* a continuous function), and one idea ("sound made visible") gives every scene its look: rings that travel along the level sets of a shape. Read `examples/reel06-resonance` first. Use it for type-led, graphic, non-3D films; use `chain-technique.md` for physical machines and `dive-technique.md` for nested zooms.

## 1. The engine (`src/shader.ts`, `src/frame.ts`, `src/engine.ts`)

- **One WebGL2 pass, everything data-driven.** The scene is a `Frame`: up to 6 `Layer`s and one global row, packed into a **float data texture** (one row per layer, 128 RGBA32F texels) and read with `texelFetch`. Do not use uniform arrays (limits, slow compiles). The picture is a pure function of the frame number; the render is deterministic.
- **A layer** = background, two ink colours, a transform (zoom, pan, rotation, a *bend*), up to 8 **slots** (dot, glyph word, paired words, box, waveform), each in a **group** (slots of one group are blended by weight: that is how a dot becomes a word or a word another word; independent objects must live in different groups or their distances get averaged into nonsense), **pulses** (rings at radius R of a group's field, drawn as `|d - R| < w`), **field lines** (level sets at a fixed spacing and phase, every Nth one emphasised), fills, glow, a Chladni rosette.
- **Compositing**: layers are stacked; a layer can be revealed by a **travelling ring** (the shock wave: refraction and chromatic split on the edge, a rim glow) or by the **counter of a glyph** (push-through). Sub-frame accumulation (12 sub-frames over a half-frame shutter, RGBA32F with `EXT_float_blend`) gives motion blur; edges are analytic, so no MSAA is needed. Grain and dither in a last pass.
- **Glyphs**: real font outlines (`scripts/atlas.py`: fontTools + PIL at 4x + scipy exact EDT) stored as an RG16F atlas: R = signed distance to the glyph, G = signed distance to its counters. A word is a list of letter transforms, so per-letter motion, rotation and morphs are free.

## 2. The moves that made the film

| Move | How |
|---|---|
| **Rewind** (rings run backwards and land on a word) | the field lines' phase and the ping pulses follow a *time warp* (a Hermite curve that turns the movie round and accelerates it); the group field is blended from the dot's distance to the word's distance, so circles turn into letter-shaped contours as they converge; the last line lands on the outline on the lock frame |
| **Melt** (word to word) | do *not* blend two whole words (unaligned letters give torn blobs). Pair the letters by index (S to M, O to O, ...), blend each pair's distance and interpolate their positions together; a missing partner grows out of nothing (scaled copy, offset outward) |
| **Push-through** (zoom into an O and come out in the next world) | mask layer 2 by the glyph's counter distance; zoom about the counter centre with `pan = c (1 - 1/Z) / (1 - 1/Z_end)` so it reaches the centre exactly when the counter fills the frame; the next world's zoom is `Z / Z_end` |
| **The film's own soundtrack** | analyse the mastered mix (`scripts/analyze_audio.py`) into a fine waveform texture and a min/max envelope; draw the curve as a distance field (`|y - w(x)| / sqrt(1 + w'^2)`), take field lines from the smooth envelope, so the sound has parallel contour rings |
| **A line rolled into a ring** | remap the strip's coordinates to (arc length, offset) about a circle of curvature k; keep the arc length fixed; move the strip's midpoint so the centroid ends at the centre (`y = (1 - sin x / x) / k`, `x = k L / 2`) |
| **A ring that opens onto the next room** | the ring's own radius drives the mask, the same ring line is drawn in both layers |
| **Chladni plate** | `cos(m th) cos(k r)` plus a second pattern; draw the zero set with `|G| / |grad G|`. **Compute the gradient analytically**: derivatives (`dFdx`) inside loops with dynamic bounds silently return 0 on ANGLE/D3D and every line vanishes. Sand = 2 px grains with probability `exp(-d^2 / 2 s^2)` |
| **Dust** (a layer breaks into grains, or materialises out of them) | a per-layer threshold on a good 2 px hash (`hash12`; the cheap `fract` hashes show stripes): `alpha *= step(k, h)` with `k = d (1 + spread) - (1 - r/R) spread`, so the outer parts go first; run `d` from 1 to 0 and the layer is born out of dust on its beat (each layer of "together" appears this way) |
| **Whirl** | rotate the layer's coordinates by `a = amount exp(-r / R0)`: the centre twists most; with `amount` ramping to -16 rad and the layers' dust thresholds staggered, a collage of words, waveform ring and plate becomes a whirlpool that is blown away |
| **Words on a circle** | letters placed at `R + y` on the arc with `phi = theta0 + x / R` and rotation `-phi`; two copies half a turn apart in the two word slots of one layer, counter-rotating rings per layer |
| **Sand writes the word** | keep the plate's field `G` (analytic gradient, in cartesian form) and blend it with the word's distance: `G' = mix(G, c D, s)`, `grad G' = mix(grad G, c grad D, s)` with `grad D` by central differences of the word field, `c ~ 0.02`. The zero set (the sand lines) slides from the plate's pattern onto the letters' outline and stays a distance field, so the line width is exact at every `s`. Then fill, spring the letters, fade the sand |
| **Everything together** | montage cuts on half beats, then on quarter beats (each cut its own palette, world, zoom, rotation, glitch slices, one hit), then four layers piling up one per beat, then an iris that closes the whole collage into the seed |

## 3. Pitfalls found

- Nested `for` loops with constant bounds are unrolled by ANGLE; a big shader took **30 s to compile per page**. Make loop bounds come from the data texture (slot count, pulse count, glyph count) and call the layer function once. Compile fell to 1 s.
- Averaging the distances of *independent* shapes (a dot and a word in the same group) produces nothing useful. Groups, always.
- `EXT_float_blend` for RGBA32F accumulation, else RGBA16F. Half-float atlas is precise enough (0.06 px at 100 px).
- A glyph atlas cell must carry padding, and lookups outside the cell continue as `sdf(edge) + distance to the cell`, otherwise rings around big letters end in a rectangle.
- The film's lines are its identity; keep them thin (2.4 to 3 px at 2560 px) and let the colour fields change on the beat.
- Do not put a light-on-dark and dark-on-light HUD on `mix-blend-mode`: ask the scene which colour is under each HUD element (`hudDark(t, x, y)`), including the moment a ring passes it.

## 4. Sound for it (`scripts/synth_epic.py`)

See `sound-design.md`, section "Epic instruments". In short: a boom is a sub that falls from a high pitch to the root, a thump, a crack, a tuned metallic ring and air, through a reverb whose send is high-passed; a tutti stacks boom + choir + brass + bells + crash; the rewind sound is the tail of a boom **played backwards** so it swells into the hit; silence 90 ms before every drop; bass below 150 Hz is collapsed to mono.
