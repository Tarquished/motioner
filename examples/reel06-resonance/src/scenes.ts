/* The film as a pure function of the (fractional) frame: frameAt(t) returns the layers the shader draws. */
import {ease, clamp01, lerp} from './motion';
import {Frame, Glyph, Layer, PAL, RGB} from './frame';
import {W, H} from './engine';
import ATL from './atlas.json';
import TL from './timeline.json';

export const FPS = 60;
export const BEAT = 30;
const {ping, sound, hum, motion, frame: FR, ring: RG, build: BD, montage: MT, collapse: CL, finale: FN, plate: PL} = TL;

// ------------------------------------------------------------------ helpers
const easeOutExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const hermite = (u: number, p0: number, m0: number, p1: number, m1: number) => {
	const u2 = u * u;
	const u3 = u2 * u;
	return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1;
};
export const wordGlyphs = (word: string, scale: number, cx: number, baseY: number): Glyph[] => {
	const w = (ATL.words as any)[word];
	return w.items.map((it: any) => ({x: cx + it.x * scale, y: baseY + it.y * scale, s: scale, r: 0, idx: it.idx}));
};
export const wordWidth = (word: string, scale: number) => (ATL.words as any)[word].width * scale;

// ------------------------------------------------------------------ the seed
export const SEED = {r0: 16, rSettled: 26};
const seedRadius = (f: number) => {
	if (f < hum.dot) return 0;
	let r = SEED.r0 * ease.backOut(1.3)(clamp01((f - hum.dot) / 14));
	if (f < ping.hit) r += 2 * Math.sin((2 * Math.PI * (f - hum.dot)) / 60) * clamp01((f - hum.dot - 14) / 20);
	else {
		const a = clamp01((f - ping.hit) / 2);
		r = lerp(r, SEED.rSettled, ease.out(clamp01((f - ping.hit) / 30)));
		r += 44 * a * Math.exp(-(f - ping.hit) / 9);
		for (const t of ping.pings.slice(1)) if (f >= t) r += 12 * clamp01((f - t) / 2) * Math.exp(-(f - t) / 8);
	}
	return r;
};

// ------------------------------------------------------------------ the two words
const PERIOD_R = 34;
const PERIOD_GAP = 30;
const BASE_Y = -110; // baseline (scene y, up)
const layout = (word: string, scale: number) => {
	const w = wordWidth(word, scale);
	const cx = -(PERIOD_GAP + 2 * PERIOD_R) / 2;
	return {scale, w, cx, period: [cx + w / 2 + PERIOD_GAP + PERIOD_R, BASE_Y + PERIOD_R] as [number, number]};
};
export const SOUND = layout('SOUND', 0.86);
export const MOTION = layout('MOTION', 0.8);
const SOUND_GL = wordGlyphs('SOUND', SOUND.scale, SOUND.cx, BASE_Y);

// time-warp of the rings: the movie of the pings runs backwards
const rewindTime = (f: number) => {
	const a = sound.rewind[0];
	const b = sound.rewind[1];
	if (f <= a) return f;
	if (f >= b) return 112 - (f - b) * 3;
	return hermite((f - a) / (b - a), a, b - a, 112, (b - a) * -3);
};

// the rings of the field: they lurch outward by one spacing on every beat
const SP = 44;
const beatPhase = (f: number, f0: number) => {
	if (f < f0) return 0;
	const b = (f - f0) / BEAT;
	const k = Math.floor(b);
	return SP * (k + ease.out(b - k));
};
const soundPhase = (f: number) => {
	if (f < sound.rewind[0]) return beatPhase(f, ping.hit);
	if (f < sound.lock) {
		const a = sound.rewind[0];
		const P0 = beatPhase(a, ping.hit);
		const v0 = P0 - beatPhase(a - 1, ping.hit);
		const Pe = SP * (Math.floor(P0 / SP) - 5);
		return hermite((f - a) / (sound.lock - a), P0, v0 * (sound.lock - a), Pe, -6 * (sound.lock - a));
	}
	return beatPhase(f, sound.lock);
};

