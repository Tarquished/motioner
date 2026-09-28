import React from 'react';
import {AbsoluteFill} from 'remotion';
import {interpolate as flubberInterpolate} from 'flubber';
import {KineticWord, landingSquash} from './motioner/creative';
import {clamp01, ease, lerp, mixColor, prog, rand} from './motioner/motion';
import {C, displayStyle, layout, MONO, SERIF} from './shared';
import MG from './morph_glyphs.json';
import TLjson from './timeline.json';
import {BL, Letter, SolidWord, WORD, WordParticles, wordInfo, WSIZE} from './word';

export const TL = TLjson;
const W = 1920;
const H = 1080;

/* ═══════════ 01 INTRO: particles spiral in and write "motioner" ═══════════ */
export const Intro: React.FC<{f: number}> = ({f}) => {
	const T = TL.intro;
	const {pts, off, x0} = wordInfo();
	const total = off[off.length - 1];
	const reveal = prog(f, T.wipe[0], T.wipe[1], ease.inOut);
	const edge = lerp(x0 - 30, x0 + total + 30, reveal);
	return (
		<AbsoluteFill style={{background: C.ink}}>
			<WordParticles
				color={C.paper}
				t={(i) => (f - T.particles[0] - ((pts[i].x - x0) / total) * 26 - rand(i * 1.7) * 18) / (T.particles[1] - T.particles[0] - 44)}
				from={(i) => {
					const a = rand(i * 5.1) * Math.PI * 2;
					const r = 620 + rand(i * 2.9) * 520;
					return {x: 960 + Math.cos(a) * r, y: 540 + Math.sin(a) * r * 0.62};
				}}
				fade={(x) => clamp01((x - edge + 6) / 12)}
			/>
			{reveal > 0 ? <SolidWord reveal={reveal} color={C.paper} /> : null}
		</AbsoluteFill>
	);
};

/* ═══════════ 02 TIMING: the t stays, its bar becomes a timeline ═══════════ */
const T_S = 2.6; // scale of the big t
export const RULER_Y = 640;
const tPlacement = () => {
	const {tBar, tBox} = wordInfo();
	// final: t horizontally centred, its crossbar centred on RULER_Y
	const barCy = tBar.y + tBar.h / 2;
	const tCx = tBox.x + tBox.w / 2;
	const dx = 960 - tCx;
	const dy = RULER_Y - barCy;
	return {dx, dy, barCy, tCx};
};
/** screen rect of the t's crossbar at zoom progress k */
const barRect = (k: number) => {
	const {tBar} = wordInfo();
	const {dx, dy, barCy, tCx} = tPlacement();
	const s = lerp(1, T_S, k);
	// transform: scale about (tCx, barCy), then translate by (dx, dy)*k
	const cx = tCx + dx * k;
	const cy = barCy + dy * k;
	return {x: cx + (tBar.x - tCx) * s, y: cy + (tBar.y - barCy) * s, w: tBar.w * s, h: tBar.h * s};
};

const TIMING = 'TIMING';
const TIM_SIZE = 210;
const RULER_X0 = 200;
const RULER_X1 = 1720;
export const playheadX = (f: number) => lerp(RULER_X0, RULER_X1, prog(f, TL.timing.scrub[0] + 10, TL.timing.scrub[1], ease.inOut));
const timingLayout = () => {
	const o = layout(TIMING, TIM_SIZE);
	const w = o[o.length - 1];
	return {o, x0: 960 - w / 2};
};
const TIM_TOP = 312;

