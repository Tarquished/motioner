# Motioner finished-film scorecard

Run the same prompt in fresh Codex and Claude Code sessions when comparing behavior. Record agent, model, prompt ID, date, output path, and whether the skill loaded. Judge the **encoded export**, not only source code or handpicked stills. Mark every hard gate **pass**, **fail**, or **unverified**. A failed gate blocks final acceptance; unavailable playback makes creative review unverified.

## Hard gates

| Gate | Evidence |
| --- | --- |
| Deliverable and technical contract | Full MP4 opens; target frames, fps, dimensions, codec, and required audio pass `verify_video.py`. |
| Source and rights | Read-only boundaries respected; each external asset used has source and license evidence. |
| Authentic identity | Visible official marks come from an authentic source; otherwise the identity is clearly presented as a concept. |
| Interaction cause and effect | Every visible interaction hits its target; the result is absent beforehand and begins after contact. Record before/contact/after frames. |
| Transition intent and color | Every requested seamless or morphing handoff has a traceable shared form or path and a coherent or deliberately motivated palette bridge; no abrupt unrelated hue, muddy midpoint, ghost text, or broken focal point. Record a verdict for each boundary. |
| Typography direction when relevant | Typography-led or branded work shows two candidate specimens and a selected system that remains readable at delivery size. |
| Asset presence | Claimed external visuals appear and claimed SFX are audible in the export; weak or filler assets are not counted as success. |
| Sound design coverage | Major visible contacts, state changes, reveals, and handoffs have purposeful sound or an intentional reason for silence; repeated cues do not dominate. |
| No severe defects | Core text is readable; no obvious blurred hero, clipping, sound clipping, detached cue, or accidental music cutoff. |
| Complete audiovisual review | Entire encoded video watched at normal speed and destination size, muted and with sound; otherwise mark unverified and label it a draft. |

## Quality ratings

Rate each **1–5**, with one concrete observation for scores below 4. Mark unseen or unheard categories **unverified**. Do not substitute a checklist or waveform for watching and listening.

| Category | Judge |
| --- | --- |
| Story and product fidelity | A new viewer understands the feature; real labels, states, and claims are accurate. |
| Interaction and microanimation | Actions are varied, responsive, and meaningful while preserving one focal point. |
| Seamless and morphing transitions | Forms, direction, speed, eye focus, palette, and contrast hand off creatively and smoothly without a repetitive template. |
| Typography | Font choice has character and brand fit while staying clean and readable at playback size. |
| Visual sourcing and integration | Chosen assets add specificity; crop, sharpness, edges, and style hold up in motion. |
| SFX coverage and variety | Meaningful actions and handoffs receive suitable, distinct sonic support without crowding. |
| SFX timing | Contacts, peak motion, and reveals sound synchronized in the final mix. |
| Mix and pacing | Music and cues balance; reveals have room to register; ending resolves. |

## Evidence log

For each visible interaction: target, before frame, contact frame, response frame, and after frame. For **each morph or seamless handoff**: boundary frames, shared carrier, start/midpoint/end palette swatches, motion and sound observation, **good/weak/unverified** verdict, and repair plus second verdict if weak. For each major cue: visual event frame, sound file, measured attack/peak, scheduled start, and what was heard. For each prominent visual asset: source, license, entry/hold/exit frames, and whether it remains sharp and fitting. For typography-led films: two candidate specimens, selected type system, and reason.

Run the regression prompt in `evals.json` after revisions. Compare the revised result with a previous result or no-skill run using this same scorecard. Static validity alone does not prove the agent will follow the skill or that a finished film will be good.