// MOTION: a wave of movement travels through the letters on every beat after the melt
const motionGlyphs = (f: number): Glyph[] => {
	const gl = wordGlyphs('MOTION', MOTION.scale, MOTION.cx, BASE_Y);
	const beats = motion.echo;
	gl.forEach((g, i) => {
		let dy = 0;
		let rot = 0;
		for (const t of beats) {
			const age = f - t - i * 3.2;
			if (age < 0) continue;
			const env = Math.exp(-age / 16);
			dy += 26 * env * Math.sin((age / 12) * Math.PI) * (i % 2 ? -1 : 1);
			rot += 0.05 * env * Math.sin((age / 10) * Math.PI) * (i % 2 ? 1 : -1);
		}
		g.y += dy;
		g.r = rot;
	});
	return gl;
};

// ------------------------------------------------------------------ palettes
type Pal = {bg: RGB; ink: RGB; acc: RGB; a?: number};
const P_INK: Pal = {bg: PAL.ink, ink: PAL.paper, acc: PAL.coral};
const P_PAPER: Pal = {bg: PAL.paper, ink: PAL.ink, acc: PAL.coral};
const P_CORAL: Pal = {bg: PAL.coral, ink: PAL.ink, acc: PAL.paper};
const P_BLUE: Pal = {bg: PAL.blue, ink: PAL.paper, acc: PAL.coral};

// ------------------------------------------------------------------ worlds
const cam = (f: number) => 1 + 0.045 * ease.inOutSoft(clamp01(f / 450));

const inkWorld = (L: Layer, f: number, zoom: number) => {
	const r = seedRadius(f);
	L.bg(PAL.ink).ink(PAL.paper, PAL.coral, 0.5, 3).transform(zoom);
	L.slot(0, {type: 1, w: 1, group: 0, x: 0, y: 0, a: r});
	L.slot(1, {type: 1, w: 1, group: 1, x: 0, y: 0, a: r, fill: PAL.coral, fillAmt: 1});
	L.glow(PAL.coral, 0.55 + 0.25 * clamp01((f - 90) / 30), 52 + 50 * clamp01((f - 84) / 36), 1);
	L.fieldLines({spacing: 60, phase: f * 0.32, w: 2.4, a: 0.22 * clamp01((f - 40) / 70), fall: 240, group: 0});
	hum.rings.forEach((t, j) => {
		const age = f - t;
		if (age < 0) return;
		const p = clamp01(age / 100);
		L.pulse(j, {g: 0, R: 520 * ease.out(p), w: 2.5, a: 0.4 * (1 - p) * (0.6 + 0.4 * clamp01((f - 70) / 40)), mix: 0});
	});
};

export const seedPos = (f: number): [number, number] => {
	const tp = ease.snap(clamp01((f - 246) / 54));
	const tm = ease.snap(clamp01((f - motion.melt[0]) / (motion.melt[1] - motion.melt[0])));
	let sx = lerp(0, SOUND.period[0], tp);
	let sy = lerp(0, SOUND.period[1], tp) + 60 * Math.sin(Math.PI * tp);
	sx = lerp(sx, MOTION.period[0], tm);
	sy = lerp(sy, MOTION.period[1], tm) + 40 * Math.sin(Math.PI * tm);
	return [sx, sy];
};

