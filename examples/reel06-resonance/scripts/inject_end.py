import re
from pathlib import Path

p = Path(__file__).resolve().parent.parent / "src" / "scenes.ts"
s = p.read_text(encoding="utf-8")

block = r'''
// ------------------------------------------------------------------ montage worlds (each is one flat scene in its own palette)
const wordBox = (word: string, scale: number) => {
	const w = wordWidth(word, scale);
	const r = 39 * scale;
	const gap = 35 * scale;
	const cx = -(gap + 2 * r) / 2;
	const base = -128 * scale;
	return {w, r, cx, base, period: [cx + w / 2 + gap + r, base + r] as [number, number]};
};
const lineBase = (L: Layer, pal: Pal, zoom: number, rot = 0, pan: [number, number] = [0, 0]) =>
	L.bg(pal.bg, pal.a ?? 1).ink(pal.ink, pal.acc, 1, 3).transform(zoom, pan[0], pan[1], rot);

const dotWorld = (L: Layer, f: number, t0: number, pal: Pal, r: number, zoom = 1, rot = 0) => {
	lineBase(L, pal, zoom, rot);
	const age = f - t0;
	L.slot(0, {type: 1, w: 1, group: 0, a: r, fillAmt: 0});
	L.slot(1, {type: 1, w: 1, group: 1, a: r * (1 + 0.3 * Math.exp(-age / 6)), fill: pal.acc, fillAmt: 1});
	L.fieldLines({spacing: 44, phase: beatPhase(f, t0), w: 2.8, a: 0.9, fall: 900, group: 0, emph: 6});
	for (let j = 0; j < 3; j++) {
		const p = clamp01((age - j * 7) / 46);
		if (age - j * 7 < 0) continue;
		L.pulse(j, {g: 0, R: 1100 * ease.out(p), w: 6 - j * 1.5, a: 1 - p, mix: 1});
	}
};
const wordOnly = (L: Layer, f: number, t0: number, pal: Pal, word: string, scale: number, zoom = 1, rot = 0, dy = 0, lines = 0.9) => {
	const B = wordBox(word, scale);
	lineBase(L, pal, zoom, rot);
	const age = f - t0;
	L.slot(0, {type: 2, w: 1, group: 0, a: 0, fill: pal.ink, fillAmt: 1});
	L.word(0, wordGlyphs(word, scale, B.cx, B.base + dy));
	L.slot(1, {type: 1, w: 1, group: 1, x: B.period[0], y: B.period[1] + dy, a: B.r * (1 + 0.25 * Math.exp(-age / 6)), fill: pal.acc, fillAmt: 1});
	L.fieldLines({spacing: 40, phase: beatPhase(f, t0) * (40 / SP), w: 2.6, a: lines, fall: 700, group: 0, emph: 6});
	const p = clamp01(age / 40);
	L.pulse(0, {g: 0, R: 800 * ease.out(p), w: 6, a: 1 - p, mix: 1});
};

// the eight-then-eight cuts of the montage
const CUT_KINDS: ((L: Layer, f: number, t0: number) => void)[] = [
	(L, f, t0) => dotWorld(L, f, t0, P_CORAL, 130),
	(L, f, t0) => wordOnly(L, f, t0, P_PAPER, 'SOUND', 1.25),
	(L, f, t0) => wordOnly(L, f, t0, P_BLUE, 'MOTION', 1.2, 1, -0.05),
	(L, f, t0) => scopeWorld(L, f, 1.05, [0, 0], P_INK, {eOut: 1, eB: 0}),
	(L, f, t0) => roseWorld(L, f, 1.25, P_CORAL, [11, 0.05], 0.4),
	(L, f, t0) => scopeWorld(L, f, 1.3, [0, 0], P_PAPER, {eOut: 1, eB: 1}, 0.3),
	(L, f, t0) => roseWorld(L, f, 1.1, P_BLUE, [13, 0.058], -0.5),
	(L, f, t0) => wordOnly(L, f, t0, P_INK, 'BEAT', 1.45),
	(L, f, t0) => wordOnly(L, f, t0, P_PAPER, 'FRAME', 1.2, 1, 0.06),
	(L, f, t0) => roseWorld(L, f, 1.6, P_CORAL, [15, 0.066], 0.9),
	(L, f, t0) => dotWorld(L, f, t0, P_BLUE, 210, 1, 0.4),
	(L, f, t0) => scopeWorld(L, f, 1.7, [0, 0], P_INK, {eOut: 1, eB: 1}, -0.7),
	(L, f, t0) => wordOnly(L, f, t0, P_CORAL, 'RING', 1.7),
	(L, f, t0) => roseWorld(L, f, 1.2, P_PAPER, [18, 0.08], 1.4),
	(L, f, t0) => wordOnly(L, f, t0, P_BLUE, 'WAVE', 1.5, 1, 0.08),
	(L, f, t0) => roseWorld(L, f, 1.9, P_INK, [20, 0.09], -1.6),
];
const cutIndex = (f: number) => {
	let i = 0;
	for (let k = 0; k < MT.cuts.length; k++) if (f >= MT.cuts[k] - 1e-6) i = k;
	return i;
};
const montageFrame = (fr: Frame, t: number) => {
	const i = cutIndex(t);
	const t0 = MT.cuts[i];
	CUT_KINDS[i](fr.layers[0].on(), t, t0);
	const age = t - t0;
	fr.glitch(70 * Math.exp(-age / 3) * (age < 8 ? 1 : 0), 26, 7 * Math.exp(-age / 2.5) * (age < 8 ? 1 : 0));
	fr.flash(PAL.paper, 0.25 * Math.exp(-age / 1.8));
};

// everything together: four layers piling up, one per beat
const togetherFrames = (fr: Frame, t: number) => {
	const b = MT.builds;
	const r = t - MT.together[0];
	const spin = 0.02 * r;
	roseWorld(fr.layers[0].on(), t, 1.15, P_CORAL, [12, 0.054], spin);
	if (t >= b[1]) {
		const pal: Pal = {bg: PAL.paper, ink: PAL.paper, acc: PAL.coral, a: 0};
		scopeWorld(fr.layers[1].on(), t, 1.0 + 0.04 * clamp01((t - b[1]) / 12), [0, 0], pal, {eOut: 1, eB: 1}, -spin * 0.6);
	}
	if (t >= b[2]) wordOnly(fr.layers[2].on(), t, b[2], {bg: PAL.paper, ink: PAL.paper, acc: PAL.coral, a: 0}, 'MOTION', 0.72, 1, 0, 400, 0.5);
	if (t >= b[3]) wordOnly(fr.layers[3].on(), t, b[3], {bg: PAL.ink, ink: PAL.ink, acc: PAL.paper, a: 0}, 'SOUND', 0.72, 1, 0, -420, 0.5);
	const q = Math.max(...b.filter((x) => t >= x));
	const age = t - q;
	fr.flash(PAL.paper, 0.22 * Math.exp(-age / 2.5) * (t >= b[0] ? 1 : 0));
	fr.glitch(30 * Math.exp(-age / 3) * (age < 8 ? 1 : 0), 30, 4 * Math.exp(-age / 2.5) * (age < 8 ? 1 : 0));
};

// ------------------------------------------------------------------ the finale: the rewind again, onto the wordmark
const FIN = wordBox('motioner', 0.8);
const FIN_BASE = -80;
const FIN_GL = () => wordGlyphs('motioner', 0.8, FIN.cx, FIN_BASE);
const FIN_PERIOD: [number, number] = [FIN.period[0], FIN_BASE + FIN.r];
const finalePhase = (f: number) => {
	const a = FN.rewind[0];
	if (f < a) return beatPhase(f, FN.dotPing);
	if (f < FN.lock) {
		const P0 = beatPhase(a, FN.dotPing);
		const v0 = P0 - beatPhase(a - 1, FN.dotPing);
		const Pe = SP * (Math.floor(P0 / SP) - 5);
		return hermite((f - a) / (FN.lock - a), P0, v0 * (FN.lock - a), Pe, -6 * (FN.lock - a));
	}
	return beatPhase(f, FN.lock);
};
const finaleGlyphs = (f: number): Glyph[] => {
	const gl = FIN_GL();
	gl.forEach((g, i) => {
		const age = f - FN.lock - i * 4;
		if (age < 0) return;
		const env = Math.exp(-age / 11);
		g.y += 34 * env * Math.sin(Math.min(age, 40) / 9 * Math.PI) * 0.9;
		g.s *= 1 + 0.07 * env * Math.sin((age / 9) * Math.PI);
		g.r = 0.03 * env * Math.sin((age / 8) * Math.PI) * (i % 2 ? 1 : -1);
	});
	return gl;
};
const finaleWorld = (L: Layer, f: number, zoom = 1) => {
	L.bg(PAL.ink).ink(PAL.paper, PAL.coral, 1, 3).transform(zoom);
	const rewindA = FN.rewind[0];
	const se = ease.inOut(clamp01((f - FN.morph[0]) / (FN.morph[1] - FN.morph[0])));
	const fillA = clamp01((f - FN.lock) / 14);
	// the seed: a breathing dot, small pings, then it travels to the full stop
	let r = 26 + 2 * Math.sin((2 * Math.PI * f) / 60) * (f < FN.dotPing ? 1 : 0);
	for (const t of [FN.dotPing, FN.dotPing + 30]) if (f >= t) r += 12 * clamp01((f - t) / 2) * Math.exp(-(f - t) / 8);
	const tp = ease.snap(clamp01((f - FN.morph[0]) / (FN.morph[1] - FN.morph[0])));
	const sx = lerp(0, FIN_PERIOD[0], tp);
	const sy = lerp(0, FIN_PERIOD[1], tp) + 60 * Math.sin(Math.PI * tp);
	const rr = lerp(r, FIN.r, tp) * (1 + 0.2 * Math.exp(-(f - FN.lock) / 6) * clamp01((f - FN.lock + 2) / 2)) * (1 + 0.28 * Math.exp(-(f - FN.lastPing) / 8) * clamp01((f - FN.lastPing) / 2) * (f >= FN.lastPing ? 1 : 0));
	L.slot(0, {type: 1, w: 1 - se, group: 0, a: r, fillAmt: 0});
	L.slot(1, {type: 2, w: se, group: 0, a: 0, fill: PAL.paper, fillAmt: 1});
	L.word(0, finaleGlyphs(f));
	L.wipe(lerp(-FIN.w / 2 - 120, FIN.w / 2 + 160, ease.inOut(clamp01((f - FN.lock) / 40))) + FIN.cx, 26);
	L.slot(2, {type: 1, w: 1, group: 1, x: sx, y: sy, a: rr, fill: PAL.coral, fillAmt: 1});
	L.glow(PAL.coral, f < FN.rewind[0] ? 0.5 : 0.0, 60, 1);
	L.fieldLines({spacing: SP, phase: finalePhase(f), w: 2.6, a: f < FN.dotPing ? 0.16 : 0.75, fall: 720, group: 0, emph: 6});
	// two pings that then run backwards, and the echoes of the word
	const warp = (() => {
		if (f <= rewindA) return f;
		if (f >= FN.lock) return 1380 - (f - FN.lock) * 3 - 20;
		return hermite((f - rewindA) / (FN.lock - rewindA), rewindA, FN.lock - rewindA, 1380 - 20, (FN.lock - rewindA) * -3);
	})();
	[FN.dotPing, FN.dotPing + 30].forEach((t, j) => {
		const age = warp - t;
		if (age < 0) return;
		const p = clamp01(age / 110);
		L.pulse(j, {g: 0, R: 1500 * ease.out(p), w: lerp(2.2, 5.5, (1 - p) * (1 - p)), a: clamp01((f - t) / 2) * Math.pow(1 - p, 0.9), mix: clamp01(1 - age / 14)});
	});
	[FN.lock, 1530, 1560, 1590, FN.lastPing].forEach((t, j) => {
		const age = f - t;
		if (age < 0) return;
		const p = clamp01(age / 100);
		L.pulse(2 + j, {g: 0, R: 900 * ease.out(p), w: lerp(2, 4.5, 1 - p), a: Math.pow(1 - p, 1.1) * (j === 0 || j === 4 ? 1 : 0.8), mix: clamp01(1 - age / 10)});
	});
};
'''
if "// ------------------------------------------------------------------ montage worlds" not in s:
    s = s.replace("export const frameAt = (t: number): Frame => {", block + "\nexport const frameAt = (t: number): Frame => {", 1)

