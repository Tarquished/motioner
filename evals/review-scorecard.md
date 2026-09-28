# Motioner scorecard

Judge the **encoded MP4**. Record agent, model, prompt id, date, output path. Each hard gate is pass / fail / unverified; a fail blocks acceptance.

## Hard gates

| Gate | Evidence |
|---|---|
| Technical contract | `verify_video.py` PASS: size, fps, exact frames, h264, yuv420p, audio as long as video |
| Carrier contract | For every morph: no frame where source + target (or two copies) are visible; no element missing for a frame; no HANDOFF-JUMP (plan lists exact `handoffs`); animated content inside carriers stays live; shadows, glows and decorations identical across the handoff; zoomed crops of start-1..start+1 and end-1..end+1 checked |
| Smooth motion | No POP/STUTTER/HITCH/FLASH/BLANK/COLORJUMP left unexplained in `transition_review.py`; speed curves one hump per gesture |
| Written verdict per boundary | Every boundary: good/weak/broken with frames and cause; weak ones fixed and re-verdicted |
| Colour bridge | No muddy or arbitrary midpoint; carrier readable against the background at 50 % |
| Text | No ghost text, letter soup, re-wrapping or clipped captions |
| Interaction | Every click hits its target; result absent before contact, visible right after |
| SFX sync | `sync_check.py` on the delivered file: all cues within half a frame, no constant offset, every MASKED? resolved |
| SFX fit | Synthesized per event with `synth_score.py` (or found candidates screened with `sfx_scan.py`); no riser/slow swell on hard contacts; whoosh peaks on measured fastest frames; no flams |
| Mix | Music 8 to 10 LU under the mix (6 to 8 for a synthesized bed); no masked-cue warnings; true peak <= -1.5 dBTP; limiting <= 4 dB |
| Music edit | Cuts on bar lines with crossfades; the film ends on the song's own ending or a designed fade |
| Assets | Manifest with source/licence for every external file; nothing fabricated as an official logo |
| Honesty | States what was measured vs seen vs heard; unheard audio is called unverified |

## Quality (1 to 5, one concrete observation under 4)

| Category | Judge |
|---|---|
| Concept | A seed that keeps transforming; every chapter born out of the last; a bookend; compare with references/reference-films.md |
| Rhythm | Chapter changes on beats; acceleration before the logo; silence before the drop; end card held |
| Type that acts | Important words behave like their meaning; statements big enough at phone size |
| Morph creativity | Recipes fit what the scenes share; varied across the film |
| Seamlessness | The eye rides one object across every boundary |
| Motion feel | Curves suit their role; anticipation, settle, secondary motion; nothing stiff or floaty |
| Liveliness vs readability | Nothing dead; text still while read; one focal event at a time |
| Sound coverage and variety | Every meaningful motion supported; repeated actions varied |
| Sound timing feel | Hits feel on the frame at normal speed (human check) |
| Typography | Distinctive but clean; readable at phone size |
| Story | A new viewer understands what the product does |

## Regression

Run evals 1 and 2 after every skill change and compare against `examples/papertrail` (its README lists the glitches the review must catch).
