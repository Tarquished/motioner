# Example: Papertrail (14.55 s, 1080 x 1920, 60 fps)

A fictional notes app, built to exercise every Motioner transition type and reviewed with the Motioner scripts. It is the regression film for the skill.

| Boundary | Recipe | Frames | Verdict after review |
|---|---|---|---|
| seven sticky notes become one card | converge + container carrier (rotated yellow note to white card, lift) | 274-314 | good |
| "Notes everywhere?" to "All in one place." | text roll (no travelling letters) | 280-326 | good |
| card expands into the detail screen; title and 3 rows travel on their own carriers | container morph + child carriers with `delay` | 445-483 | good |
| Share button floods the frame blue | `FloodReveal` from the button, single `ease.expand` curve | 549-597 | good |
| three avatars converge into a circle that becomes the paper-plane logo | converge + `PathMorph`; caption rolls into the wordmark | 686-752 | good |
| logo stamp on the song's own ending | spring pulse + burst lines | 823 | good |

Glitches found by the review and fixed on the way (all now in the skill's rules): letter soup from pairing single letters between unrelated captions; wordmark letter spacing doubled because glyphs were measured with `getBoundingClientRect` under a scale; two rows vanishing for 2 frames because staggered carriers started late; a ghost title because the container carrier still carried the travelling title; the touch ripple floating above the flood (`zIndex`); a flood that popped and then stalled (spliced punch/creep curve); a washed-out merge midpoint (colour change too early, no lift); a dead 0.3 s of plain blue after the flood; the ring completing on the same frame as the Share press; every SFX 42.7 ms late in the MP4 (renderer AAC priming) until the WAV was muxed with FFmpeg; full-range `yuvj420p` output.

A later review with the local detectors (HANDOFF-JUMP) found three more handoff glitches the first review had missed and they were fixed: the touch indicator vanishing at the card expand (the carriers' z-index covered it), the "Share" label cut by the flood's first frame, and (in the Motioner film) frozen carrier content.

Result: 52 cues from 21 sounds, 52/52 within half a frame in the delivered MP4 (median 0.0 ms), -15.8 LUFS, -1.59 dBTP, music 8.9 LU under the mix.

Evidence: `review/film.png` (whole film, muted), `review/0*_*.png` (per-transition sheets with flags and speed curves), `review/audio-timeline.png`.

## Run it

```
npm install
npm run setup     # copies templates/remotion into src/motioner and downloads the sounds/music (Mixkit, Kenney CC0)
npm start         # Remotion Studio
npm run build     # cues -> mix -> muted render -> FFmpeg mux -> verify -> sync check -> transition review
```

Python: `pip install numpy scipy pillow opencv-python librosa`.

Music: "Close Up" (Mixkit #1167), bar 9 for two bars, then the last phrase from bar 37 to the song's own ending at 91.52 s, which lands on the logo stamp (frame 823). SFX: Mixkit #2607, 1461, 3115, 2577, 2568, 2369, 2870, 2608, 2350, 3192, 2633, 3082, 2344; Kenney casino-audio card slide/place, interface-sounds select/pluck/drop, impact-sounds impactSoft_heavy (CC0).
