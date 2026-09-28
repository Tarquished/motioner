# Visual assets and the manifest

Read when the film needs images, icons, logos, textures or footage from outside the product. Sound sourcing is in [sound design](sound-design.md).

When the user allows internet assets, research and download without asking per file, inside the project's `research/` folder. Every file you keep gets a manifest line.

## Choose with a job in mind

1. List what each shot must show and at what size, before searching.
2. Prefer, in order: the product's own assets (real UI, logo, illustrations), official brand kits and press pages, then licensed libraries.
3. Compare 2 to 4 candidates per important visual: silhouette at small size, line weight and style against the product's own art, palette, transparency edges, and whether it can be animated (vector > high-res PNG > photo).
4. Place the chosen asset in the actual shot and look at entry, hold and exit frames at 100 % and at phone size. Replace it if it looks soft, generic or off-style.

## Sources that work

| Need | Source | Licence notes |
|---|---|---|
| Icons | Lucide, Tabler, Phosphor, Material Symbols (SVG) | MIT / Apache: fine; keep stroke width consistent with the product |
| Emoji-style illustration | OpenMoji (SVG), Twemoji, Noto Emoji | OpenMoji CC BY-SA (credit), Twemoji CC BY, Noto Apache |
| Illustrations | unDraw, Open Peeps, Humaaans, Storyset | per-site licences; check attribution |
| Photos, video, textures | Pexels, Unsplash, Pixabay, Mixkit video | their free licences; no trademark or model-release guarantees |
| Logos | the brand's official press kit, Wikimedia Commons SVG (check trademark use) | trademarks: show only for the brand itself or with permission |
| 3D/abstract backgrounds | build them in code (gradients, noise, shapes) when possible | yours |

Never fabricate an official-looking logo. If the real mark is unavailable, present a clearly conceptual wordmark.

## Using assets well

- SVG for anything that scales or morphs; convert PNG icons to SVG only if you can trace them cleanly.
- Keep a transparent margin around cut-outs; check edges on both light and dark backgrounds.
- Photos need a focal point that survives the crop and the camera move.
- Treat library art with the film's palette (tint, duotone, stroke width) so it does not look pasted in.

## Manifest (`docs/asset-manifest.md`)

| File | Source URL | Creator | Licence | Downloaded | Used where (frames) | Credit needed |
|---|---|---|---|---|---|---|

Put required credits in the agreed place (post description, end credits if the brief wants them), not as production notes on screen. Keep downloaded raw files out of any public repository whose licence forbids redistribution.
