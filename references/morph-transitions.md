# Morph and seamless transitions

Read before planning scene handoffs, and again when a transition looks wrong. Code lives in `templates/remotion/Morph.tsx` and `transitions.tsx`.

A seamless transition is one thing the eye can follow from the old scene into the new one: a card that becomes a screen, a button whose colour becomes the next background, three avatars that melt into a logo. The viewer never sees a cut because their eye is riding the carrier. Every glitch in a "morph" breaks exactly that: for one frame there are two things, or none, or the thing jumps.

## The carrier contract

Every morph has a **source** (drawn by the outgoing scene), a **carrier** (drawn only during the morph) and a **target** (drawn by the incoming scene).

```
frame <  start        source only
start <= frame < end  carrier only      (first frame = source pixels, last frame = target pixels)
frame >= end          target only
```

```tsx
const phase = handoff(frame, T.start, T.end);          // 'before' | 'during' | 'after'
{phase === 'before' && <Card .../>}                     // outgoing scene
<MorphCarrier frame={frame} start={T.start} end={T.end}
  from={{rect: CARD, fill: '#FFFFFF', elevation: 0.55, content: <CardBody/>}}
  to={{rect: FULL, fill: '#FFFFFF', elevation: 0}} ease={ease.snap} />
{phase === 'after' && <DetailScreen .../>}              // incoming scene
```

Rules that make the contract hold:

1. **Compute the source rect from the same function that draws the source**, at frame `start` (idle wobble, camera, anticipation included). A carrier that starts from the "design" position instead of the drawn position jumps on its first frame.
2. **The target must be pixel-identical to the carrier's last frame**: same rect, radius, fill, shadow, and content laid out at the same size. Define both from shared constants (`TITLE_DETAIL = scale(TITLE_CARD, 1.5)`), never by eye.
3. **One carrier per traveling element.** When a card expands into a screen and its title and rows travel to new places, the title and each row get their own carrier, and the container carrier's content must exclude them (otherwise the title is drawn twice: ghost title).
4. **Stagger inside the window with `delay`**, never by shifting `start`. With a shifted start, the element is drawn by nobody for those frames (rows disappear for 1 to 2 frames).
5. **Content swaps sequentially.** `contentOut` must end before `contentIn` starts. Identical content (a row that only grows) is carried without any fade: give only `from.content` and set `contentOut` to `[2, 3]`; it is scaled with the carrier.
6. **Geometry, not scale.** Animate left/top/width/height/border-radius. `transform: scale` distorts corners, borders and shadows and softens text.
7. **Same curve for the whole group.** All carriers of one handoff share one ease and one window so they read as a single move.
8. **The rest of the incoming scene arrives around or after the carrier**, staggered outward from it, usually in the last 30 % of the morph or right after it. Never have it already sitting behind the carrier (that is the "second card behind the first" glitch).
9. **Only the carrier moves at full speed.** Other outgoing elements either travel with it (converge under it and stop being drawn once fully covered), or leave quickly in the first third.

## Choosing the recipe

Pick from what the two scenes share. Vary recipes across a film.

| Scenes share... | Recipe | Kit |
|---|---|---|
| a container (card, tile, row, image) that becomes bigger/smaller or moves | **Shared element / container morph** | `MorphCarrier` (+ one carrier per traveling child) |
| many small objects that become one | **Converge / merge**: satellites fly on arcs under a hero carrier, hero morphs to the target | `MorphCarrier` + `arc()` |
| a coloured element whose colour can become the next background | **Flood / iris reveal** from that element, same colour, starting at its size | `FloodReveal` |
| a shape and a different shape (circle to logo, dot to icon, blob to device) | **Path morph** | `PathMorph` (flubber) |
| a word and a word with a common chunk | **Letter morph** (travel mode) | `LetterMorph mode="travel"` |
| two lines of text with nothing in common | **Text roll** (out, then in) | `LetterMorph` (default roll) |
| a point of interest inside the outgoing scene | **Zoom-through**: push into it until its fill is the next scene | `ZoomThrough` |
| a continuous world (desk, board, timeline) | **Whip-pan** along one strip with directional blur | `WhipPan` |
| an action (tap, drop, explosion) | **Action-driven reveal**: the action's burst or ripple opens the next scene | `FloodReveal shape="burst"` |
| nothing | an intentional **cut on a beat**, with a sound; better than a fake morph | |

Default windows at 60 fps (halve for 30 fps): container morph 30 to 40 frames, converge 36 to 48, flood 40 to 50, path morph 30 to 40, letter roll 36 to 46, whip 14 to 18, zoom-through 20 to 30. Big moves on an arc (`bend` 0.08 to 0.2), short moves straight.

## Recipe notes

**Container morph.** `ease.snap` (most travel early, soft landing). Elevation high at the source if it is a card, zero at the full-screen target; add `lift` (0.4 to 0.8) when the carrier's colour passes through tones close to the background. Old content out in the first 25 to 40 %, new content in from 50 %, done by 90 %.

**Converge/merge.** The hero element becomes the carrier at `start`; its source rect comes from the drawn pose at `start`. Satellites fly on alternating arcs to the carrier's centre, shrinking to about half size and rotating to 0, and must finish by about 75 % of the window. They stop being drawn once fully inside the carrier (no fade needed: they are covered). Give the whole group a short anticipation first (spread out 5 % over half a beat), then converge on the beat.