/** paper (SOUND) and blue (MOTION) share one word machine: dot -> SOUND (rewind), SOUND -> MOTION (melt) */
const wordWorld = (L: Layer, f: number, zoom: number, blue: boolean, pan: [number, number] = [0, 0]) => {
	const bg = blue ? PAL.blue : PAL.paper;
	const ink = blue ? PAL.paper : PAL.ink;
	L.bg(bg).ink(ink, PAL.coral, 1, 3).transform(zoom, pan[0], pan[1]);
	const r = seedRadius(f);
	const se = ease.inOut(clamp01((f - 246) / 54)); // dot -> SOUND
	const me = ease.inOut(clamp01((f - motion.melt[0]) / (motion.melt[1] - motion.melt[0]))); // SOUND -> MOTION
	L.slot(0, {type: 1, w: 1 - se, group: 0, x: 0, y: 0, a: r});
	const fillA = ease.out(clamp01((f - sound.fill[0]) / (sound.fill[1] - sound.fill[0])));
	L.slot(1, {type: 6, w: se, group: 0, a: me, fill: ink, fillAmt: fillA});
	const A = SOUND_GL;
	const B = motionGlyphs(f);
	const mixG = (a: Glyph | undefined, b: Glyph, m: number): Glyph | undefined =>
		a ? {x: lerp(a.x, b.x, m), y: lerp(a.y, b.y, m), s: lerp(a.s, b.s, m), r: lerp(a.r, b.r, m), idx: a.idx} : undefined;
	L.word(0, B.map((b, i) => mixG(A[i], b, me)).filter((g, i) => !!A[i]) as Glyph[]);
	L.word(1, B.map((b, i) => ({...b, x: lerp(A[i] ? A[i].x : b.x, b.x, me), y: lerp(A[i] ? A[i].y : b.y, b.y, me), s: lerp(A[i] ? A[i].s : b.s, b.s, me)})));
	const [sx, sy] = seedPos(f);
	const tp = ease.snap(clamp01((f - 246) / 54));
	const rr = f < 246 ? r : lerp(r, PERIOD_R, tp) * (1 + 0.16 * Math.exp(-(f - sound.lock) / 6) * clamp01((f - sound.lock + 2) / 2));
	L.slot(2, {type: 1, w: 1, group: 1, x: sx, y: sy, a: rr, fill: PAL.coral, fillAmt: 1});
	// rings: the field, the pings (and their rewind), the echoes of the word
	L.fieldLines({spacing: SP, phase: soundPhase(f), w: 2.6, a: 0.8, fall: 720, group: 0, emph: 6});
	const te = rewindTime(f);
	ping.pings.forEach((t, j) => {
		const age = te - t;
		if (age < 0) return;
		const p = clamp01(age / 110);
		const life = 1 - p;
		const fadeIn = clamp01((f - t) / 2);
		L.pulse(j, {g: 0, R: 1500 * ease.out(p), w: lerp(2.2, 5.5, life * life), a: fadeIn * Math.pow(life, 0.9), mix: clamp01(1 - age / 14)});
	});
	[sound.lock, 330, 360, motion.lock, ...motion.echo.slice(1)].forEach((t, j) => {
		const age = f - t;
		if (age < 0) return;
		const p = clamp01(age / 100);
		L.pulse(4 + j, {g: 0, R: 900 * ease.out(p), w: lerp(2, 4.5, 1 - p), a: Math.pow(1 - p, 1.1) * (j === 0 ? 1 : 0.8), mix: clamp01(1 - age / 10)});
	});
};

