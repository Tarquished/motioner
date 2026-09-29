// Bundle src/events.ts with esbuild and write audio/events.json (numbers the picture computes: contacts, speeds, notes).
import esbuild from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
fs.mkdirSync('audio', {recursive: true});
fs.mkdirSync('out', {recursive: true});
const out = path.resolve('out', 'events_bundle.mjs');
await esbuild.build({entryPoints: ['src/events.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, external: ['three', 'three/*'], loader: {'.json': 'json'}, logLevel: 'error'});
const mod = await import(pathToFileURL(out).href + '?t=' + Date.now());
fs.writeFileSync('audio/events.json', JSON.stringify(mod.events_out));
console.log('audio/events.json', mod.events_out.events.length, 'events');