export const Timing: React.FC<{f: number}> = ({f}) => {
	const T = TL.timing;
	const {tBox} = wordInfo();
	const {dx, dy, barCy, tCx} = tPlacement();
	const k = prog(f, T.tZoom[0], T.tZoom[1], ease.snap);
	const barOut = prog(f, T.bar[0], T.bar[1], ease.inOut);
	const field = prog(f, T.field[0], T.field[1], ease.inOut);
	const br = barRect(k);
	const bandL = lerp(br.x, -10, barOut);
	const bandR = lerp(br.x + br.w, W + 10, barOut);
	const bandT = lerp(br.y, -10, field);
	const bandB = lerp(br.y + br.h, H + 10, field);
	const ruler = prog(f, T.ruler[0], T.ruler[1], ease.out);
	const ph = playheadX(f);
	const phGrow = prog(f, T.scrub[0], T.scrub[0] + 10, ease.out);
	const {o, x0} = timingLayout();
	const bg = f >= T.field[1] ? C.paper : C.ink;
	return (
		<AbsoluteFill style={{background: bg}}>
			{/* the other letters fall away */}
			{f < T.field[1]
				? Array.from(WORD).map((_, i) => {
						if (i === 2) return null;
						const order = [3, 1, 0, 0, 2, 1, 3, 2][i];
						const t = clamp01((f - T.drop[0] - order * 3) / (T.drop[1] - T.drop[0] - 9));
						if (t >= 1) return null;
						const u = t * t;
						const rot = (rand(i * 7.1) - 0.5) * 50 * u;
						return <Letter key={i} i={i} color={C.paper} tr={`translate(${(rand(i) - 0.5) * 60 * u}px, ${900 * u}px) rotate(${rot}deg)`} />;
					})
				: null}
			{/* the t grows into the centre; its crossbar extends into a band, then a field */}
			{f < T.field[1] ? (
				<BigT k={k} />
			) : null}
			{f >= T.bar[0] && f < T.field[1] + 2 ? <div style={{position: 'absolute', left: bandL, top: bandT, width: bandR - bandL, height: bandB - bandT, background: C.paper}} /> : null}
			{/* timeline on paper */}
			{f >= T.ruler[0] ? (
				<>
					<div style={{position: 'absolute', left: 960 - (960 - RULER_X0) * ruler, top: RULER_Y - 1.5, width: (RULER_X1 - RULER_X0) * ruler, height: 3, background: C.ink}} />
					{Array.from({length: 17}, (_, i) => {
						const x = RULER_X0 + ((RULER_X1 - RULER_X0) * i) / 16;
						const on = prog(f, T.ruler[0] + Math.abs(i - 8) * 1.2, T.ruler[0] + Math.abs(i - 8) * 1.2 + 10, ease.out);
						const big = i % 4 === 0;
						return (
							<React.Fragment key={i}>
								<div style={{position: 'absolute', left: x - 1, top: RULER_Y + 8, width: 2, height: (big ? 26 : 14) * on, background: C.ink, opacity: 0.8}} />
								{big ? <div style={{position: 'absolute', left: x - 40, width: 80, top: RULER_Y + 42, textAlign: 'center', fontFamily: MONO, fontSize: 18, letterSpacing: '0.08em', color: C.ink, opacity: 0.7 * on}}>{`00:0${i / 4}`}</div> : null}
							</React.Fragment>
						);
					})}
					{/* keyframe diamonds: pop when the playhead reaches them */}
					{[0.22, 0.5, 0.78].map((p, j) => {
						const x = lerp(RULER_X0, RULER_X1, p);
						const t = ph >= x ? clamp01(springLike(f - firstFrameAt(x))) : 0;
						return <div key={j} style={{position: 'absolute', left: x - 13, top: RULER_Y - 13, width: 26, height: 26, background: C.coral, transform: `rotate(45deg) scale(${t})`}} />;
					})}
					{/* playhead */}
					<div style={{position: 'absolute', left: ph - 2, top: RULER_Y - 150 * phGrow, width: 4, height: 150 * phGrow + 34, background: C.coral}} />
					<div style={{position: 'absolute', left: ph - 11, top: RULER_Y - 150 * phGrow - 18, width: 22, height: 22, borderRadius: 5, background: C.coral, opacity: phGrow}} />
					{/* TIMING: each letter appears exactly when the playhead reaches it */}
					{Array.from(TIMING).map((ch, i) => {
						const lx = x0 + o[i];
						const f0 = firstFrameAt(lx + (o[i + 1] - o[i]) * 0.3);
						const t = f - f0;
						if (t < 0) return null;
						const pop = t < 2 ? 1.08 : t < 4 ? 1.03 : 1;
						return (
							<span key={i} style={{...displayStyle(TIM_SIZE, C.ink), position: 'absolute', left: lx, top: TIM_TOP, transform: `scale(${pop})`, transformOrigin: '50% 100%'}}>
								{ch}
							</span>
						);
					})}
				</>
			) : null}
			{void tBox}
		</AbsoluteFill>
	);
};
/** The t drawn at its true size for zoom progress k (font size scales, nothing is up-sampled). */
const BigT: React.FC<{k: number}> = ({k}) => {
	const {off, x0, top} = wordInfo();
	const {dx, dy, barCy, tCx} = tPlacement();
	const s = lerp(1, T_S, k);
	const cx = tCx + dx * k;
	const cy = barCy + dy * k;
	const left = cx + (x0 + off[2] - tCx) * s;
	const tp = cy + (top - barCy) * s;
	return <span style={{...displayStyle(WSIZE * s, C.paper), position: 'absolute', left, top: tp}}>t</span>;
};
const springLike = (t: number) => (t < 0 ? 0 : 1 + Math.exp(-t / 4) * Math.sin(t * 0.9) * 0.35 - Math.exp(-t / 2) * (1 - Math.min(1, t / 3)));
/** first frame at which the playhead reaches x */
export const firstFrameAt = (x: number) => {
	for (let f = TL.timing.scrub[0]; f <= TL.timing.scrub[1] + 1; f++) if (playheadX(f) >= x) return f;
	return 99999;
};
export const timingLetterFrames = () => {
	const {o, x0} = timingLayout();
	return Array.from(TIMING).map((_, i) => firstFrameAt(x0 + o[i] + (o[i + 1] - o[i]) * 0.3));
};
export const keyFrames = () => [0.22, 0.5, 0.78].map((p) => firstFrameAt(lerp(RULER_X0, RULER_X1, p)));

/* ═══════════ 03 SOUND: the timeline becomes a plucked string ═══════════
 * The ruler line is a real string: every impact plucks it (standing modes of a plucked string,
 * each decaying at its own rate). TIMING falls into it, SOUND is flung out of it and then rides
 * it like objects on a trampoline (gravity, contact, launch, squash, rotation that lags the slope).
 * On every kick the string is plucked again; at the end the coral wave rises and throws the
 * letters out of the top of the frame. */