// ------------------------------------------------------------------ the scope: the film reads its own soundtrack
const smooth = (a: number, b: number, x: number) => {
	const t = clamp01((x - a) / (b - a));
	return t * t * (3 - 2 * t);
};
export const scopeState = (f: number, ov?: {eOut?: number; eB?: number}) => {
	const now = f / FPS;
	const eOut = ov?.eOut ?? ease.inOut(clamp01((f - FR.out[0]) / (FR.out[1] - FR.out[0])));
	const eB = ov?.eB ?? ease.inOut(clamp01((f - FR.bend[0]) / (FR.bend[1] - FR.bend[0])));
	const Lw = Math.exp(lerp(Math.log(0.9), Math.log(30), eOut));
	const c = lerp(now, 15, eOut);
	const t0 = c - Lw / 2;
	const t1 = c + Lw / 2;
	const hl = lerp(1080, 1500, eB);
	const kap = (eB * Math.PI) / hl;
	const x = hl * kap;
	const yM = kap < 1e-4 ? (hl * hl * kap) / 6 : (1 - Math.sin(x) / x) / kap;
	const s = ((now - t0) / (t1 - t0)) * 2 * hl - hl;
	let ph: [number, number];
	if (kap < 1e-5) ph = [s, yM];
	else {
		const rho = 1 / kap;
		const phi = s / rho;
		ph = [rho * Math.sin(phi), yM - rho + rho * Math.cos(phi)];
	}
	return {t0, t1, hl, kap, yM, ph, env: smooth(2, 8, Lw), eB, eOut, ringR: kap > 1e-5 ? 1 / kap : 0};
};
const scopeWorld = (L: Layer, f: number, zoom: number, pan: [number, number], pal: Pal = P_INK, ov?: {eOut?: number; eB?: number}, rot = 0) => {
	const S = scopeState(f, ov);
	const AMP = lerp(380, 215, S.eB);
	L.bg(pal.bg, pal.a ?? 1).ink(pal.ink, pal.acc, 0.55, 2.4).transform(zoom, pan[0], pan[1], rot).bend(S.kap);
	// group 0: the smoothed envelope only (its level sets are the rings around the sound); group 5: the crisp waveform itself
	L.slot(0, {type: 5, w: 1, group: 0, x: 0, y: S.yM, a: S.hl, b: AMP, shell: -1, t0: S.t0, t1: S.t1, env: 1, fillAmt: 0});
	L.slot(5, {type: 5, w: 1, group: 5, x: 0, y: S.yM, a: S.hl, b: AMP, shell: S.env > 0.5 ? 1.2 : 2.2, t0: S.t0, t1: S.t1, env: S.env, fill: pal.ink, fillAmt: 1});
	const fb = 1 - smooth(0.0, 0.5, S.eB);
	L.slot(1, {type: 3, w: 1, group: 1, x: 0, y: 0, a: 1140 + 300 * S.eB, b: 480 + 200 * S.eB, c0: 26, shell: 1.8, fill: pal.ink, fillAmt: 0.85 * fb});
	L.slot(2, {type: 3, w: 1, group: 2, x: S.ph[0], y: S.kap < 1e-5 ? 0 : S.ph[1], a: 1.8, b: 470 * (1 - S.eB), fill: pal.acc, fillAmt: 1});
	L.slot(3, {type: 1, w: 1, group: 3, x: S.ph[0], y: S.ph[1], a: 10 + 6 * S.eB, fill: pal.acc, fillAmt: 1});
	L.slot(4, {type: 3, w: 1, group: 4, x: 0, y: 0, a: 1080, b: 0.9, fill: pal.ink, fillAmt: 0.28 * (1 - S.eB)});
	L.fieldLines({spacing: 26, phase: beatPhase(f, FR.scope[0]) * (26 / SP), w: 2, a: 0.7, fall: 240, group: 0, emph: 4});
	L.glow(pal.acc, 0.35, 50, 3);
};


// ------------------------------------------------------------------ the plate: a Chladni rosette that changes with every note
const ROS_MODES: [number, number][] = [[2, 0.014], [3, 0.018], [4, 0.022], [5, 0.026], [6, 0.030], [7, 0.034], [8, 0.038], [9, 0.042]];
const BUILD_MODES: [number, number][] = [[10, 0.046], [11, 0.05], [12, 0.054], [13, 0.058], [14, 0.062], [15, 0.066], [16, 0.07], [17, 0.075], [18, 0.08], [19, 0.085], [20, 0.09]];
export const roseState = (f: number) => {
	const events: {f: number; m: number; k: number}[] = [];
	RG.notes.forEach((t, i) => events.push({f: t, m: ROS_MODES[i][0], k: ROS_MODES[i][1]}));
	BD.steps.forEach((t, i) => events.push({f: t, m: BUILD_MODES[i][0], k: BUILD_MODES[i][1]}));
	let idx = -1;
	for (let i = 0; i < events.length; i++) if (f >= events[i].f) idx = i;
	const cur = events[Math.max(idx, 0)];
	const prev = events[Math.max(idx - 1, 0)];
	const since = idx < 0 ? 99 : f - events[idx].f;
	const mix = ease.out(clamp01(since / 12));
	const pulse = Math.exp(-since / 10);
	const build = smooth(BD.from, BD.to, f);
	const rot = 0.012 * (f - RG.portal[0]) + 0.0009 * Math.pow(Math.max(0, f - BD.from), 1.5);
	return {m1: prev.m, k1: prev.k, m2: cur.m, k2: cur.k, mix, pulse, rot, build};
};
const roseWorld = (L: Layer, f: number, zoom: number, pal: Pal = P_CORAL, mode?: [number, number], rotZ = 0) => {
	const R = roseState(f);
	if (mode) Object.assign(R, {m1: mode[0], k1: mode[1], m2: mode[0], k2: mode[1], mix: 1});
	L.bg(pal.bg).ink(pal.ink, pal.acc, 0.75, 2.6).transform(zoom, 0, 0, rotZ);
	const rad = 640 + 26 * R.pulse;
	L.rosette({amt: 1, m1: R.m1, k1: R.k1, m2: R.m2, k2: R.k2, mix: R.mix, rot: R.rot, radius: rad, lineW: 3.6 + 2 * R.pulse, edge: 4, col: pal.ink, sand: 2.2 + 3 * R.pulse});
	L.slot(0, {type: 1, w: 1, group: 0, x: 0, y: 0, a: rad, fillAmt: 0});
	L.fieldLines({spacing: 44, phase: beatPhase(f, RG.portal[0]), w: 2.4, a: 0.8, fall: 620, group: 0, emph: 5, mix: 0});
	L.slot(1, {type: 1, w: 1, group: 1, x: 0, y: 0, a: 22 + 10 * R.pulse, fill: pal.acc, fillAmt: 1});
};

