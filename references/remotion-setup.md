# Remotion setup for Motioner films

Read when starting a project. Check current Remotion docs for API changes (`https://www.remotion.dev/docs`); the official agent skill `remotion-best-practices` (github.com/remotion-dev/skills) is a good companion.

## Project

```
npm init -y
npm i remotion @remotion/cli @remotion/paths @remotion/shapes @remotion/motion-blur @remotion/transitions \
      @remotion/layout-utils react react-dom flubber
npm i -D typescript @types/react
# fonts, e.g.
npm i @fontsource-variable/bricolage-grotesque @fontsource-variable/inter-tight
```

Keep all Remotion packages on the exact same version. Copy the kit:

```
src/motioner/motion.ts  Morph.tsx  transitions.tsx  flubber.d.ts   (from templates/remotion)
scripts/build.mjs                                                  (edit CONFIG)
```

Layout:

```
src/timeline.json      every event frame: the one clock (picture, cues, review plan read it)
src/Root.tsx           <Composition id="Film"> with audio and "FilmSilent" without, same props
src/Film.tsx           scenes as functions of `frame`
transitions.json       review plan for transition_review.py
scripts/make_cues.py   timeline -> audio/cues.json
research/              downloaded candidates + manifest (not rendered)
public/audio/mix.wav   written by build_mix.py
```

`remotion.config.ts`:

```ts
import {Config} from '@remotion/cli/config';
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setChromiumOpenGlRenderer('angle'); // GPU; fall back to 'swangle' if it fails
```

## Fonts: hold the render until they are real

```tsx
const FontGate: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [handle] = useState(() => delayRender('fonts'));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all([document.fonts.load("760 92px 'Bricolage Grotesque Variable'"),
                 document.fonts.load("560 40px 'Inter Tight Variable'")])
      .then(() => { setReady(true); continueRender(handle); });
  }, [handle]);
  return ready ? <>{children}</> : null;
};
```

Wrap the film in it. `LetterMorph` also waits for `document.fonts.ready` before measuring.

## Determinism

- Everything derives from `useCurrentFrame()`. No CSS `transition`/`animation`, `setTimeout`, `Date`, `Math.random()` (use `rand(seed)`).
- If using GSAP, build a paused timeline and `seek(frame / fps)` each render.
- Measure DOM layout only once (after fonts), with `offsetLeft/offsetWidth`; screen boxes include the current transforms.
- Stack layers by render order; avoid global `zIndex` on overlays.

## Rendering

- Stills for inspection: bundle once and call `renderStill` for many frames (see `examples/papertrail/scripts/stills.mjs`).
- Draft/final: `node scripts/build.mjs` renders muted H.264 (`--pixel-format yuv420p --color-space bt709`), muxes the mix with FFmpeg (AAC 256k, `-t` exact duration, `+faststart`) and runs verify, sync and transition review.
- Heavy zooms: render with `--scale 2` into a master, then downscale with Lanczos for delivery; or use `SharpZoom` layers.
- Long films: render in chunks (`--frames=a-b`) and concatenate; lower `--concurrency` if Chrome runs out of memory.
- Remotion ships FFmpeg/FFprobe in `node_modules/@remotion/compositor-*`; the Motioner scripts find them automatically. That FFmpeg lacks some filters (no rawvideo muxer, no ebur128), so the scripts decode with OpenCV or PNG pipes and measure loudness in Python.

## Python tools

`pip install numpy scipy pillow opencv-python librosa` (librosa optional, improves beat tracking).
