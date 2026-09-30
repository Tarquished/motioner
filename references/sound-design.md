# Sound design: the right sound, on the right frame

Read before making or sourcing any audio and before building the mix. Scripts: `synth_score.py`, `sfx_scan.py`, `beat_grid.py`, `build_mix.py`, `sync_check.py`.

## 0. Default: write the sound in code (`synth_score.py`)

The benchmark films credit "every frame and every sound written in code", and their spectrograms show it: pads and plucks in one key, a kick on every beat frame, noise risers whose top is the reveal, whooshes whose loudness follows the picture's speed, a tick per UI element, a full silence before the drop. Synthesized sounds fit by construction (length, key, envelope, alignment), so the usual "wrong SFX" problems below cannot happen. Use found audio only when the brief asks for a real track, real foley or a voice.

```
python scripts/make_score.py                       # per project: timeline -> audio/score.json
python scripts/synth_score.py audio/score.json --out audio/synth
python scripts/build_mix.py audio/synth/cues.json --out public/audio/mix.wav
python scripts/sync_check.py out/film.mp4 public/audio/mix.cues.json --root audio/synth
```
(`build.mjs` runs all of it when `makeScore` is set.) Score format and sound types are in the script's header. Map events like the benchmark does:

| Picture | Sound (`type`) | Frame |
|---|---|---|
| The seed appears / an element pops in | `pop` (degree in the key) | first visible frame |
| Each bounce, each item of a set arriving | `pluck` or `pop` climbing the chord (degrees 0, 2, 4, 7) | contact frame |
| The drop (first flood, big reveal) | `riser` ending 5 frames early (inside the silence gap), `impact` on the frame; the section is `"drop": true` | flood start |
| A camera zoom or dive | `zoom` with `speed` = the camera's log-zoom per frame (exported from the picture's own camera): the arrival chord (`bar`) as pure tones gliding up an octave with the zoom's progress and settling onto the chord tones as it lands, amplitude = the smoothed zoom speed, nothing above 2 kHz (default `style: "glide"`); `sync: false`. Avoid bright, wide sweeps: a Shepard glissando was rejected as uncomfortable | dive start |
| A flood's edge, a camera move, a carrier flight | `whoosh` with `frame` = measured fastest frame, `frames` = move length; or `start` + `speed` from `speedCurve()` so the envelope is the move | fastest frame |
| A word slamming in | `thud` (low) | landing frame |
| A shape changing | `stab` (chord) | morph start (on the beat) |
| Typing | `type` with `frames` = `typeFrames()` of the same text | each character |
| Click / press | `click`, then `burst` 2 frames later if something pops | contact |
| Montage cut | `glitch` on alternate cuts (the `montage` kit has stabs on every half beat) | cut frame |
| Logo lands | `impact` + `sub`; a `chime` on the tagline; soft `pop` pulses on later beats | landing frame |

