---
name: motioner
description: Direct, build, revise, and verify finished motion graphics and product videos, usually with Remotion. Use for animated demos, feature tours, kinetic type, and branded films where scene handoffs, morphing, typography, sourced visuals, sound design, and a reviewed video matter. Do not use for a static design or ordinary webpage animation.
---

# Motioner

Deliver a film whose actions, transitions, type, imagery, and sound make sense together. Remotion is a strong default; use another tool when it serves the shot better. The current brief overrides this skill's taste defaults.

## Set the production contract

- Record audience, message, reference media, source boundaries, aspect ratio, dimensions, fps, duration or frame count, codec, audio and speech rules, and delivery location. For an exact runtime, derive the target frame count before production and share one frame-based timing source across picture, cues, and verification.
- Inspect accessible references and the actual product before scripting a demo. Verify visible labels, claims, brand identity, and interaction states. Distinguish authentic footage or UI from illustrative states; never invent an official-looking logo. If official identity assets are unavailable, use a clearly identified concept treatment.
- The user's permission to use internet assets authorizes ordinary research, download, and adaptation for the film without asking about each file. Source suitable online SFX and consider external images, vectors, PNGs, footage, and textures when they improve a shot. Check each asset's publication terms and document its source. Read [asset sourcing](references/asset-sourcing.md) for the selection and manifest workflow.

## Design before polishing

Make a compact treatment and frame-level shot plan. Each shot needs a focal point, meaningful change, readable hold, and exit. For every visible product interaction, specify the target, contact frame, state before, immediate reaction, and state after. The target must be hit and the result must follow the action; an already-visible result does not count. Give major interactions anticipation, contact, response, and settle, varying the treatment rather than repeating one cursor ring.

Map every scene handoff: outgoing and incoming elements, eye focus, motion direction, shared visual carrier, and why the change advances the story. Plan the carrier's shape, position, scale, **color role**, and background colors at the start, midpoint, and end. Pair compatible colors or design a visible, motivated color bridge; avoid an arbitrary hue jump or flash that makes a morph feel disconnected. Proactively use a genuine morph where two meaningful forms can connect; in a multi-scene film with a suitable pair, include at least one. A whole-frame crossfade or panel slide alone does not satisfy a morph request. Use an intentional cut when it is stronger than a morph. Read [transition and interaction design](references/transition-design.md) when the film has several scenes or visible interactions.

Choose a type system deliberately. For typography-led or branded work, compare at least two suitable, usable font candidates with real title and UI specimens at delivery size; inspect glyph coverage, licensing, weight, spacing, readability, and product fit. Do not accept a default system font merely because it is available. Keep the result expressive and clean. Read [typography direction](references/typography.md) when type materially shapes the film.

Build an asset board and sound map from the shot plan. Give important sounds a visible role: interaction contact, state change, reveal, object motion, and scene handoff. Use enough distinct, well-chosen cues to support the film's actions; avoid both empty motion and a blanket cue quota. Compare candidates, listen where possible, and vary repeated sounds. Record which sourced visuals and sounds actually appear in the export.

## Animate and review the result

- Make motion deterministic from the render frame. In Remotion, derive state from the current frame; if using GSAP, seek its timeline from that frame. Use suitable path morph, SVG, masks, or other techniques as needed. Preserve readable holds, stable text layout, safe areas, and sharp imagery at the final zoom.
- Measure selected SFX attack and peak with `scripts/analyze_sfx.py` when FFmpeg is available. Place audible attack at visible contact, whoosh peak near fastest motion, and riser resolution at reveal. Then judge timing and balance by listening to the encoded video; waveform alignment alone is insufficient.
- Render a whole-film animatic, then review **each** morph and seamless handoff individually in a short loop and in the whole film. Compare start, intermediate, and end frames for shape tracking, focal point, speed, palette continuity, readability, and sound. Mark each handoff good, weak, or unverified with a concrete reason; revise weak transitions and review their new encoded frames. Also check interaction cause and effect, typography, image quality, cue coverage, and pacing. Watch the complete encoded film at normal speed and destination size, muted and with sound. Read [review checks](references/review-checks.md).
- Probe the delivered file for frame count, duration, dimensions, fps, codec, pixel format if required, and audio using `scripts/verify_video.py` when FFprobe is available. Technical passing does not prove creative quality. If full picture and sound playback was unavailable, mark creative review **unverified** and deliver as a draft for human review rather than a verified final.

For an open-ended branded product film, [direction profile](references/direction-profile.md) provides optional taste defaults. Consult current Remotion documentation or installed Remotion skills for API details.
