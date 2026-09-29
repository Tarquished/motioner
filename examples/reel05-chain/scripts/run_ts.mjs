// Bundle a TypeScript file with esbuild and run it in node: node scripts/run_ts.mjs path/to/file.ts [args]
import esbuild from 'esbuild';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const file = process.argv[2];
fs.mkdirSync('out', {recursive: true});
const out = path.resolve('out', `run_${Date.now()}.mjs`);
await esbuild.build({entryPoints: [file], bundle: true, platform: 'node', format: 'esm', outfile: out, external: ['three', 'three/*'], loader: {'.json': 'json'}, logLevel: 'error'});
const r = spawnSync('node', [out, ...process.argv.slice(3)], {stdio: 'inherit'});
fs.rmSync(out, {force: true});
process.exit(r.status ?? 0);
