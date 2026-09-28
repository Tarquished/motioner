// Render selected frames as PNG stills: node scripts/stills.mjs 0 120 274 290 ... [--scale 0.5] [--out out/stills]
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

const args = process.argv.slice(2);
const scaleAt = args.indexOf('--scale');
const scale = scaleAt >= 0 ? Number(args[scaleAt + 1]) : 0.5;
const outAt = args.indexOf('--out');
const outDir = outAt >= 0 ? args[outAt + 1] : 'out/stills';
const skip = new Set([scaleAt >= 0 ? scaleAt + 1 : -1, outAt >= 0 ? outAt + 1 : -1]);
const frames = args.filter((a, i) => !a.startsWith('--') && !skip.has(i)).map(Number);
fs.mkdirSync(outDir, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const composition = await selectComposition({serveUrl, id: 'PapertrailSilent'});
for (const frame of frames) {
	const output = path.join(outDir, `f${String(frame).padStart(4, '0')}.png`);
	await renderStill({composition, serveUrl, output, frame, scale, chromiumOptions: {gl: 'angle'}});
	console.log(output);
}