**Flood.** Start the shape inside the element it grows from, at the element's size (`r0`), in exactly the element's colour; the incoming scene's background is that colour. One continuous curve (`ease.expand`); no spliced punch-and-creep. Put incoming content where the edge has already passed, or after the flood ends. An optional rim must fade before the edges (stray shards at frame corners otherwise).

**Path morph.** Keep both paths closed, similar orientation and start point; sample circles as polygons (96 points). Check the 50 % frame: if it looks like a random blob for more than a few frames, shorten the window or add an intermediate shape. Colour mixed in OKLab. Draw details (fold lines, eyes, text) after the shape lands.

**Text.** Letters travel only if both strings share a run of 3+ letters (e.g. "Paper" in "Paper notes" to "Papertrail"). Otherwise roll: old letters leave upward (staggered over 15 %, done by 50 %), new letters rise in (from 50 %, done at the end). Measure glyphs with `offsetLeft/offsetWidth`, never `getBoundingClientRect` (it bakes the current camera/scale transform into the layout, so spacing depends on the frame where measurement happened). Wrap text in the same font and size before and after; scale the wrapper instead of changing font size mid-morph.

**Zoom-through.** Exponential scale (constant perceived speed). Swap scenes at the frame where the focus element fills the screen; the incoming scene continues the zoom (starts at 1.5 to 2x and settles), so velocity is continuous across the cut. Use `SharpZoom` or a vector source for anything scaled more than 1.5x.

**Whip-pan.** Both scenes on one strip with a shared background texture; `ease.whip`; blur proportional to the measured speed, only along the direction of travel. Put the whoosh peak on the fastest frame.

## Colour bridge

- Mix every colour change in OKLab (`mixColor`), never sRGB (yellow to blue in sRGB passes through grey).
- Keep the carrier's own colour until the second half of the move, then change it (colorWindow about 0.3 to 0.8) so the eye identifies the object first.
- Contrast with the background must survive the midpoint: if both sit near the same lightness, lift the carrier (shadow) or darken/lighten the background during the move.
- A deliberate hard contrast (a coloured flood over a white screen) is good when an action motivates it.

## Glitch catalogue: symptom, cause, fix

| Symptom in the encoded frames | Usual cause | Fix |
|---|---|---|
| Two copies of a card/tile for a few frames; a card behind the flying card | Target (or source) drawn during the morph; incoming grid already visible | Obey the contract with `handoff()`; bring the rest of the scene in around/after the carrier |
| Faint second title or label ("ghost text") | Crossfade of old and new content, or a travelling element also left in the container's content | Sequential content swap; remove travelling children from container content |
| An element vanishes for 1 to 2 frames | A staggered carrier with a later `start` | Same `start`, use `delay` |
| Jump on the first or last frame of a morph | Carrier geometry not identical to the drawn source/target (camera, idle offset, rounding, different font size) | Compute from the same pose function and shared constants; check frames start-1, start, end-1, end at 100 % |
| Reveal pops then almost stops (POP then motion near 0) | Two eased segments spliced; velocity breaks | One curve for the whole move (`ease.expand`, `smoothTrack`) |
| "Patah-patah": repeated or near-identical frames inside a move (STUTTER/HITCH) | Keys that each ease to zero velocity; integer rounding of positions; a hold key in the middle of travel | `smoothTrack` through intermediate keys; avoid rounding transforms; check fps of nested compositions |
| Washed-out, flat frames mid-morph (MUDDY) | Carrier colour passes through a tone close to the background; both texts faded at once | Delay the colour change, add lift/shadow, keep one readable element at every frame |
| Letter soup while a caption changes | Single letters paired between unrelated strings | Roll mode; travel only shared runs of 3+ letters |
| Letter spacing wrong only in some renders | Layout measured with `getBoundingClientRect` under a transform | Measure with `offsetLeft/offsetWidth` once, after fonts load |
| Overlay (cursor ring, tooltip) floats above the next scene | Global `zIndex` on the overlay | Stack by render order; draw per-scene overlays inside or before the reveal |
| Stray shards or objects at the frame edges after a flood/burst | A rim or particle reaches the edge and lingers | Fade the rim before 85 % of the radius; kill particles off-frame |
| Blurry close-up | Layer rasterised at layout size then scaled (3D transforms especially) | `SharpZoom` (CSS zoom then scale down), vector sources, 2x supersampled render |
| Text and old text meet at the reveal edge | Incoming caption starts before the edge passes it | Start it after the edge crosses its position |
| The morph is correct but nobody notices it | Carrier too small, too fast, or the eye is elsewhere | Make the carrier the focal point before the move; 0.5 to 0.8 s for large morphs; one move at a time |

## Verdict per boundary

After rendering, open the `transition_review.py` sheet for each boundary and write:

```
merge notes->card (268-318): GOOD. One carrier, satellites covered by 302, colour holds yellow until 293,
lift keeps it off the paper background; MUDDY@298 flag = 5-frame pale in-between, accepted. Whoosh peak 283 = fastest frame.
```

Weak or broken boundaries get the frames, the cause from the table above, the fix, and a second verdict after re-rendering.
