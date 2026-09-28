// Motioner build pipeline for a Remotion film. Copy to scripts/build.mjs and edit CONFIG.
//   1. cue sheet -> mastered mix.wav (sample-accurate, build_mix.py)
//   2. render the picture WITHOUT audio (muted)
//   3. mux mix.wav with FFmpeg's AAC encoder (-> correct priming/edit list, exact duration)
//   4. verify stream properties, check SFX sync in the delivered file, review every transition
// Why step 3: letting the renderer encode audio can leave the AAC priming delay uncompensated
// (measured +42.7 ms, every cue 2.5 frames late at 60 fps) and the audio longer than the video.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CONFIG = {
	entry: 'src/index.ts',
	composition: 'FilmSilent', // a composition WITHOUT <Audio>
	timeline: 'src/timeline.json', // must contain fps, width, height, durationInFrames
	cues: 'audio/cues.json', // written by your make_cues script from the same timeline
	makeCues: 'scripts/make_cues.py', // or null
	mix: 'public/audio/mix.wav',
	transitions: 'transitions.json', // [{name,start,end,kind}] for transition_review.py
	out: 'out/film.mp4',
	skillScripts: process.env.MOTIONER_SCRIPTS ?? path.join(process.env.HOME ?? process.env.USERPROFILE ?? '', '.claude/skills/motioner/scripts'),
	concurrency: 6,
	gl: 'angle', // GPU through ANGLE; use 'swangle' if the GPU path fails
	extraRenderArgs: [], // e.g. ['--scale', '2'] for a supersampled master
};

const TL = JSON.parse(fs.readFileSync(CONFIG.timeline, 'utf8'));
const py = process.platform === 'win32' ? 'python' : 'python3';
const run = (cmd, args) => {
	console.log(`\n> ${cmd} ${args.join(' ')}`);
	execFileSync(cmd, args, {stdio: 'inherit', shell: process.platform === 'win32' && cmd === 'npx'});
};
const s = (name) => path.join(CONFIG.skillScripts, name);
const ffmpeg = (() => {
	const dir = path.join('node_modules', '@remotion');
	for (const d of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
		const p = path.join(dir, d, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
		if (d.startsWith('compositor-') && fs.existsSync(p)) return p;
	}
	return 'ffmpeg';
})();

fs.mkdirSync(path.dirname(CONFIG.out), {recursive: true});
const tmpVideo = CONFIG.out.replace(/\.mp4$/, '.video.mp4');
const seconds = (TL.durationInFrames / TL.fps).toFixed(6);

if (CONFIG.makeCues) run(py, [CONFIG.makeCues]);
run(py, [s('build_mix.py'), CONFIG.cues, '--out', CONFIG.mix, '--root', '.']);
run('npx', ['remotion', 'render', CONFIG.entry, CONFIG.composition, tmpVideo, '--codec', 'h264', '--crf', '16',
	'--pixel-format', 'yuv420p', '--color-space', 'bt709', '--muted', '--gl', CONFIG.gl, '--concurrency', String(CONFIG.concurrency), ...CONFIG.extraRenderArgs]);
run(ffmpeg, ['-y', '-v', 'error', '-i', tmpVideo, '-i', CONFIG.mix, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k',
	'-t', seconds, '-movflags', '+faststart', CONFIG.out]);
run(py, [s('verify_video.py'), CONFIG.out, '--width', String(TL.width), '--height', String(TL.height), '--fps', String(TL.fps),
	'--frames', String(TL.durationInFrames), '--codec', 'h264', '--pixel-format', 'yuv420p', '--require-audio']);
const cueReport = CONFIG.mix.replace(/\.wav$/, '.cues.json');
try {
	run(py, [s('sync_check.py'), CONFIG.out, cueReport, '--root', '.']);
} catch {
	console.log('\nSYNC: some cues are off or masked; read the lines above before delivering.');
}
if (fs.existsSync(CONFIG.transitions)) {
	try {
		run(py, [s('transition_review.py'), CONFIG.out, '--plan', CONFIG.transitions, '--out', 'out/review']);
	} catch {
		console.log('\nTRANSITIONS: suspects found; open out/review/*.png and fix before delivering.');
	}
}
console.log(`\nDelivered: ${CONFIG.out}. Now LOOK at out/review/*.png and watch the file at phone size.`);
