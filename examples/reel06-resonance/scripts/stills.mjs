// Render selected frames as PNG stills: node scripts/stills.mjs 0 120 ... [--scale 0.5] [--sub 24] [--cam px,py,pz,lx,ly,lz,fov,shadowR] [--out out/stills]
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, def) => {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : def;
};
const scale = Number(opt('--scale', 0.5));
const outDir = opt('--out', 'out/stills');
const sub = Number(opt('--sub', 24));

const skip = new Set();
for (const n of ['--scale', '--out', '--sub', '--sub']) {
	const i = args.indexOf(n);
	if (i >= 0) skip.add(i).add(i + 1);
}
const frames = args.filter((a, i) => !skip.has(i)).map(Number);
const inputProps = {sub};
fs.mkdirSync(outDir, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const composition = await selectComposition({serveUrl, id: 'FilmSilent', inputProps, timeoutInMilliseconds: 180000});
for (const frame of frames) {
	const output = path.join(outDir, `f${String(frame).padStart(4, '0')}.png`);
	await renderStill({composition, serveUrl, output, frame, scale, inputProps, chromiumOptions: {gl: 'angle'}, timeoutInMilliseconds: 180000});
	console.log(output);
}
