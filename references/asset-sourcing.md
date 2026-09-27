# Source and evaluate external assets

Read when the film needs sound or visual assets from the internet. The client has authorized ordinary research, download, and adaptation for the video task, so do this proactively without a separate approval request for each candidate. Keep the media in the authorized production workspace and out of the reusable public skill package.

## Find candidates with a job in mind

1. Make an asset list from the shot and cue plan: what the viewer must see or hear, the approximate size and duration, and the role of each asset. Search for a small set of alternatives for important visual moments and sound events rather than taking the first search result.
   Keep an asset board by shot with candidate, reason selected or rejected, source, terms, and the actual rendered time range where the selected item appears.
2. For SFX, compare clean recordings of the right action: impact, whoosh, click, paper, riser, ambient texture, or other requested category. Listen to candidate files when possible. Check whether the sound has speech, hiss, excessive reverb, a long quiet lead-in, or a peak that occurs well after the event. Layer only when it adds an audible role.
   Build a sound map across the entire film: anticipation, contact, response, reveals, object movement, and transitions where audible support helps. Seek a varied set of textures instead of recycling one click and one whoosh. Do not fill every frame with noise.
3. For visuals, prefer authentic product art when demonstrating the product, then use external SVGs, PNGs, illustrations, photographs, textures, or footage where they add clarity or atmosphere. Compare silhouette, line weight, lighting, perspective, palette, transparency edges, and ability to crop or animate. Use the vector original when a close-up demands sharp edges; check that SVGs actually render correctly in the chosen pipeline.
4. Download only selected candidates and keep a manifest with source page, creator, license or permission evidence, local file, use in the film, and required credit. Confirm the specific asset's terms before use. A website being searchable or a client saying “you may use internet assets” does not grant rights from every creator. Prefer a different licensed asset when terms do not fit the intended publication. Avoid republishing stock files as a raw asset pack.
5. For a branded film, find authentic logo and style assets from a trustworthy source. If an official asset cannot be obtained, use a disclosed concept rather than fabricating a mark that looks official.

## Timing SFX against picture

- Record three positions separately: file start, audible attack, and strongest point. `scripts/analyze_sfx.py` gives an objective estimate of the last two. Listen when available; a numerical envelope cannot decide whether a sound *feels* synchronized.
- For a hit, set the audible attack at the contact frame. For a whoosh, put its strongest point near the highest visual speed. For a riser, aim its resolution at the reveal or cut. When a clip contains a quiet lead-in, either start the file earlier on purpose or trim it; never let an explosion become audible while the picture still shows an inert object unless a designed precursor is visible.
- Check these alignments on the **encoded final video** at normal speed, and inspect close frame ranges and an annotated waveform when correcting a mismatch. Re-export after retiming; a correct source timeline does not prove the final mux is in sync.

## Evaluate the chosen image in context

- Inspect the asset at the size and zoom it will have in the final video. A nominally high-resolution PNG may still have soft artwork or jagged transparency; a sharp SVG may render with wrong strokes, fonts, or clipping.
- Render the actual shot and inspect the asset in entry, hold, and exit frames at native pixels and phone size. Check crop, focal point, contrast behind type, visual consistency with neighboring shots, and whether the image looks like a generic placeholder. Replace or restyle it if it does not pass.
- Do not put source or license boilerplate into the image merely as production notes. Put required credit in the agreed publication location, and choose an alternative asset if that cannot satisfy its terms.

## Starting places to research, not blanket permissions

- [Mixkit sound effects](https://mixkit.co/free-sound-effects/) and its [SFX license](https://mixkit.co/license/modal/sfxFree/)
- [Kenney assets](https://kenney.nl/assets) and [license guidance](https://kenney.nl/support)
- [Pixabay media](https://pixabay.com/) and [content license summary](https://pixabay.com/service/license-summary/)
- [OpenMoji](https://openmoji.org/) and its [CC BY-SA FAQ](https://github.com/hfg-gmuend/openmoji/blob/master/FAQ.md)

Read current terms for the actual download. These sources have different limits and credit requirements; the list is a starting point, not an assertion that every file is interchangeable.
