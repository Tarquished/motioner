// Bundle src/events.ts with esbuild and print its JSON to audio/events.json (one clock: the score reads what the picture computes).
import {buildSync} from 'esbuild';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const out = buildSync({
	entryPoints: ['src/events.ts'],
	bundle: true,
	platform: 'node',
	format: 'cjs',
	write: false,
	loader: {'.json': 'json'},
	external: ['remotion', 'react', 'react-dom'],
});
const code = out.outputFiles[0].text;
const m = {exports: {}};
new Function('require', 'module', 'exports', code)(createRequire(import.meta.url), m, m.exports);
fs.mkdirSync('audio', {recursive: true});
fs.writeFileSync('audio/events.json', JSON.stringify(m.exports.buildEvents()));
console.log('audio/events.json written');