const SOUND = 'SOUND';
const SND_SIZE = 230;
const SIM0 = 300;
const SIM1 = 500;
const LAUNCH0 = 330;
const LAUNCH_STEP = 4;
export const floodLevel = (f: number) => lerp(H + 260, -300, prog(f, TL.sound.flood[0], TL.sound.flood[1], ease.inOut));
const stringEnds = (f: number) => {
	const widen = prog(f, TL.sound.sink[0], TL.sound.sink[0] + 20, ease.inOut);
	return {xa: lerp(RULER_X0, -20, widen), xb: lerp(RULER_X1, W + 20, widen), widen};
};
type Pluck = {f: number; x: number; a: number};
let PLUCKS: Pluck[] | null = null;
const soundLayout = () => {
	const so = layout(SOUND, SND_SIZE).map((v, i) => v + i * SND_SIZE * 0.1);
	const sx0 = 960 - so[so.length - 1] / 2;
	const cx = Array.from(SOUND).map((_, i) => sx0 + so[i] + (so[i + 1] - so[i] - SND_SIZE * 0.1) / 2);
	return {so, sx0, cx};
};
export const timingLandings = () => Array.from(TIMING).map((_, i) => TL.sound.sink[0] + i * 2 + 14);
export const soundLaunches = () => Array.from(SOUND).map((_, i) => LAUNCH0 + i * LAUNCH_STEP);
export const STRING_BEATS = [360, 390, 420, 450];
export const STRING_OFFBEATS = [375, 405, 435];
const plucks = (): Pluck[] => {
	if (PLUCKS) return PLUCKS;
	const {o, x0} = timingLayout();
	const {cx} = soundLayout();
	const P: Pluck[] = [];
	timingLandings().forEach((f, i) => P.push({f, x: x0 + (o[i] + o[i + 1]) / 2, a: 44}));
	soundLaunches().forEach((f, i) => P.push({f, x: cx[i], a: -58}));
	STRING_BEATS.forEach((f, j) => P.push({f, x: [960, 560, 1360, 820][j], a: -100}));
	STRING_OFFBEATS.forEach((f, j) => P.push({f, x: [1300, 700, 1100][j], a: -40}));
	PLUCKS = P;
	return P;
};
const MODES = [1, 2, 3, 4, 5];
const W1 = (2 * Math.PI) / 22;
/** string displacement (px, + is down) */
const disp = (x: number, f: number) => {
	const {xa, xb} = stringEnds(f);
	const L = xb - xa;
	const u = (x - xa) / L;
	if (u <= 0 || u >= 1) return 0;
	let y = 0;
	for (const p of plucks()) {
		const t = f - p.f;
		if (t < 0) continue;
		const up = Math.min(0.97, Math.max(0.03, (p.x - xa) / L));
		const att = t < 3 ? (t / 3) * (t / 3) * (3 - 2 * (t / 3)) : 1;
		let v = 0;
		let norm = 0;
		for (const n of MODES) {
			const c = 1 / Math.pow(n, 1.25);
			const sp = Math.sin(n * Math.PI * up);
			norm += c * sp * sp;
			v += c * sp * Math.sin(n * Math.PI * u) * Math.cos(n * W1 * t) * Math.exp(-t / (30 / Math.pow(n, 0.8)));
		}
		y += (p.a * att * v) / Math.max(1e-3, norm);
	}
	return y;
};
const stringY = (x: number, f: number, lag = 0, k = 1) => RULER_Y + k * disp(x, f - lag);
const floodY = (x: number, f: number) => floodLevel(f) + 0.8 * disp(x, f);
const surfaceY = (x: number, f: number) => Math.min(stringY(x, f), f >= TL.sound.flood[0] - 2 ? floodY(x, f) : 1e9);

type LState = {on: boolean; y: number; vy: number; rot: number; rv: number; sq: number; age: number};
let SIM: LState[][] | null = null;
const simulate = () => {
	if (SIM) return SIM;
	const {cx} = soundLayout();
	const L = soundLaunches();
	const out: LState[][] = [];
	const st: LState[] = cx.map(() => ({on: false, y: RULER_Y, vy: 0, rot: 0, rv: 0, sq: 0, age: 0}));
	for (let f = SIM0; f <= SIM1; f++) {
		const row: LState[] = [];
		cx.forEach((x, i) => {
			const s = st[i];
			const ys = surfaceY(x, f);
			const vs = ys - surfaceY(x, f - 1);
			if (!s.on) {
				if (f === L[i]) {
					s.on = true;
					s.y = ys;
					s.vy = -(21 + 7 * rand(i * 4.7));
					s.rv = (rand(i * 9.1) - 0.5) * 5;
				}
			} else {
				s.age++;
				s.vy += 1.15;
				s.y += s.vy;
				let contact = false;
				if (s.y >= ys) {
					const impact = s.vy - vs;
					if (impact > 2) s.sq = Math.max(s.sq, Math.min(0.28, impact * 0.016));
					s.y = ys;
					s.vy = vs < 0 ? vs * 1.12 : vs;
					contact = true;
				}
				const slope = (surfaceY(x + 40, f) - surfaceY(x - 40, f)) / 80;
				const target = contact ? ((Math.atan(slope) * 180) / Math.PI) * 1.0 : s.rot * 0.97;
				s.rv += (target - s.rot) * (contact ? 0.16 : 0.03);
				s.rv *= 0.8;
				s.rot += s.rv;
				s.sq *= 0.78;
			}
			row.push({...s});
		});
		out.push(row);
	}
	SIM = out;
	return out;
};
/** frames where a SOUND letter lands on the string hard enough to squash (for sound cues) */
export const soundLandings = () => {
	const sim = simulate();
	const res: {f: number; i: number}[] = [];
	for (let k = 1; k < sim.length; k++) sim[k].forEach((s, i) => {
		if (s.on && s.sq > 0.08 && s.sq > sim[k - 1][i].sq * 1.3) res.push({f: SIM0 + k, i});
	});
	return res;
};