Levels: `under_mix_lu` 6 to 8 for a synthesized bed (the music is part of the design, as in the references), effects still clearly over it (build_mix reports each cue's margin). Pitched sounds use the score's key so nothing clashes. Repeated small sounds get three takes automatically; still space them at least 4 frames apart.

Most "wrong SFX" problems with found audio are one of four things: the wrong **shape** for the action (a slow rustle on a hard landing), a **lead-in** that makes it late, placement by **file start** instead of by attack/peak, or a **mux/encode offset**. Each has a measurement; use them before and after placing.

## 1. Map every sound to a visible event (found audio)

Write the sound map from the timeline, event by event:

| Visible event | Role (`sfx_scan --role`) | Align point on the frame | Typical search words |
|---|---|---|---|
| Object lands, card placed, sticker slap | `impact` / `paper` | attack on contact frame (`hit`) | card place, card slide, paper tap, soft impact, thud |
| Tap / click / toggle | `click` | attack on press frame (`hit`) | interface click, UI tap, select, switch |
| Checkbox fills, chip appears, badge | `pop` / `tick` | `hit` 1 to 3 frames after contact | pop, pluck, drop, select, bubble |
| Object flies / camera moves / carrier morph | `whoosh` / `swish` | peak on the fastest frame (`peak`) | whoosh, swoosh, swish, air, sweep, transition |
| Reveal, flood, zoom-through | `whoosh` (+ `riser` before, soft `impact` or `reward` at the end) | peak mid-reveal; riser `end` on the reveal frame | sweep, magic sweep, vacuum, riser, reverse |
| Reward, success, logo landing | `reward` / `success` | `hit` on the landing | sparkle hit, chime, correct, bell, notification |
| Explosion, big hit | `boom` | `peakcut` (lead-in removed) on the bang | explosion, impact, bass hit, boom |
| Typing | `tick` / `click` (varied takes, pitch steps) | `hit` per key | keyboard, key press, soft click |
| Writing, strike-through | `paper` | `hit` at the start of the stroke | pencil, scribble, marker |

Density: in a product demo, every meaningful motion and state change gets a sound (1.5 to 4 cues per second is common), with variation and short silences. Use 2 to 3 takes per repeated action and vary pitch 3 to 12 % (`rate`), pan small objects by their screen position.

## 2. Find candidates (internet allowed)

Download several candidates per role, then screen. Log every file (source URL, creator, licence, date) in the asset manifest.

| Source | Access that works without a login | Licence (check the file page) |
|---|---|---|
| Mixkit SFX | category pages `https://mixkit.co/free-sound-effects/<category>/` list ids and titles; file: `https://assets.mixkit.co/active_storage/sfx/<id>/<id>-preview.mp3` | Mixkit Sound Effects Free License: use in videos, no attribution; do not redistribute raw files |
| Mixkit music | `https://mixkit.co/free-stock-music/tag/<tag>/`; file: `https://assets.mixkit.co/music/<id>/<id>.mp3` | Mixkit Stock Music Free License (video use; read current terms) |
| Kenney audio packs | `https://kenney.nl/assets/<pack>` links a zip (`casino-audio`, `interface-sounds`, `impact-sounds`, `ui-audio`, `digital-audio`, `rpg-audio`) | CC0 |
| Freesound | search with the CC0 licence filter; previews are HQ MP3; originals need a free account/API key | per file: prefer CC0, CC-BY needs credit |
| Pixabay sound effects / music | usually needs a browser (bot protection) | Pixabay Content License; check each track's Content ID note |
| Sonniss GDC bundles | large zips, royalty-free for commercial use | Sonniss licence |
| The product's own sounds | its repo or site assets | the owner's |

Avoid: BBC Sound Effects (RemArc, non-commercial), anything "free" without a licence page, tracks flagged for Content ID when the film goes to social media.

Useful Mixkit categories: `paper`, `whoosh`, `swoosh`, `transition`, `click`, `pop`, `interface`, `notification`, `magic`, `impact`, `game`, `tech`. Kenney `casino-audio` has excellent card place/slide sounds for paper and cards; `interface-sounds` has clean select/pluck/drop ticks; `impact-sounds` has soft thuds.

## 3. Screen before placing (`sfx_scan.py`)

```
python scripts/sfx_scan.py research/sfx/*.mp3 --role whoosh --motion-frames 36 --fps 60 --cards review/sfx
```

It reports shape (transient, swell, riser, double, sustain), lead-in, hit (attack at half peak), peak, attack time, audible length, brightness, noise floor, and a verdict against the role and the move length. It also writes sound cards (spectrogram + envelope with hit/peak marked) so you can compare candidates by eye.

Reject:
- a `riser` or long swell for a hard contact (feels late),
- a `double` hit where one hit is needed (flams),
- a whoosh much shorter than the move (air stops while the object still flies) or one that swells for longer than the move (air before anything moves),
- noise floor above about -45 dB under the peak (hiss) unless it is an ambience,
- dark clicks (centroid under ~1.2 kHz) for clean UI.

Varispeed (`rate`) can fit a whoosh's length to a move (0.7 to 1.4; pitch shifts with it).

## 4. Place on the frame (`build_mix.py`)

Generate `audio/cues.json` from the same timeline as the picture (a small script, see `examples/papertrail/scripts/make_cues.py`). For whooshes, use the **measured** fastest frame from `transition_review.py` (the `motion events ... @peak` line), not the planned start.

```json
{"frame": 283, "sound": "air", "align": "peak", "rate": 1.1, "label": "notes fly into one card"}
{"frame": 314, "sound": "land", "align": "hit", "gain_db": -8, "label": "card lands"}
{"frame": 1637, "sound": "boom", "align": "peakcut", "label": "bomb explodes"}
```

- `hit`: the attack (first moment at half peak) lands on the frame. Contacts, clicks, pops, chimes.
- `peak`: the loudest 15 ms lands on the frame. Whooshes on the fastest frame.
- `end`: a riser's peak/resolution lands on the reveal.
- `peakcut`: everything before the peak is cut, so nothing sounds early (booms and cinematic hits whose peak is 0.5 to 1.5 s into the file).
- Never `start` for anything with a lead-in; `sfx_scan` shows the lead-in.

Roles set default levels and music ducking; adjust with `gain_db` per cue. Aim (reported by build_mix) for: ticks/clicks +6 to +11 dB over the music, pops +8 to +12, whooshes +10 to +16, rewards/impacts +12 to +18. build_mix warns when a cue is under +2 dB (masked).

## 5. Music

- Choose for fit: tempo that suits the edit (90 to 125 BPM for product demos), steady energy, no vocals, a real ending. Compare 3+ candidates by measurement (`beat_grid.py`: tempo stability, bar-phase votes, energy per bar) and describe the choice honestly if you cannot listen.
- `beat_grid.py track.mp3 --fps 60 --json grid.json --png grid.png` gives beats, bars, phrases, accents, quiet breaks and the final hit in frames. It corrects the onset detector's lag, but the bar phase can be one beat off: check the PNG, confirm with the phrase structure, override with `--downbeat`.
- Edit on bar lines (ideally phrase starts) with 30 to 40 ms equal-power crossfades: e.g. two bars from the start of a lift, then jump to the last phrase so the film ends on the song's real ending. Never chop the end or time-stretch.
- Keep the bed well under the effects: `"under_mix_lu": 9` in the cue sheet (8 to 10 LU under the mix). Duck under whooshes (3 dB), impacts (5), rewards (4), booms (9).

## 6. Master and mux

- `build_mix.py` targets -14 LUFS with true peak under -1.5 dBTP, but lowers the target rather than limiting more than `max_limiting_db` (default 4 dB): crushed clicks sound worse than a slightly quieter file, and platforms normalise loudness.
- Render the picture muted and mux the WAV with FFmpeg's AAC encoder (`build.mjs`). Letting the renderer encode the audio was measured to delay every cue by 42.7 ms (the AAC priming, 2048 samples) and to make the audio longer than the video.

## 7. Prove sync in the delivered file

```
python scripts/sync_check.py out/film.mp4 public/audio/mix.cues.json --root .
```

Each cue is found by cross-correlation near its planned time (for a sound repeated nearby, such as typing, the search stays within 45 % of the gap to its next copy so it cannot lock onto a neighbour) and its alignment point is compared with the event frame. Every cue should be within half a frame (8 ms at 60 fps, 17 ms at 30 fps; default tolerance 12 ms). A constant offset on all cues means the mux/encode is wrong, not the cue sheet. `MASKED?` means the cue barely exists in the mix (too quiet, or buried under a simultaneous louder cue): raise it, move it, or drop it. Two cues flagged at the same frame usually reveal two events competing for attention: fix the picture timing.

## Honest listening

If you cannot hear audio, say so. Build on measurements (shape, alignment, sync, level over music, loudness, true peak), export the stems (`mix.music.wav`, `mix.sfx.wav`) and a short excerpt around the densest moment for the user, and name the subjective judgements you could not make.


## Physical-event instruments (cause-chain films)

`scripts/synth_machine.py` (loaded by `synth_score.py`) makes one sound per physical event: `tock` (wood mallet), `pin`, `roll` (noise that follows a measured speed curve, texture at the rotation rate; give `speed` per frame and `r`), `clack` (dry click plus a marimba note, `midi`), `slam`, `launch`, `button`, `wave` (a warm chord that blooms with a wave of light), `zap` (a rising chirp for a pulse along a cable, `frames`), `led`, `pawl`, `cradle` (steel tick plus one chord tone per ball, `notes`), `paddle`, `gear` (one tick per tooth, `tone`), `lever`, `motor` (`frames`), `mbox` (music-box tooth, `midi`), `letter` (thud plus a chord tone), `period`, `tap`. All are soft (centroid 0.8 to 2.6 kHz). Feed them from an events file exported by the picture's own code (`references/chain-technique.md`). Keep the bed far under the mix (`under_mix_lu` 12 to 13) when the machine is the music, mark diffuse cues `sync: false`, and check melodic notes with a band-pass onset test on the delivered audio when cross-correlation is ambiguous.

## Epic instruments (finale films: `scripts/synth_epic.py`, `make_score.py` of `examples/reel06-resonance`)

For a film whose hits should make people say "wow". Types: `boom tutti choir rewind revswell shock ping tick_land sand glide drum bellrun stab_hit sweep lockclick`, and a music bed built from kits (`music_engine: "epic"`: drone, space, heart, groove, build, montage, together, finale, outro) with `gaps` (frames that get 90 ms of silence in the music) and `epic` sections.

- **A boom is layered, every layer has a job**: sub (a sine that falls from 3.2x the root to the root, saturated; weight), its second harmonic (audible on a phone), thump (body), low-passed noise, a hp-noise crack + a 1.8 kHz click (attack), a tuned inharmonic ring in the bar's chord (colour), band noise (air). The reverb send is **high-passed at 180 Hz**: a reverb on the sub only makes mud and out-of-phase bass.
- **Tutti** = boom + choir (formant-filtered saws on the chord, `ah` vowel at 800/1150/2900 Hz, breath) + brass + a cascade of bells + crash. Use it on the four or five moments the film is about; give every other hit a lower size.
- **Time reversal**: the sound of a rewind is the first seconds of a boom played backwards (it swells into the hit), plus a rising glide and a hiss, aligned by its END, ending 90 ms before the hit (the silence is what makes the hit hit). Ring landings are computed from the picture's own time warp (`make_score.py`), so the ticks land on the frame each ring reaches the letters.
- **Mono bass**: collapse everything below 150 Hz to mono in every sound and the bed (`mono_bass` in `synth_score.py`). The first mix had a side/mid ratio above 1 in the sub (decorrelated reverb) and a bass share of 90 %: measure it with `film-res/scripts/analyze_mix.py` (band shares and stereo per half second) and lower the sub until the low band is about half of the energy at a hit and a third in the bed.
- **Dynamics are the wow**: a hum that starts at -46 dBFS, a 90 ms hole, then the hit; quiet after the biggest hit of the middle; a second hole before the last hit. Keep the bed 12 to 13 LU under the mix and let ducking (`role: boom`, 9 dB) carve room.
- A hum whose energy is all below 90 Hz does not exist on a laptop: put most of a drone's energy at 2x to 4x the root.
