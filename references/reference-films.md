# Reference films: what the benchmark does, film by film

Read when planning a film's concept, and again when it looks "fine but not special". These are frame-by-frame breakdowns of 12 short films made entirely in code (React, Remotion, Three.js, synthesized sound) that set the bar for this skill. Frame numbers are at 60 fps unless noted. The measurements (cuts in beats, sync) were taken from the encoded files.

## What all twelve share

1. **One seed.** Ten of twelve open on an empty frame and a single dot (brand colour, 8 to 20 px) or a bouncing ball. That dot is the protagonist: it grows, splits, becomes a ring, a burst, a button, a lens, a planet, a particle core, and comes back as the period in the final wordmark ("Claude.", "develop.", "muda.", the tessel dot). The film is one object's journey, not a list of scenes.
2. **Every scene is born out of the last one.** A shape at the end of chapter N is the start of chapter N+1: the dot floods into the next background, a circle morphs into a triangle, a pattern's tile becomes a dot grid, a galaxy collapses to a point and the logo grows out of it. There are almost no crossfades in 3 minutes of material. Hard cuts exist, but only on a beat and only as a montage accent.
3. **Chapters of 1.5 to 2.5 s, one idea each**, often labelled like a book: `02 / 08 — TYPE`, `04 · DATA`. A 15 s film has 6 to 8 chapters. The chapter idea is a single verb the viewer can see: bounce, stretch, snap, ease, flow, fit, wait.
4. **The picture is scored to a tempo** (120, 128 or 140 BPM) and scene changes fall on whole beats: in opus_1 the changes are at beats 4, 12, 16, 24 and then every half beat (24, 24.5, 25, 25.5, 26) in the montage before the logo; in opus_4 (30 fps, 120 BPM) every one of the eight cuts is an exact multiple of 15 frames.
5. **Energy curve**: quiet seed (0 to 1.9 s), first colour flood on the drop (about 2 s), 3 to 5 demonstration chapters, an accelerating montage (half-beat cuts, recap of earlier scenes), a short silence or suck-in, the logo hit, and 1 to 1.5 s of held end card with a living detail (pulsing dot, drifting grain).
6. **Type acts out its meaning.** STRETCH stretches its letters on one baseline, BOUNCE bounces letter by letter, SPIN rotates each letter in 3D, SNAP arrives with no easing between guide lines, EASE eases, LINEAR. slides at constant speed, WAITING is struck through and becomes WASTE., NOISE glitches, "flow" is drawn by 16,000 particles, FORM swims through metaballs.
7. **A narrow palette used as full-frame colour fields**: near-black (#0F0E11), warm paper (#EFEBE4), one hot accent (red-orange #EE4939 / #FA4B1C), one electric blue (#2F2DF4), sometimes a yellow or acid lime. Backgrounds switch between these on beats via floods and wipes, which gives each chapter its own colour without new colours entering.
8. **Film chrome (HUD)**: corner crop marks, a monospace line top-left (`CLAUDE · MOTION REEL 2026`), timecode and `128 BPM · BAR 4/8` top-right, a thin progress rule with tick marks at the bottom, chapter label bottom-left. It frames every scene, stays still while the scene changes, and makes the film feel designed.
9. **Designer annotations as content**: bezier handles on an ease curve, onion-skin echoes of a bouncing ball, handwritten notes ("squash!", "slow in, slow out", "stagger: 45ms", "linear = robotic" crossed out), bounding boxes with live rotation readouts (`ROT 181.2°`). They explain the motion while being motion.
10. **Sound written in code.** The credits say "every frame and every sound written in code". The spectrograms confirm it: clean synth pads and plucks in one key, a kick on every beat, noise risers whose top lands on the reveal frame, whooshes whose loudness follows the picture's speed curve, one tick per UI element or typed character, a 60 to 120 ms silence right before the drop, a low impact under the logo, a tail that rings out to the last frame. Measured hits land on the cut frames within about a frame.

## The films

### opus_1: Claude, motion reel (15 s, 128 BPM, black / red / paper / blue)
- 0 to 1.9 s: red dot in a thin ring; a stroke draws (clock hand), the dot bursts into a 12-ray asterisk inside a ring of orbiting micro-text; the asterisk shrinks.
- 1.9 s (beat 4): two-ring iris from the centre (paper ring, then red disc) floods the frame; CLAUDE rises in extended black caps, "motion designer" in italic serif writes on under it.
- 3.5 s: a diagonal red band wipes to paper; six dots race along six rails, each with its own easing (linear, ease-in-out, expo-out, back-out, elastic, bounce) and a tiny curve icon: a lesson that is also choreography. The dots settle into ring targets.
- 5.6 s (beat 12): one dot grows into a paper disc on electric blue; satellites orbit; the disc morphs circle → triangle → star → rounded square with ghost outlines of the previous shapes.
- 7.5 s (beat 16): the square lands on black and tiles into a Truchet pattern of arcs; red arcs flow through it like a current; the pattern becomes a dot grid that bends into a 3D surface, a sphere, a torus of dashes.
- 11.25 s (beat 24): montage on half beats: EASE smeared, LINEAR. sliding, OUT. on blue, NEVER repeated in rows on lime, each a hard cut with its own colour field.
- 13.1 s: the asterisk returns on red, collapses, and CLAUDE assembles letter by letter with a scatter of particles; end card held 1.3 s.
- Sound: pad and ticks, riser into 1.9 s, kick per beat, a full dropout at 11.2 s for about 100 ms, then one hit per montage cut.

### opus_2: side-by-side test (32 s, 140 BPM): Opus reel then a competitor's
- The first half (Opus) is continuous: a ball bounces with squash, onion-skin arcs and labels; EVERY / FRAME / is / CODE one word per beat on changing fields (FRAME outlined, then filled and boxed with selection handles, "is" smears, CODE types with a cursor); a dot grid morphs dots → plus signs → diamonds → cubes and tilts into a 3D field of extruded blocks with a red ball rolling across; MOTION repeated in rows slides in alternating directions; particles form a sphere then two coloured spirals; a split-screen recap wall of every previous scene; the grid explodes; CLAUDE.
- The second half (competitor) is posters: big static headline left, one chrome 3D object turning right, a hard panel wipe every 3 s. It looks designed but nothing becomes anything. That is the failure mode to avoid: layouts that hold, joined by wipes.

### opus_3: "Every frame on purpose" (15 s, 128 BPM)
- Dot → two dots → a ring of 8 dots that rotates and spreads; on beat 4 a red field hits and EVERY slams in; FRAME drops letter by letter inside crop brackets; ON PURPOSE. with a cursor.
- Shape study: a red circle in a bounding box with live rotation readout becomes a blue rounded square, lavender, a yellow triangle, an orange flower, a red rosette of hundreds of petals, a black spiky ring on paper.
- A paper dot grid is pushed by an invisible wave (red dots where displaced), becomes blue 3D dot planes, a sphere, a ring, a wire cube.
- A tube (red / white / blue stripes, black outline) snakes across yellow and pulls out left; on black, rows of kinetic text slide at different speeds and then bend into concentric rings (text on circles) around a red dot; the rings spin, motion-blur into a disc, collapse to the dot; a paper iris opens; the dot flies up as "Claude" types in serif and the dot lands as its period.

### opus_4: muda, a technical explainer (26 s, 30 fps, 120 BPM, white / indigo)
- A prompt types into a chat bar; "Thinking..." with a live timer counting 0.12 s ... 6.54 s; the whole UI slides out.
- WAITING in huge navy caps; a line strikes through it; hard cut on the beat to indigo: WASTE.
- A grid of GPU cells, 31 % utilisation, small labelled callouts ("IDLE", "PREFILL"); a scan line sweeps and the cells fill with colour: 35 %, 76 %, 94 %; "Most of inference is waiting." becomes "Not anymore."
- The cells turn into a wall of token chips; a counter card rolls 41 → 277 → 882 → 2,028 → ... → 12,480 tok/s, latency 705 → 38 ms.
- Editorial dictionary page: "muda, 無駄: waste; futility" with a brush ensō drawing itself and ghost kanji; a line types in; "We removed the waste. It was most of it." typed word by word, the second line in indigo.
- Logo "muda." on a tilted pastel gradient band; stats; "26.000 s this film / 0.038 s your answer"; end card with a tiny "done." line.
- Sound: 2.5 kHz clock ticks during the wait (anxiety), a noise swell into the WASTE cut, then per-beat plucks while numbers climb, silence and a single tone for the dictionary page.

### opus_5: develop. (29 s, 1440x1440, 120 BPM, product film for a print service)
- "develop." with the cursor waiting; the word slides right, compresses with motion blur and is absorbed into its own period; the dot waits one beat, stretches into a black pill (squash and stretch), recentres, "Develop" fades onto it: the logo became the button.
- The cursor clicks; the button turns into a camera aperture (six blades), the blades open onto a photo in a circle, which expands to a rounded card.
- The card shrinks into a stack, deals into a 3x3 grid of photos, the grid reshuffles as one tile grows (a gallery), one tile fills the frame.
- Full-bleed photo with a glass toolbar; the heart fills; a "Golden hour" slider drags 0 → 100 and the photo is relit live.
- The slider knob detaches, grows into a glass lens, follows the cursor and shows the next photo inside it; the lens expands to become the frame (portal transition).
- A lock screen builds on the photo (date, 9:41, music player); the camera pulls back: it is a phone on a blue silk backdrop; a pill beside it grows into a browser; the photo is dragged from phone to browser; the site builds ("from screen to wall."); options (frame, size) are clicked; "Order print" → spinner → Ordered → Printing 88 % → On its way → check.
- The check grows into a black disc that fills the frame; the black becomes a frame on a real wall with leaf shadows; aperture blades open inside the frame to reveal the print; hands lift the frame; push in to the photo; the aperture closes to black; a black rounded rect shrinks to a pill, to a dot, and "develop." rebuilds: the film loops.
- Sound: soft UI clicks, shutter clicks on the aperture, rising tonal sweeps on reveals, whooshes shaped exactly to the moves.

### opus_6: "I make things move" (15 s, 30 fps, 128 BPM, grey / black / electric blue / red)
- A blue ball falls and bounces with onion-skin echoes and handwritten notes (slow in, slow out; squash!; stretch).
- I MAKE THINGS MOVE. assembles letter by letter with motion blur, the ball lands as the period; notes: "stagger: 45ms", "overlap".
- Type that obeys its word on black: BOUNCE (letters bounce at different heights), STRETCH (horizontal smear), SPIN (letters flip in Y), SNAP (red, guide lines, "no ease, on purpose").
- An ease graph: linear = robotic (squares evenly spaced) is struck out; ease in-out draws the S curve and the squares bunch at the ends ("spacing!").
- A blue comet with a trail swims through a dot field that ripples red where it passes ("follow-through").
- A dial loads 14 % → 100 % with dots filling; "anticipation": the dot squashes before launching.
- MOTION DESIGNER / CLAUDE. with the blue dot as the period and "open to new projects" in handwriting.

### opus_7: ClimbX launch (30 s, 720p30, 120 BPM, dark / orange / white)
- An orange target pulses, bursts (radial lines), becomes a flag on a pole, a mountain draws under it; the camera flies over the peak.
- Orange field full of floating "What's happening?" composer cards; the question types in bold: "what do I post today?"; white flash burst; the mountain mark and ClimbX assemble from particles; tagline.
- Real product UI (sidebar, Studio, Calendar, Inspiration) swipes by; "10 ready posts" counts up while post cards stack; a card is picked, becomes the editor; "make it yours." types; a rating panel fills; "Ready to post" badge.
- "your week, handled." with calendar columns; the calendar zooms out and tilts; an orange burst; "build connections, not impressions." on black with a reply being typed and like / follower pills flying out; a growth line draws with a glowing head.
- Logo again from particles; stats roll 0 → 10K followers, 9.9M impressions, 140 days; URL and a CTA pill.
- Sound: one pitched pluck per beat while the mark builds (0, 0.5, 1.0, 1.5 s), a noise riser from 2.6 s ending exactly on the whip at 4.0 s.

### opus_8: Claude, motion designer (15 s, 128 BPM, black / warm white / orange; no hard cuts at all)
- An orange keyframe diamond; a bezier curve draws with handles; the dot rides the curve; the curve turns into the word "motion"; words morph into each other through a vertical swap (motion → timing → feeling in italic).
- The dot becomes a toggle knob, the toggle grows into a "Rendering reel" progress pill, completes with a check.
- The pill line becomes a velocity bar chart (orange peak bar), bars redistribute into position, tilt into 3D and extrude into a voxel field; a pattern ripples through the blocks (orange ring).
- The blocks dissolve into flow-field particles, which wind into a spiral galaxy, which spins and collapses to a bright point; "Claude." with the orange period; subtitle.
- Sound: a continuous groove, a long riser from 11.5 s to the collapse, a drop to near silence, the logo hit at 13.2 s.

### opus_9: tessel, a calendar product (33 s, 120 BPM, white / black / crimson)
- Crimson full frame shrinks to a disc, to a dot; the dot draws the "now" line of a calendar; event blocks pop in with ticks; "Your week" then "doesn't fit." slams in; blocks overflow and the frame whips.
- A black disc closes the scene around the dot; the dot plus two shapes assemble the tessel logo (built from its own calendar blocks) with the tagline.
- The logo grows into the app window; the app zooms in; the prompt bar types "Protect my mornings. Gym Tue + Thu. Ship the deck by Friday."; send is pressed and the crimson button floods the screen; the calendar reappears in perspective and black focus blocks drop into every morning.
- Feature chapters with a big two-line statement left and a zoomed live UI right: "Meetings move over.", "Mornings stay yours.", "Overruns fit too." (a meeting extends +30 min and the next blocks slide down).
- Zoom out: the calendar becomes one tile of an infinite tiled wall of calendars; blur; "Everything fits." with the crimson dot; the words collapse into black blocks that become the logo; the logo shrinks back to the dot. Bookend.

### opus_10: claude., motion reel (15 s, 120 BPM, black / paper / electric blue / orange / yellow)
- An orange ball bounces on a line on black, squash and stretch, figure labels ("FIG. 01 SQUASH + STRETCH").
- "motion" appears with RGB split, the ball lands as the dot of the i, "design" drops under it; the type morphs weight and width.
- An orange disc floods the frame into a Bauhaus tile pattern (yellow, blue, black, orange), which morphs into a black Truchet maze on paper.
- On black the orange dot becomes the core of a particle vortex, a 3D particle disk, a galaxy.
- Blue field: orange metaballs merge into one ball, split into two, four, then a row of twelve, which turn into white capsules of a bar chart; a dashboard builds with counters (0630, 120, 2545, 431) and a sparkline.
- Glitch montage: RGB-split cut back to the pattern, the metaballs, then "claude." with the orange period and "motion designer" in italic; footer line "EVERY FRAME AND EVERY SOUND WRITTEN IN CODE".

### opus_11: CLAUDE. motion designer (15 s, 140 BPM, black / orange / paper / blue)
- A red dot draws a line, a typing caption "claude / motion reel — 2026", the line swells into an orange field; a half-disc rises like a sun; CLAUDE. in extended caps with "motion designer" in italic serif.
- A black disc wipes in; a grey voxel grid tilts and a chrome planet with a ring rises out of it as the blocks turn into an orange-pink-violet heat map.
- VERY (blurred, huge) → EVERY → SINGLE repeated in rows on black → FRAME typed in a crop box on blue with a speed smear → "on purpose." in italic on orange with a diagonal stepped wipe.
- Infographic: +133 % rolling to +312 %, donut 0 → 78 %, bars growing, a line drawing across; a stepped wipe to black.
- Particles as long light streaks form a sphere and a ring; a blue render dialog: a toggle clicked, Render pressed, progress 20 %, Done; the dialog blurs into a blob; orange: black balls inside a circle, the circle turns into a wobbling blob outline, the balls merge into one black disc, the disc becomes the red dot, "Claude" types beside it.

### opus_12: Claude, showreel (15 s, 120 BPM, paper / red / black / blue, with film grain and RGB fringe)
- On paper: "a reel, in fifteen seconds" in italic serif; a red ball bounces across a timeline with dotted arcs and labelled keyframes (squash, stretch, arcs, anticipation).
- Red field: I / MAKE / THINGS / MOVE one word per beat, huge; the O of MOVE is a white ball; ghost words behind.
- A Bauhaus tile field boils (tiles rotate and swap); it collapses into a red disc on black; FORM in huge letters with chrome metaballs swimming through them (refraction, RGB edges).
- A particle galaxy; "flow" formed by particles in italic; a data dashboard (frame counters, donut 78 %, bars, area chart) glitches out; FORM / NOISE glitch montage; a blue dot and a red dot meet on black; "Claude." in serif with the red period; "MOTION DESIGNER" letterspaced; footer "SHOWREEL 2026 · EVERY FRAME WRITTEN IN CODE · AVAILABLE FOR WORK".

## The Opus 5.5 motion board (16 UI effects on one 8 s loop)

Source code studied (`motion-board.html`). Its conventions are worth copying:
- Every frame is a pure function of time; each tile has a cycle `before → forward (2.2 s) → hold (4.4 s) → return (1.4 s)` so it loops without a jump, and the paused frame at any point still tells the story.
- Only two easings: cubic in-out for moves and cubic out for arrivals; staggers are done by offsetting the same eased progress (`eio(p * 1.6 - i * 0.12)`), so all items share one curve.
- A **ghost** of the start state (dashed outline at 30 to 40 % opacity) stays where the element began, and dotted leader lines connect start and end: the viewer sees the transformation, not just the result.
- Content swaps are sequential and directional: the old row slides 14 to 16 px left while fading, the new one comes from the right (`ri < 0.5 ? old : new`).
- The effects: button → player (shell grows, play icon travels and becomes pause); search → results (pill widens, query types, results stage in 0.35 apart); card → workspace (card grows from its own corner, its title travels to the window chrome); tabs (the pill stretches: leading edge first, trailing edge 0.3 later, with speed lines); chart morph (bars thin into a line through their tops, points pop in order, value tag last); dashboard zoom (overview dims, one tile scales forward from its exact place with corner brackets and leader lines); spring stack (cards fan with damped springs, the top one overshoots, a trail of its corner); magnetic dock (gaussian swell around the cursor); masked type (art rises inside the letters with an edge line); elastic type (letters stretch on a locked baseline, the middle most); text → layout (a headline splits into an editorial page); image reveal (dark slats retract in a stagger); perspective shift (flat layers pull apart towards one vanishing point); glass focus (a lens row sharpens and magnifies, with chromatic fringes); flowing paths (pulses travel bezier connectors and nodes ring when they arrive); particle logo (particles fly in on bent paths and assemble a mark).