const CAM_END = 1 + 0.045;
const OC = (ATL.chars as any)['O'].counter;
const Z_END = (1.6 * Math.max(W / 2 / (OC.rx * MOTION.scale), H / 2 / (OC.ry * MOTION.scale))) / CAM_END;


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
	const i = cutIndex(Math.round(t)); // a cut is a hard cut: every sub-frame of a frame belongs to the same shot
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
	if (Math.round(t) >= b[1]) {
		const pal: Pal = {bg: PAL.yellow, ink: PAL.yellow, acc: PAL.paper, a: 0};
		scopeWorld(fr.layers[1].on(), t, 1.0 + 0.04 * clamp01((t - b[1]) / 12), [0, 0], pal, {eOut: 1, eB: 1}, -spin * 0.6);
	}
	if (Math.round(t) >= b[2]) wordOnly(fr.layers[2].on(), t, b[2], {bg: PAL.paper, ink: PAL.paper, acc: PAL.coral, a: 0}, 'MOTION', 0.72, 1, 0, 400, 0.5);
	if (Math.round(t) >= b[3]) wordOnly(fr.layers[3].on(), t, b[3], {bg: PAL.blue, ink: PAL.blue, acc: PAL.paper, a: 0}, 'SOUND', 0.72, 1, 0, -420, 0.5);
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
	L.fieldLines({spacing: SP, phase: finalePhase(f), w: 2.6, a: f < FN.dotPing ? 0.3 : 0.75, fall: 720, group: 0, emph: 6});
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


// ------------------------------------------------------------------ what is under a point of the screen (the HUD picks its colour from it)
const CUT_DARK = [false, false, true, true, false, false, true, true, false, false, true, true, false, false, true, true];
export const hudDark = (t: number, px: number, py: number): boolean => {
	// px, py: screen position, origin top-left (DOM)
	const sx = px;
	const sy = H - py;
	const dist = (ox: number, oy: number) => Math.hypot(sx - ox, sy - oy);
	if (t < ping.hit + 1) return true;
	if (t < motion.flood[0]) return !(1700 * easeOutExpo((t - ping.hit) / 22) > dist(W / 2, H / 2));
	if (t < motion.flood[0] + 40) {
		const p = clamp01((t - motion.flood[0]) / (motion.flood[1] - motion.flood[0]));
		const R = (2700 * (1 - Math.pow(2, -6 * p))) / (1 - Math.pow(2, -6));
		const [qx, qy] = seedPos(motion.flood[0]);
		const z = cam(motion.flood[0]);
		return R > dist(W / 2 + qx * z, H / 2 + qy * z);
	}
	if (t < RG.portal[0]) return true;
	if (t < RG.portal[1]) {
		const age = t - RG.portal[0];
		const p = clamp01(age / (RG.portal[1] - RG.portal[0]));
		const Rm = Math.max(26 + (1500 / Math.PI - 26) * easeOutExpo(age / 9), (1500 / Math.PI) * lerp(1, 4.2, ease.inOut(p)));
		return !(Rm > dist(W / 2, H / 2));
	}
	if (t < PL.flood1[0]) return false;
	if (t < PL.flood1[1]) return floodR(t, PL.flood1[0], PL.flood1[1]) > dist(W / 2, H / 2); // coral (light) becomes blue (dark) inside the ring
	if (t < PL.flood2[0]) return true;
	if (t < PL.flood2[1]) return true;
	if (t < MT.from) return true;
	if (t < MT.together[0]) return CUT_DARK[cutIndex(t)];
	if (t < CL.iris[0]) return false;
	if (t < CL.iris[1]) {
		const p = clamp01((t - CL.iris[0]) / (CL.iris[1] - CL.iris[0]));
		return !(1900 * (1 - ease.in(p)) > dist(W / 2, H / 2));
	}
	return true;
};


