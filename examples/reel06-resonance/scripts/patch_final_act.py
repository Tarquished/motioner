"""Rewrites the last act of the film: words that orbit, layers that materialise out of dust, a whirl that turns everything to dust,
and sand that gathers into the wordmark (the plate's nodal lines are pulled onto the outline of the word)."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
tlp = root / "src" / "timeline.json"
tl = json.loads(tlp.read_text())
tl["sand"] = {"steps": [1380, 1410, 1440, 1452, 1464, 1474, 1484, 1491], "morph": [1440, 1500]}
tl["finale"]["morph"] = [1446, 1500]
tlp.write_text(json.dumps(tl, indent="\t"))

p = root / "src" / "scenes.ts"
s = p.read_text(encoding="utf-8")
a = s.index("// everything together: four layers piling up, one per beat")
b = s.index("// ------------------------------------------------------------------ what is under a point of the screen")

block = r'''// ------------------------------------------------------------------ everything together
// Words orbit the plate on two counter-rotating rings, every layer materialises out of dust on its beat, then a whirl twists it all and
// the dust is blown away; the next thing is made of the same dust (sand).
const ringGlyphs = (word: string, scale: number, R: number, theta0: number): Glyph[] => {
	const w = (ATL.words as any)[word];
	return w.items.map((it: any) => {
		const rad = R + it.y * scale; // the letter centre above the baseline, outward
		const phi = theta0 + (it.x * scale) / R; // reading clockwise along the circle
		return {x: rad * Math.sin(phi), y: rad * Math.cos(phi), s: scale, r: -phi, idx: it.idx};
	});
};
const spinAt = (t: number) => 0.0135 * (t - MT.together[0]) + (t > CL.iris[0] ? 0.0011 * Math.pow(t - CL.iris[0], 2) : 0);
const dustBorn = (t: number, at: number) => 1 - ease.out(clamp01((t - at) / 16));
const dustWhirl = (t: number, a: number, b: number) => ease.in(clamp01((t - a) / (b - a)));

const orbitLayer = (L: Layer, t: number, word: string, scale: number, R: number, dir: number, col: RGB, born: number, whirl: [number, number], swirl: number, zoom: number) => {
	const sp = dir * spinAt(t);
	L.bg(col, 0).ink(col, col, 0.9, 2.6).transform(zoom);
	L.slot(0, {type: 2, w: 1, group: 0, a: 0, fill: col, fillAmt: 1});
	L.slot(1, {type: 2, w: 1, group: 1, a: 1, fill: col, fillAmt: 1});
	L.word(0, ringGlyphs(word, scale, R, sp));
	L.word(1, ringGlyphs(word, scale, R, sp + Math.PI));
	for (let k = 0; k < 2; k++) {
		const t0 = born + 30 * k;
		const age = t - t0;
		if (age < 0) continue;
		const p = clamp01(age / 40);
		L.pulse(k * 2, {g: 0, R: 260 * ease.out(p), w: 3, a: 0.8 * (1 - p), mix: 0});
		L.pulse(k * 2 + 1, {g: 1, R: 260 * ease.out(p), w: 3, a: 0.8 * (1 - p), mix: 0});
	}
	L.swirl(swirl, 640, Math.max(dustBorn(t, born), dustWhirl(t, whirl[0], whirl[1])), 1500, 0.8, 2, Math.floor(t));
};

const collage = (fr: Frame, t: number) => {
	const h = Math.round(t);
	const b = MT.builds;
	const p = clamp01((t - CL.iris[0]) / (CL.iris[1] - CL.iris[0]));
	const e = ease.in(p);
	const swirl = -16 * e; // radians of twist at the centre: a whirlpool
	const zoom = 1 - 0.3 * e;
	const spin = spinAt(t);
	fr.layers[0].on().bg(PAL.ink).transform(1);
	// the plate
	const rose = fr.layers[1].on();
	roseWorld(rose, t, 1.15 * zoom, P_CORAL, [12, 0.054], spin * 1.4);
	rose.swirl(swirl, 640, dustWhirl(t, 1338, 1362), 1500, 0.8, 2, Math.floor(t));
	// the film's waveform rolled into a ring
	if (h >= b[1]) {
		const ring = fr.layers[2].on();
		scopeWorld(ring, t, (1.0 + 0.04 * clamp01((t - b[1]) / 12)) * zoom, [0, 0], {bg: PAL.yellow, ink: PAL.yellow, acc: PAL.paper, a: 0}, {eOut: 1, eB: 1}, -spin * 0.6);
		ring.swirl(swirl, 640, Math.max(dustBorn(t, b[1]), dustWhirl(t, 1332, 1354)), 1500, 0.8, 2, Math.floor(t));
	}
	// the two words orbit, one ring each way
	if (h >= b[2]) orbitLayer(fr.layers[3].on(), t, 'MOTION', 0.62, 700, 1, PAL.paper, b[2], [1324, 1346], swirl, zoom);
	if (h >= b[3]) orbitLayer(fr.layers[4].on(), t, 'SOUND', 0.62, 880, -1, PAL.blue, b[3], [1320, 1342], swirl, zoom);
	const q = Math.max(...b.filter((x) => t >= x));
	const age = t - q;
	if (t < CL.iris[0]) {
		fr.flash(PAL.paper, 0.22 * Math.exp(-age / 2.5) * (t >= b[0] ? 1 : 0));
		fr.glitch(30 * Math.exp(-age / 3) * (age < 8 ? 1 : 0), 30, 4 * Math.exp(-age / 2.5) * (age < 8 ? 1 : 0));
	} else fr.glitch(24 * Math.exp(-(t - CL.iris[0]) / 3), 30, 5 * Math.exp(-(t - CL.iris[0]) / 3));
};

// ------------------------------------------------------------------ the finale: sand gathers into the wordmark
const FIN = wordBox('motioner', 0.8);
const FIN_BASE = -80;
const FIN_GL = () => wordGlyphs('motioner', 0.8, FIN.cx, FIN_BASE);
const FIN_PERIOD: [number, number] = [FIN.period[0], FIN_BASE + FIN.r];
const SAND = TL.sand;
const SAND_MODES: [number, number][] = [[3, 0.02], [5, 0.03], [7, 0.041], [9, 0.052], [12, 0.066], [15, 0.082], [19, 0.1], [23, 0.12]];
const sandState = (f: number) => {
	let idx = -1;
	for (let i = 0; i < SAND.steps.length; i++) if (f >= SAND.steps[i]) idx = i;
	const cur = SAND_MODES[Math.max(idx, 0)];
	const prev = SAND_MODES[Math.max(idx - 1, 0)];
	const since = idx < 0 ? 99 : f - SAND.steps[idx];
	return {m1: prev[0], k1: prev[1], m2: cur[0], k2: cur[1], mix: ease.out(clamp01(since / 10)), pulse: Math.exp(-since / 9)};
};
const finaleGlyphs = (f: number): Glyph[] => {
	const gl = FIN_GL();
	gl.forEach((g, i) => {
		const age = f - FN.lock - i * 4;
		if (age < 0) return;
		const env = Math.exp(-age / 11);
		g.y += 34 * env * Math.sin((Math.min(age, 40) / 9) * Math.PI) * 0.9;
		g.s *= 1 + 0.07 * env * Math.sin((age / 9) * Math.PI);
		g.r = 0.03 * env * Math.sin((age / 8) * Math.PI) * (i % 2 ? 1 : -1);
	});
	return gl;
};
const finaleWorld = (L: Layer, f: number, zoom = 1) => {
	L.bg(PAL.ink).ink(PAL.paper, PAL.coral, 1, 3).transform(zoom);
	const before = f < FN.lock;
	// the seed: a breathing dot, two pings, then it travels to the full stop and lands on the lock
	let r = 26 + 2 * Math.sin((2 * Math.PI * f) / 60) * (f < FN.dotPing ? 1 : 0);
	for (const t of [FN.dotPing, FN.dotPing + 30]) if (f >= t) r += 12 * clamp01((f - t) / 2) * Math.exp(-(f - t) / 8);
	const tp = ease.snap(clamp01((f - FN.morph[0]) / (FN.morph[1] - FN.morph[0])));
	const sx = lerp(0, FIN_PERIOD[0], tp);
	const sy = lerp(0, FIN_PERIOD[1], tp) + 70 * Math.sin(Math.PI * tp);
	const rr = lerp(r, FIN.r, tp) * (1 + 0.2 * Math.exp(-(f - FN.lock) / 6) * clamp01((f - FN.lock + 2) / 2)) * (1 + 0.28 * Math.exp(-(f - FN.lastPing) / 8) * clamp01((f - FN.lastPing) / 2) * (f >= FN.lastPing ? 1 : 0));
	L.slot(0, {type: 1, w: 1, group: 2, x: 0, y: 0, a: r, fillAmt: 0}); // the source of the pings
	L.slot(1, {type: 2, w: 1, group: 0, a: 0, fill: PAL.paper, fillAmt: clamp01((f - FN.lock) / 14)});
	L.word(0, finaleGlyphs(f));
	L.wipe(lerp(-FIN.w / 2 - 120, FIN.w / 2 + 160, ease.inOut(clamp01((f - FN.lock) / 40))) + FIN.cx, 26);
	L.slot(2, {type: 1, w: 1, group: 1, x: sx, y: sy, a: rr, fill: PAL.coral, fillAmt: 1});
	L.glow(PAL.coral, f < FN.morph[0] ? 0.5 : 0.0, 60, 1);
	const lineA = before ? 0.3 * (1 - clamp01((f - SAND.morph[0]) / 30)) : 0.75 * clamp01((f - FN.lock) / 12);
	L.fieldLines({spacing: SP, phase: before ? f * 0.32 : beatPhase(f, FN.lock), w: 2.6, a: lineA, fall: before ? 260 : 720, group: before ? 2 : 0, emph: 6});
	[FN.dotPing, FN.dotPing + 30].forEach((t, j) => {
		const age = f - t;
		if (age < 0 || !before) return;
		const p = clamp01(age / 110);
		L.pulse(j, {g: 2, R: 900 * ease.out(p), w: lerp(2.2, 5.5, (1 - p) * (1 - p)), a: Math.pow(1 - p, 0.9), mix: clamp01(1 - age / 14)});
	});
	[FN.lock, 1530, 1560, 1590, FN.lastPing].forEach((t, j) => {
		const age = f - t;
		if (age < 0) return;
		const p = clamp01(age / 100);
		L.pulse(2 + j, {g: 0, R: 900 * ease.out(p), w: lerp(2, 4.5, 1 - p), a: Math.pow(1 - p, 1.1) * (j === 0 || j === 4 ? 1 : 0.8), mix: clamp01(1 - age / 10)});
	});
};
// the plate again, in paper sand on ink: it materialises out of the dust of the whirl, changes with every note, and its nodal lines
// are pulled onto the outline of the word
const sandOverlay = (L: Layer, f: number, zoom: number) => {
	const S = sandState(f);
	const s = ease.inOut(clamp01((f - SAND.morph[0]) / (SAND.morph[1] - SAND.morph[0])));
	L.bg(PAL.ink, 0).ink(PAL.paper, PAL.coral, 1, 3).transform(zoom);
	const rad = f < SAND.morph[0] ? 640 + 26 * S.pulse : lerp(640, 2600, ease.in(clamp01((f - SAND.morph[0]) / 30)));
	const fade = 1 - ease.out(clamp01((f - FN.lock) / 30));
	L.rosette({amt: fade, m1: S.m1, k1: S.k1, m2: S.m2, k2: S.k2, mix: S.mix, rot: 0.012 * (f - 1362), radius: rad, lineW: 3.6 + 2 * S.pulse, edge: f < SAND.morph[0] ? 4 : 0, col: PAL.paper, sand: 2.4 + 3 * S.pulse});
	L.roseWord(s);
	L.word(0, finaleGlyphs(f));
	L.swirl(0, 600, dustBorn(f, 1352 + 8) * (f < 1400 ? 1 : 0), 1100, 0.6, 2, Math.floor(f));
};
const finaleFrame = (fr: Frame, t: number) => {
	const age = Math.max(0, t - FN.lock);
	const punch = t >= FN.lock ? 1 + 0.04 * Math.exp(-age / 6) : 1;
	finaleWorld(fr.layers[0].on(), t, punch);
	if (t < FN.lock + 40) sandOverlay(fr.layers[1].on(), t, punch);
	if (Math.round(t) >= FN.lock && age < 60) {
		const q = 1 - age / 60;
		fr.ring(W / 2, H / 2, (2600 * (1 - Math.pow(2, -5 * (age / 45)))) / (1 - Math.pow(2, -5)), 150, 34 * q, 9 * q, 0.5 * q, PAL.paper);
	}
};

'''
s = s[:a] + block + s[b:]

# branches
old_start = s.index("	} else if (t >= FN.rewind[0] - 78 && t >= CL.iris[1]) {")
old_end = s.index("	} else if (h >= MT.from && h < MT.together[0]) {")
s = s[:old_start] + "	} else if (h >= CL.iris[1]) {\n		finaleFrame(fr, t);\n	} else if (h >= MT.together[0]) {\n		collage(fr, t);\n" + s[old_end:]

p.write_text(s, encoding="utf-8")
print("ok")