# palette alpha
s = s.replace("type Pal = {bg: RGB; ink: RGB; acc: RGB};", "type Pal = {bg: RGB; ink: RGB; acc: RGB; a?: number};")
s = s.replace("L.bg(pal.bg).ink(pal.ink, pal.acc, 0.55, 2.4).transform(zoom, pan[0], pan[1], rot).bend(S.kap);", "L.bg(pal.bg, pal.a ?? 1).ink(pal.ink, pal.acc, 0.55, 2.4).transform(zoom, pan[0], pan[1], rot).bend(S.kap);")

# frameAt: replace the scope/portal chain start with the late branches
old = "	} else if (t >= RG.portal[0]) {"
new = """	} else if (t >= FN.rewind[0] - 78 && t >= CL.iris[1]) {
		finaleWorld(fr.layers[0].on(), t, 1);
	} else if (t >= MT.together[0] && t < CL.iris[0]) {
		togetherFrames(fr, t);
	} else if (t >= CL.iris[0] && t < CL.iris[1]) {
		const p = clamp01((t - CL.iris[0]) / (CL.iris[1] - CL.iris[0]));
		const e = ease.in(p);
		finaleWorld(fr.layers[0].on(), t, 1);
		// the collage of everything, inhaled into the seed
		const zc = lerp(1, 0.16, e);
		const rot = 0.5 * e * e;
		roseWorld(fr.layers[1].on(1), CL.iris[0], 1.15 * zc, P_CORAL, [12, 0.054], 0.02 * 60 + rot);
		const b = MT.builds;
		const pal1: Pal = {bg: PAL.paper, ink: PAL.paper, acc: PAL.coral, a: 0};
		scopeWorld(fr.layers[2].on(1), CL.iris[0], zc, [0, 0], pal1, {eOut: 1, eB: 1}, -0.72 - rot);
		wordOnly(fr.layers[3].on(1), CL.iris[0], b[2], {bg: PAL.paper, ink: PAL.paper, acc: PAL.coral, a: 0}, 'MOTION', 0.72, zc, rot, 400, 0.5);
		wordOnly(fr.layers[4].on(1), CL.iris[0], b[3], {bg: PAL.ink, ink: PAL.ink, acc: PAL.paper, a: 0}, 'SOUND', 0.72, zc, rot, -420, 0.5);
		fr.ring(W / 2, H / 2, 1900 * (1 - ease.in(p)), 40, 0, 0, 0.0);
	} else if (t >= MT.from && t < MT.together[0]) {
		montageFrame(fr, t);
	} else if (t >= BD.from && t < MT.from) {
		roseWorld(fr.layers[0].on(), t, 1 + 0.06 * smooth(BD.from, BD.to, t) + 0.05 * Math.exp(-((t - BD.from) % 15) / 4), P_CORAL);
	} else if (t >= RG.portal[0]) {"""
assert old in s
s = s.replace(old, new, 1)
p.write_text(s, encoding="utf-8")
print("ok")