// the plate: coral, then a flood to blue on bar 7, then a flood to ink for the build
const P_INK2: Pal = {bg: PAL.ink, ink: PAL.paper, acc: PAL.coral};
const plateZoom = (t: number) => 1 + 0.06 * smooth(BD.from, BD.to, t) + (t >= BD.from ? 0.05 * Math.exp(-((t - BD.from) % 15) / 4) : 0);
const floodR = (t: number, t0: number, t1: number) => {
	const p = clamp01((t - t0) / (t1 - t0));
	return (2000 * (1 - Math.pow(2, -6 * p))) / (1 - Math.pow(2, -6));
};
const plateFrame = (fr: Frame, t: number) => {
	const z = plateZoom(t);
	const [a0, a1] = PL.flood1;
	const [b0, b1] = PL.flood2;
	if (t < a0) roseWorld(fr.layers[0].on(), t, z, P_CORAL);
	else if (t < a1) {
		roseWorld(fr.layers[0].on(), t, z, P_CORAL);
		roseWorld(fr.layers[1].on(1), t, z, P_BLUE);
		const q = clamp01((t - a0) / (a1 - a0));
		fr.ring(W / 2, H / 2, floodR(t, a0, a1), 110, 26 * (1 - q), 7 * (1 - q), 0.55 * (1 - q), PAL.paper);
	} else if (t < b0) roseWorld(fr.layers[0].on(), t, z, P_BLUE);
	else if (t < b1) {
		roseWorld(fr.layers[0].on(), t, z, P_BLUE);
		roseWorld(fr.layers[1].on(1), t, z, P_INK2);
		const q = clamp01((t - b0) / (b1 - b0));
		fr.ring(W / 2, H / 2, floodR(t, b0, b1), 110, 26 * (1 - q), 7 * (1 - q), 0.55 * (1 - q), PAL.coral);
	} else roseWorld(fr.layers[0].on(), t, z, P_INK2);
};