export const Sound: React.FC<{f: number}> = ({f}) => {
	const T = TL.sound;
	const {o: to, x0: tx0} = timingLayout();
	const {so, sx0, cx} = soundLayout();
	const {xa, xb, widen} = stringEnds(f);
	const path = (lag: number, k: number) => {
		let d = '';
		for (let x = xa; x <= xb + 9.9; x += 10) {
			const xx = Math.min(x, xb);
			d += `${x === xa ? 'M' : 'L'}${xx.toFixed(1)},${stringY(xx, f, lag, k).toFixed(1)} `;
		}
		return d;
	};
	let fill = '';
	for (let x = -20; x <= W + 20; x += 10) fill += `${x === -20 ? 'M' : 'L'}${x},${floodY(x, f).toFixed(1)} `;
	fill += `L${W + 20},${H + 20} L-20,${H + 20} Z`;
	const ph = playheadX(f);
	const echoes = prog(f, 312, 330);
	const sim = simulate()[Math.min(SIM1, Math.max(SIM0, f)) - SIM0];
	return (
		<AbsoluteFill style={{background: C.paper}}>
			<svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
				{/* echoes of the string a few frames behind: the vibration leaves a trail */}
				<path d={path(8, 0.75)} fill="none" stroke={C.blue} strokeWidth={4} strokeLinecap="round" opacity={0.85 * echoes} />
				<path d={path(4, 0.9)} fill="none" stroke={C.coral} strokeWidth={4} strokeLinecap="round" opacity={0.9 * echoes} />
				<path d={path(0, 1)} fill="none" stroke={C.ink} strokeWidth={lerp(3, 6, widen)} strokeLinecap={widen < 1 ? 'butt' : 'round'} />
				{f >= T.flood[0] - 2 ? <path d={fill} fill={C.coral} /> : null}
			</svg>
			{/* ruler ticks, keyframes and playhead fall away as the line becomes a string */}
			{f < 330
				? Array.from({length: 17}, (_, i) => {
						const x = RULER_X0 + ((RULER_X1 - RULER_X0) * i) / 16;
						const t = prog(f, T.sink[0] + i * 0.6, T.sink[0] + i * 0.6 + 14, ease.in);
						return (
							<React.Fragment key={i}>
								<div style={{position: 'absolute', left: x - 1, top: RULER_Y + 8 + 60 * t, width: 2, height: i % 4 === 0 ? 26 : 14, background: C.ink, opacity: 0.8 * (1 - t)}} />
								{i % 4 === 0 ? <div style={{position: 'absolute', left: x - 40, width: 80, top: RULER_Y + 42 + 60 * t, textAlign: 'center', fontFamily: MONO, fontSize: 18, letterSpacing: '0.08em', color: C.ink, opacity: 0.7 * (1 - t)}}>{`00:0${i / 4}`}</div> : null}
							</React.Fragment>
						);
					})
				: null}
			{f < 330
				? [0.22, 0.5, 0.78].map((p, j) => {
						const x = lerp(RULER_X0, RULER_X1, p);
						const t = prog(f, T.sink[0] + 2 + j * 2, T.sink[0] + 16 + j * 2, ease.in);
						return <div key={`k${j}`} style={{position: 'absolute', left: x - 13, top: RULER_Y - 13 + 70 * t, width: 26, height: 26, background: C.coral, transform: `rotate(${45 + 90 * t}deg)`, opacity: 1 - t}} />;
					})
				: null}
			{f < 326
				? (() => {
						const fall = 200 * prog(f, T.sink[0], T.sink[0] + 18, ease.in);
						const o = 1 - prog(f, T.sink[0] + 6, T.sink[0] + 18);
						return (
							<>
								<div style={{position: 'absolute', left: ph - 2, top: RULER_Y - 150 + fall, width: 4, height: 184, background: C.coral, opacity: o}} />
								<div style={{position: 'absolute', left: ph - 11, top: RULER_Y - 168 + fall, width: 22, height: 22, borderRadius: 5, background: C.coral, opacity: o}} />
							</>
						);
					})()
				: null}
			{/* TIMING falls into the string: each letter squeezes into it and plucks it on contact */}
			{Array.from(TIMING).map((ch, i) => {
				const t = prog(f, T.sink[0] + i * 2, T.sink[0] + i * 2 + 14, ease.in);
				if (t >= 1) return null;
				return (
					<span key={i} style={{...displayStyle(TIM_SIZE, C.ink), position: 'absolute', left: tx0 + to[i], top: TIM_TOP, transformOrigin: `50% ${((RULER_Y - TIM_TOP) / TIM_SIZE) * 100}%`, transform: `scale(${1 - 0.25 * t}, ${1 - t})`}}>
						{ch}
					</span>
				);
			})}
			{/* SOUND: flung out of the string, then riding it */}
			{Array.from(SOUND).map((ch, i) => {
				const s = sim[i];
				if (!s || !s.on) return null;
				const grow = ease.out(clamp01(s.age / 9));
				const sx = (1 + 0.55 * s.sq) * lerp(0.55, 1, grow);
				const sy = (1 - s.sq) * grow;
				return (
					<span
						key={i}
						style={{
							...displayStyle(SND_SIZE, C.ink),
							position: 'absolute',
							left: sx0 + so[i],
							top: s.y - 3 - SND_SIZE * 0.86,
							transformOrigin: `${cx[i] - sx0 - so[i]}px ${SND_SIZE * 0.86}px`,
							transform: `rotate(${s.rot.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`,
						}}
					>
						{ch}
					</span>
				);
			})}
		</AbsoluteFill>
	);
};

/* ═══════════ 04 MORPH: the O falls back and becomes every other letter ═══════════
 * The O that the flood threw out of SOUND falls back into the frame and bounces. Copies of it
 * hop out one by one and morph in flight into M, R, P and H, spelling MORPH around it (the
 * word acts out its meaning). On the next bar every letter morphs back into an O, the five O's
 * slide together into one, the O becomes a ring, and the ring opens as a portal onto the scenes.
 * All glyphs are real outlines of Archivo 800 at 125 % width (morph_glyphs.json, fontTools). */
type Glyph = {adv: number; contours: string[]; bounds: number[][]};
const GL = (MG as unknown as {upm: number; glyphs: Record<string, Glyph>}).glyphs;
const MORPH = 'MORPH';
const MK = 0.3; // px per font unit (300 px type)
const TRACK = -20; // font units between letters
const O_CX = 506; // centre of the O's bowl in font units
const O_CY = 344;
const MBASE = 540 + O_CY * MK; // baseline that puts the O's centre on the frame centre
const slotX = (() => {
	const advs = Array.from(MORPH).map((c) => GL[c].adv);
	const total = advs.reduce((a, b) => a + b, 0) + TRACK * (advs.length - 1);
	let x = 960 - (total * MK) / 2;
	return advs.map((a) => {
		const v = x;
		x += (a + TRACK) * MK;
		return v;
	});
})();
const O_SLOT = 1;
const X_CENTER = 960 - O_CX * MK; // glyph origin that centres the O's bowl on the frame
// the ring the O becomes (font units, centred on the O's bowl): hole 230, band 100
const RING_IN = 230;
const RING_OUT = 330;
const circlePath = (cx: number, cy: number, r: number) => `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
const RING = {outer: circlePath(O_CX, O_CY, RING_OUT), hole: circlePath(O_CX, O_CY, RING_IN)};
// letters without a counter get a vanishing hole inside their left stem
const tinyHole = (ch: string) => circlePath(ch === 'M' ? 190 : 185, 344, 1);
const outerOf = (ch: string) => GL[ch].contours[0];
const holeOf = (ch: string) => GL[ch].contours[1] ?? tinyHole(ch);
const INTERP = new Map<string, (t: number) => string>();
const morphD = (a: string, b: string, t: number) => {
	if (t <= 0) return a;
	if (t >= 1) return b;
	const key = a + '|' + b;
	if (!INTERP.has(key)) INTERP.set(key, flubberInterpolate(a, b, {maxSegmentLength: 12}));
	return INTERP.get(key)!(t);
};
const glyphD = (from: {outer: string; hole: string; tiny?: boolean}, to: {outer: string; hole: string; tiny?: boolean}, t: number) => {
	// a counter that disappears closes early; one that appears opens late, so no bite is left in a stem
	const th = to.tiny ? clamp01(t * 1.8) : from.tiny ? clamp01((t - 0.45) / 0.55) : t;
	return morphD(from.outer, to.outer, t) + ' ' + morphD(from.hole, to.hole, th);
};
const shapeOf = (ch: string) => ({outer: outerOf(ch), hole: holeOf(ch), tiny: !GL[ch].contours[1]});

const MorphGlyph: React.FC<{d: string; x: number; base: number; sx?: number; sy?: number; scale?: number; opacity?: number}> = ({d, x, base, sx = 1, sy = 1, scale = 1, opacity = 1}) => {
	// squash about the glyph's bottom centre, then font units -> px (y up -> y down)
	const cx = x + O_CX * MK * scale;
	return (
		<g opacity={opacity} transform={`translate(${cx.toFixed(2)},${base.toFixed(2)}) scale(${sx.toFixed(4)},${sy.toFixed(4)}) translate(${(-cx).toFixed(2)},${(-base).toFixed(2)})`}>
			<path d={d} fillRule="evenodd" fill={C.paper} transform={`translate(${x.toFixed(2)},${base.toFixed(2)}) scale(${(MK * scale).toFixed(4)},${(-MK * scale).toFixed(4)})`} />
		</g>
	);
};

/** where the falling O is (x of its glyph origin, baseline) */
const fallingO = (f: number) => {
	const T = TL.idea;
	const {cx} = soundLayout();
	const x0 = cx[1] - O_CX * MK;
	const x1 = slotX[O_SLOT];
	const t = clamp01((f - T.fall[0]) / (T.fall[1] - T.fall[0]));
	const top = -80; // baseline above the frame (the glyph is fully hidden)
	return {x: lerp(x0, x1, t), base: top + (MBASE - top) * t * t};
};
const BOUNCE_H = 70;
const oBase = (f: number) => {
	const T = TL.idea;
	if (f < T.fall[1]) return fallingO(f).base;
	const s = (f - T.fall[1]) / (T.bounce[1] - T.fall[1]);
	return s < 1 ? MBASE - BOUNCE_H * 4 * s * (1 - s) : MBASE;
};
const oSquash = (f: number) => {
	const T = TL.idea;
	const a = landingSquash(f, T.fall[1], 0.3, 16);
	const b = landingSquash(f, T.bounce[1], 0.14, 14);
	return {sx: a.sx * b.sx, sy: a.sy * b.sy};
};
const CARRIER_SLOT = [0, 2, 3, 4]; // M, R, P, H in the order they hop out
export const carrierStarts = () => TL.idea.carriers;
const carrierState = (f: number, j: number) => {
	const T = TL.idea;
	const t0 = T.carriers[j];
	const t = clamp01((f - t0) / T.carrierDur);
	const u = ease.snap(t);
	const slot = CARRIER_SLOT[j];
	const from = slotX[O_SLOT];
	const to = slotX[slot];
	const hop = 150 + 40 * Math.abs(slot - O_SLOT);
	const x = lerp(from, to, u);
	const base = MBASE - hop * 4 * u * (1 - u);
	const land = landingSquash(f, t0 + T.carrierDur, 0.16, 14);
	// stretch along the hop while fast
	const v = Math.abs(ease.snap(clamp01((f + 0.5 - t0) / T.carrierDur)) - ease.snap(clamp01((f - 0.5 - t0) / T.carrierDur)));
	const st = 1 + Math.min(0.18, v * 1.6);
	return {t, x, base, sx: land.sx / st, sy: land.sy * st, ch: MORPH[slot]};
};

export const Idea: React.FC<{f: number; inner: React.ReactNode}> = ({f, inner}) => {
	const T = TL.idea;
	const back = prog(f, T.back[0], T.back[1], ease.snap);
	const conv = prog(f, T.converge[0], T.converge[1], ease.inOut);
	const O = shapeOf('O');
	const ringScale = lerp(1, 150 / (RING_IN * MK), prog(f, T.converge[1], T.iris[1], ease.inOut));
	const holePx = RING_IN * MK * ringScale;
	const bandPx = (RING_OUT - RING_IN) * MK * Math.sqrt(ringScale);
	const iris = prog(f, T.iris[0], T.iris[1], ease.out);
	const portal = prog(f, T.portal[0], T.portal[1], ease.expand);
	const far = Math.hypot(960, 540) * 1.05;
	const hole = lerp(holePx, far, portal);
	const glyphs: React.ReactNode[] = [];
	if (f < T.converge[1]) {
		// the O itself
		const oD = glyphD(O, RING, conv);
		const sq = oSquash(f);
		const x = lerp(f < T.fall[1] ? fallingO(f).x : slotX[O_SLOT], X_CENTER, conv);
		glyphs.push(<MorphGlyph key="o" d={oD} x={x} base={oBase(f)} sx={sq.sx} sy={sq.sy} />);
		// the copies: O -> letter in flight, letter -> O on the back beat, then slide into the centre
		T.carriers.forEach((t0, j) => {
			if (f < t0) return;
			const c = carrierState(f, j);
			const L = shapeOf(c.ch);
			let d = glyphD(O, L, c.t);
			if (back > 0) d = glyphD(L, O, back);
			if (conv > 0) d = glyphD(O, RING, conv);
			const x = lerp(c.x, X_CENTER, conv);
			glyphs.push(<MorphGlyph key={j} d={d} x={x} base={c.base} sx={c.sx} sy={c.sy} />);
		});
	}
	// designer's notes under each letter: which shape it came from
	const notes = CARRIER_SLOT.map((slot, j) => {
		const on = prog(f, T.carriers[j] + T.carrierDur - 2, T.carriers[j] + T.carrierDur + 10, ease.out) * (1 - prog(f, T.back[0] - 8, T.back[0] + 4));
		if (on <= 0) return null;
		const cx = slotX[slot] + (GL[MORPH[slot]].adv * MK) / 2;
		return (
			<div key={slot} style={{position: 'absolute', left: cx - 80, width: 160, top: MBASE + 34 + (1 - on) * 10, textAlign: 'center', fontFamily: MONO, fontSize: 20, letterSpacing: '0.12em', color: C.ink, opacity: 0.75 * on}}>
				O → {MORPH[slot]}
			</div>
		);
	});
	return (
		<AbsoluteFill style={{background: C.coral}}>
			{/* the portal: scenes inside the ring's hole */}
			{iris > 0 ? <AbsoluteFill style={{clipPath: `circle(${((portal > 0 ? hole : iris * holePx) + 0.5).toFixed(1)}px at 960px 540px)`}}>{inner}</AbsoluteFill> : null}
			<svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
				<g style={{filter: 'drop-shadow(0 14px 24px rgba(80,20,10,0.22))'}}>{glyphs}</g>
				{f >= T.converge[1] && portal < 1 ? (
					<circle cx={960} cy={540} r={hole + bandPx / 2} fill="none" stroke={C.paper} strokeWidth={bandPx} opacity={1 - prog(f, T.portal[0] + 6, T.portal[1] - 6)} style={{filter: 'drop-shadow(0 14px 24px rgba(80,20,10,0.22))'}} />
				) : null}
			</svg>
			{notes}
		</AbsoluteFill>
	);
};

/* ═══════════ 05 SCENES: pull back from one scene to a wall of scenes ═══════════ */
const COLS = 6;
const ROWS = 4;
const TW = 270;
const TH = 170;
const GAP = 26;
const GX0 = (W - (COLS * TW + (COLS - 1) * GAP)) / 2;
const GY0 = (H - (ROWS * TH + (ROWS - 1) * GAP)) / 2;
export const tileCenter = (c: number, r: number) => ({x: GX0 + c * (TW + GAP) + TW / 2, y: GY0 + r * (TH + GAP) + TH / 2});
const FOCUS = {c: 2, r: 1};
const TILE_BG = [C.ink, C.paper, C.coral, '#1C25B8', C.paper, C.ink];

const MiniScene: React.FC<{kind: number; f: number; bg: string; seed: number}> = ({kind, f, bg, seed}) => {
	const fg = bg === C.paper || bg === C.coral ? C.ink : C.paper;
	const acc = bg === C.coral ? C.paper : C.coral;
	const t = f + seed * 13;
	const el: React.ReactNode[] = [];
	if (kind === 0) {
		const a = t * 0.08;
		el.push(<circle key="r" cx={135} cy={85} r={48} fill="none" stroke={fg} strokeOpacity={0.35} strokeWidth={2} />);
		el.push(<circle key="d" cx={135 + Math.cos(a) * 48} cy={85 + Math.sin(a) * 48} r={11} fill={acc} />);
		el.push(<circle key="c" cx={135} cy={85} r={6} fill={fg} />);
	} else if (kind === 1) {
		let d = '';
		for (let x = 20; x <= 250; x += 6) d += `${x === 20 ? 'M' : 'L'}${x},${(85 + 30 * Math.sin(x / 26 - t * 0.12)).toFixed(1)} `;
		el.push(<path key="w" d={d} fill="none" stroke={acc} strokeWidth={5} strokeLinecap="round" />);
	} else if (kind === 2) {
		const p = (t % 90) / 90;
		el.push(<line key="l" x1={24} y1={110} x2={246} y2={110} stroke={fg} strokeWidth={3} />);
		el.push(<rect key="p" x={24 + 222 * ease.inOut(p) - 2} y={52} width={4} height={70} fill={acc} />);
		[0.25, 0.55, 0.8].forEach((q, j) => el.push(<rect key={j} x={24 + 222 * q - 7} y={103} width={14} height={14} fill={p > q ? acc : 'none'} stroke={acc} strokeWidth={2} transform={`rotate(45 ${24 + 222 * q} 110)`} />));
	} else if (kind === 3) {
		el.push(<rect key="s" x={135 - 36} y={85 - 36} width={72} height={72} rx={14} fill={acc} transform={`rotate(${t * 2.2} 135 85)`} />);
	} else {
		for (let i = 0; i < 7; i++)
			for (let j = 0; j < 3; j++) {
				const s = 0.5 + 0.5 * Math.sin(t * 0.14 - i * 0.7 - j * 0.5);
				el.push(<circle key={`${i}-${j}`} cx={45 + i * 30} cy={55 + j * 30} r={3 + 6 * s} fill={i === 3 && j === 1 ? acc : fg} />);
			}
	}
	return (
		<svg width={TW} height={TH} style={{position: 'absolute', inset: 0}}>
			{el}
		</svg>
	);
};

const seqGlow = (f: number, c: number) => {
	const T = TL.scenes;
	if (f < T.seq[0] || f > T.seq[1] + 20) return 0;
	let g = 0;
	for (let s = 0; s * 15 + T.seq[0] <= Math.min(f, T.seq[1]); s++) {
		if (s % COLS !== c) continue;
		const d = f - (T.seq[0] + s * 15);
		g = Math.max(g, d < 0 ? 0 : d < 2 ? d / 2 : Math.exp(-(d - 2) / 8));
	}
	return g;
};

export const Scenes: React.FC<{f: number; shrink?: number; bg?: string}> = ({f, shrink = 0, bg: field = C.blue}) => {
	const T = TL.scenes;
	const pull = prog(f, T.pull[0], T.pull[1], ease.inOut);
	const fc = tileCenter(FOCUS.c, FOCUS.r);
	const s = lerp(3.4, 1, pull) * (1 + 0.01 * Math.sin(f * 0.03) * (1 - prog(f, 800, 840)));
	const cx = lerp(fc.x, 960, pull);
	const cy = lerp(fc.y, 540, pull);
	return (
		<AbsoluteFill style={{background: field}}>
			<AbsoluteFill style={{transformOrigin: '0 0', transform: `translate(960px, 540px) scale(${s}) translate(${-cx}px, ${-cy}px)`}}>
				{Array.from({length: COLS * ROWS}, (_, i) => {
					const c = i % COLS;
					const r = Math.floor(i / COLS);
					const {x, y} = tileCenter(c, r);
					const bg = TILE_BG[(c + r * 2) % TILE_BG.length];
					const g = seqGlow(f, c);
					const sh = clamp01(shrink * 1.3 - Math.min(1, Math.hypot(x - 960, y - 540) / 1000) * 0.3);
					const k = ease.snap(sh);
					const w = lerp(TW, 8, k);
					const h = lerp(TH, 8, k);
					return (
						<div
							key={i}
							style={{
								position: 'absolute',
								left: x - w / 2,
								top: y - h / 2,
								width: w,
								height: h,
								borderRadius: lerp(16, 4, k),
								background: shrink > 0 ? mixColor(bg, C.paper, k) : bg,
								overflow: 'hidden',
								transform: `scale(${1 + 0.05 * g})`,
								boxShadow: g > 0.01 ? `0 0 0 ${3 * g}px ${C.paper}` : undefined,
							}}
						>
							{k < 0.5 ? (
								<div style={{position: 'absolute', left: (w - TW) / 2, top: (h - TH) / 2, width: TW, height: TH, opacity: 1 - k * 2}}>
									<MiniScene kind={(c * 3 + r) % 5} f={f} bg={bg} seed={i} />
									<div style={{position: 'absolute', left: 14, top: 10, fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', color: bg === C.paper || bg === C.coral ? C.ink : C.paper, opacity: 0.6}}>SCENE {String(i + 1).padStart(2, '0')}</div>
									{g > 0.01 ? <div style={{position: 'absolute', inset: 0, background: '#fff', opacity: 0.22 * g}} /> : null}
								</div>
							) : null}
						</div>
					);
				})}
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

const WORDS = ['WRITE', 'IT.', 'WATCH', 'IT MOVE.'];
export const SceneWords: React.FC<{f: number}> = ({f}) => {
	const T = TL.scenes;
	const dim = prog(f, T.words[0] - 6, T.words[0] + 4) * (1 - prog(f, TL.outro.shrink[0] - 4, TL.outro.shrink[0] + 14, ease.inOut));
	let k = -1;
	T.words.forEach((w, j) => {
		if (f >= w) k = j;
	});
	const out = prog(f, TL.outro.shrink[0] - 6, TL.outro.shrink[0] + 10, ease.inOut);
	return (
		<>
			<AbsoluteFill style={{background: C.ink, opacity: 0.5 * dim}} />
			{k >= 0 && out < 1 ? (
				<AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: 1 - out, transform: `translateY(${-40 * out}px)`}}>
					<KineticWord text={WORDS[k]} frame={f} start={T.words[k]} mode={k % 2 ? 'snap' : 'smear'} dur={k % 2 ? 6 : 10} stagger={1} amount={1.1} style={displayStyle(240, C.paper)} id={`sw${k}`} />
				</AbsoluteFill>
			) : null}
		</>
	);
};

/* ═══════════ 06 OUTRO: the scenes become particles and write "motioner" again ═══════════ */
export const Outro: React.FC<{f: number}> = ({f}) => {
	const T = TL.outro;
	const {pts, off, x0} = wordInfo();
	const total = off[off.length - 1];
	const reveal = prog(f, T.wipe[0], T.wipe[1], ease.inOut);
	const edge = lerp(x0 - 30, x0 + total + 30, reveal);
	const minY = Math.min(...pts.map((p) => p.y));
	const maxY = Math.max(...pts.map((p) => p.y));
	const tag = ease.out(clamp01((f - T.tagline) / 20));
	const foot = prog(f, T.footer, T.footer + 18, ease.out);
	const pulse = T.pulses.reduce((s, pf) => s + (f >= pf ? (f - pf < 2 ? (f - pf) / 2 : Math.exp(-(f - pf - 2) / 7)) * 0.35 : 0), 0);
	return (
		<AbsoluteFill style={{background: C.ink}}>
			<WordParticles
				color={C.paper}
				swirl={0.5}
				startOpacity={1}
				t={(i) => (f - T.fly[0] - ((pts[i].x - x0) / total) * 14 - rand(i * 2.3) * 8) / (T.fly[1] - T.fly[0] - 22)}
				from={(i) => {
					const c = Math.min(COLS - 1, Math.floor(((pts[i].x - x0) / total) * COLS));
					const r = Math.min(ROWS - 1, Math.floor(((pts[i].y - minY) / (maxY - minY + 1)) * ROWS));
					return tileCenter(c, r);
				}}
				fade={(x) => clamp01((x - edge + 6) / 12)}
			/>
			{reveal > 0 ? <SolidWord reveal={reveal} color={C.paper} tittleScale={1 + pulse} /> : null}
			<div style={{position: 'absolute', left: 0, width: W, top: BL + 60, height: 96, overflow: 'hidden', textAlign: 'center'}}>
				<div style={{fontFamily: SERIF, fontStyle: 'italic', fontSize: 80, lineHeight: '96px', color: C.paper, opacity: 0.9, transform: `translateY(${(1 - tag) * 100}%)`}}>your ideas, in motion.</div>
			</div>
			<div style={{position: 'absolute', left: 0, width: W, top: BL + 190, textAlign: 'center', fontFamily: MONO, fontSize: 17, letterSpacing: '0.2em', color: C.paper, opacity: 0.6 * foot, transform: `translateY(${(1 - foot) * 10}px)`}}>
				EVERY FRAME AND EVERY SOUND WRITTEN IN CODE
			</div>
			{T.pulses.map((pf, j) => {
				const {tittle} = wordInfo();
				const t = clamp01((f - pf) / 28);
				return f >= pf && t < 1 ? (
					<div key={j} style={{position: 'absolute', left: tittle.x + tittle.w / 2 - 20 - 50 * ease.out(t), top: tittle.y + tittle.h / 2 - 20 - 50 * ease.out(t), width: 40 + 100 * ease.out(t), height: 40 + 100 * ease.out(t), borderRadius: '50%', border: `2px solid ${C.coral}`, opacity: 0.8 * (1 - t), boxSizing: 'border-box'}} />
				) : null;
			})}
			{void WSIZE}
		</AbsoluteFill>
	);
};