export const frameAt = (t: number): Frame => {
	const fr = new Frame();
	const h = Math.round(t); // hard cuts happen on a whole frame: every sub-frame of a frame belongs to the same shot
	const z = cam(t);
	fr.seed(Math.floor(t));
	if (h < ping.hit) {
		inkWorld(fr.layers[0].on(), t, z);
	} else if (h < motion.flood[0]) {
		const R = 1700 * easeOutExpo(Math.max(0, t - ping.hit) / 22);
		if (R < 1600) {
			inkWorld(fr.layers[0].on(), t, z);
			wordWorld(fr.layers[1].on(1), t, z, false);
			const rim = clamp01(1 - Math.max(0, t - ping.hit) / 26);
			fr.flash(PAL.paper, 0.4 * Math.exp(-Math.max(0, t - ping.hit) / 2.5));
			fr.ring(W / 2, H / 2, R, 110, 34 * rim, 9 * rim, 0.7 * rim, PAL.coral);
		} else wordWorld(fr.layers[0].on(), t, z, false);
	} else if (t >= FN.rewind[0] - 78 && t >= CL.iris[1]) {
		finaleWorld(fr.layers[0].on(), t, 1);
	} else if (h >= MT.together[0] && h < CL.iris[0]) {
		togetherFrames(fr, t);
	} else if (h >= CL.iris[0] && t < CL.iris[1]) {
		const p = clamp01((t - CL.iris[0]) / (CL.iris[1] - CL.iris[0]));
		const e = ease.in(p);
		finaleWorld(fr.layers[0].on(), t, 1);
		// the collage of everything, inhaled into the seed
		const zc = lerp(1, 0.16, e);
		const rot = 0.5 * e * e;
		roseWorld(fr.layers[1].on(1), CL.iris[0], 1.15 * zc, P_CORAL, [12, 0.054], 0.02 * 60 + rot);
		const b = MT.builds;
		const pal1: Pal = {bg: PAL.yellow, ink: PAL.yellow, acc: PAL.paper, a: 0};
		scopeWorld(fr.layers[2].on(1), CL.iris[0], 1.04 * zc, [0, 0], pal1, {eOut: 1, eB: 1}, -0.72 - rot);
		wordOnly(fr.layers[3].on(1), CL.iris[0], b[2], {bg: PAL.paper, ink: PAL.paper, acc: PAL.coral, a: 0}, 'MOTION', 0.72, zc, rot, 400, 0.5);
		wordOnly(fr.layers[4].on(1), CL.iris[0], b[3], {bg: PAL.blue, ink: PAL.blue, acc: PAL.paper, a: 0}, 'SOUND', 0.72, zc, rot, -420, 0.5);
		fr.ring(W / 2, H / 2, 1900 * (1 - ease.in(p)), 40, 0, 0, 0.0);
	} else if (h >= MT.from && h < MT.together[0]) {
		montageFrame(fr, t);
	} else if (t >= RG.portal[1] && h < MT.from) {
		plateFrame(fr, t);
	} else if (h >= RG.portal[0]) {
		const age = Math.max(0, t - RG.portal[0]);
		const p = clamp01(age / (RG.portal[1] - RG.portal[0]));
		if (p < 1) {
			// the coral room is born at the seed and runs out to meet the ring, which then opens like a lens
			const z0 = lerp(1, 4.2, ease.inOut(p));
			const Rr = (1500 / Math.PI) * z0;
			const F = 26 + (1500 / Math.PI - 26) * easeOutExpo(age / 9);
			scopeWorld(fr.layers[0].on(), t, z0, [0, 0]);
			roseWorld(fr.layers[1].on(1), t, 1);
			fr.ring(W / 2, H / 2, Math.max(F, Rr), 5, 0, 0, 0);
		} else plateFrame(fr, t);
	} else if (t >= FR.scope[0]) {
		scopeWorld(fr.layers[0].on(), t, 1, [0, 0]);
	} else if (t >= FR.zoom[0]) {
		const p = clamp01((t - FR.zoom[0]) / (FR.zoom[1] - FR.zoom[0]));
		const Z = Math.exp(Math.log(Z_END) * ease.whip(p));
		const g = motionGlyphs(t)[1];
		const cs = Math.cos(g.r);
		const sn = Math.sin(g.r);
		const oc: [number, number] = [g.x + g.s * (OC.cx * cs - OC.cy * sn), g.y + g.s * (OC.cx * sn + OC.cy * cs)];
		const k = (1 - 1 / Z) / (1 - 1 / Z_END);
		const pan0: [number, number] = [oc[0] * k, oc[1] * k];
		const off: [number, number] = [oc[0] * CAM_END * (Z_END - Z) / (Z_END - 1), oc[1] * CAM_END * (Z_END - Z) / (Z_END - 1)];
		const z1 = Z / Z_END;
		wordWorld(fr.layers[0].on(), t, CAM_END * Z, true, pan0);
		scopeWorld(fr.layers[1].on(2, 1, 1), t, z1, [-off[0] / z1, -off[1] / z1]);
	} else {
		const p = clamp01((t - motion.flood[0]) / (motion.flood[1] - motion.flood[0]));
		const R = (2700 * (1 - Math.pow(2, -6 * p))) / (1 - Math.pow(2, -6));
		if (R < 2600) {
			const [px, py] = seedPos(motion.flood[0]);
			wordWorld(fr.layers[0].on(), t, z, false);
			wordWorld(fr.layers[1].on(1), t, z, true);
			const rim = 1 - p;
			fr.ring(W / 2 + px * z, H / 2 + py * z, R, 120, 30 * rim, 8 * rim, 0.6 * rim, PAL.paper);
		} else wordWorld(fr.layers[0].on(), t, z, true);
	}
	// the big hits punch: a two-frame attack, a fast decay
	for (const [ht, amt] of [[sound.lock, 0.16], [RG.portal[0], 0.28], [MT.from, 0.3], [MT.together[1], 0.34], [FN.lock, 0.42]] as [number, number][]) {
		if (h >= ht) fr.flash(PAL.paper, amt * Math.exp(-Math.max(0, t - ht) / 3.2)); // lands on the hit's own frame
	}
	return fr;
};

export const grade = (f: number) => ({grain: 0.028, vig: 0.07, fade: 1 - 0 * f});
void H;
