import React from 'react';
import {AbsoluteFill} from 'remotion';
import {KineticWord, LensPortal} from './motioner/creative';
import {clamp01, ease, lerp, mixColor, poseTrack, prog, rand} from './motioner/motion';
import {C, displayStyle, layout, MONO, SERIF} from './shared';
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
				<div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: `${tCx}px ${barCy}px`, transform: `translate(${dx * k}px, ${dy * k}px) scale(${lerp(1, T_S, k)})`}}>
					<Letter i={2} color={C.paper} />
				</div>
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

/* ═══════════ 03 SOUND: the ruler line vibrates into waves, SOUND rides them, the wave floods ═══════════ */
const beatEnv = (f: number) => {
	let e = 0;
	for (let b = 10; b <= 16; b++) {
		const fb = b * 30;
		const hit = (d: number, dec: number) => (d < 0 ? 0 : d < 2 ? d / 2 : Math.exp(-(d - 2) / dec));
		e += hit(f - fb, 12) + 0.4 * hit(f - fb - 15, 7);
	}
	return Math.min(1.3, e);
};
const ampAt = (f: number) => 62 * prog(f, TL.sound.wave[0], TL.sound.wave[0] + 34, ease.inOut) * (1 + 0.45 * beatEnv(f));
const waveY = (x: number, f: number, k: number, ph: number) => RULER_Y + ampAt(f) * k * Math.sin((2 * Math.PI * x) / 620 - f * 0.085 + ph);
const SOUND = 'SOUND';
const SND_SIZE = 230;
export const floodLevel = (f: number) => lerp(H + 260, -300, prog(f, TL.sound.flood[0], TL.sound.flood[1], ease.inOut));

export const Sound: React.FC<{f: number}> = ({f}) => {
	const T = TL.sound;
	const {o: to, x0: tx0} = timingLayout();
	const so = layout(SOUND, SND_SIZE).map((v, i) => v + i * SND_SIZE * 0.1);
	const sx0 = 960 - so[so.length - 1] / 2;
	const lines: [string, number, number, number][] = [
		[C.blue, 0.62, -1.3, 5],
		[C.ink, 1, 0, 6],
	];
	const widen = prog(f, T.sink[0], T.sink[0] + 20, ease.inOut);
	const xa = lerp(RULER_X0, -20, widen);
	const xb = lerp(RULER_X1, W + 20, widen);
	const path = (k: number, ph: number) => {
		let d = '';
		for (let x = xa; x <= xb + 11.9; x += 12) {
			const xx = Math.min(x, xb);
			d += `${x === xa ? 'M' : 'L'}${xx.toFixed(1)},${waveY(xx, f, k, ph).toFixed(1)} `;
		}
		return d;
	};
	const level = floodLevel(f);
	const surface = (x: number) => level + ampAt(f) * 0.8 * Math.sin((2 * Math.PI * x) / 620 - f * 0.085 + 0.9);
	let fill = '';
	for (let x = -20; x <= W + 20; x += 12) fill += `${x === -20 ? 'M' : 'L'}${x},${surface(x).toFixed(1)} `;
	fill += `L${W + 20},${H + 20} L-20,${H + 20} Z`;
	const ph = playheadX(f);
	return (
		<AbsoluteFill style={{background: C.paper}}>
			<svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
				{lines.map(([col, k, p, w], j) => (
					<path key={j} d={path(k, p)} fill="none" stroke={col} strokeWidth={j === 1 ? lerp(3, w, widen) : w} strokeLinecap={j === 1 && widen < 1 ? 'butt' : 'round'} opacity={j === 1 ? 1 : prog(f, T.wave[0] + 4, T.wave[0] + 16)} />
				))}
				<path d={path(0.8, 0.9)} fill="none" stroke={C.coral} strokeWidth={5} opacity={prog(f, T.wave[0] + 4, T.wave[0] + 16)} />
				{f >= T.flood[0] - 2 ? <path d={fill} fill={C.coral} /> : null}
			</svg>
			{/* ruler ticks and playhead fall away as the line starts to move */}
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
			{/* TIMING sinks into the line */}
			{Array.from(TIMING).map((ch, i) => {
				const t = prog(f, T.sink[0] + i * 2, T.sink[0] + i * 2 + 14, ease.in);
				if (t >= 1) return null;
				return (
					<span key={i} style={{...displayStyle(TIM_SIZE, C.ink), position: 'absolute', left: tx0 + to[i], top: TIM_TOP, transformOrigin: `50% ${(RULER_Y - TIM_TOP) / TIM_SIZE * 100}%`, transform: `scaleY(${1 - t})`}}>
						{ch}
					</span>
				);
			})}
			{/* SOUND rises out of the line and rides the wave; the flood lifts it off the top */}
			{Array.from(SOUND).map((ch, i) => {
				const t = prog(f, T.rise[0] + i * 3, T.rise[0] + i * 3 + 16, ease.out);
				if (t <= 0) return null;
				const lw = so[i + 1] - so[i];
				const cx = sx0 + so[i] + lw / 2;
				const wy = waveY(cx, f, 1, 0);
				const slope = (waveY(cx + 4, f, 1, 0) - waveY(cx - 4, f, 1, 0)) / 8;
				const float = Math.min(wy - 18, surface(cx) - 18);
				const bottom = float;
				return (
					<span
						key={i}
						style={{
							...displayStyle(SND_SIZE, C.ink),
							position: 'absolute',
							left: sx0 + so[i],
							top: bottom - SND_SIZE * 0.86,
							transformOrigin: '50% 86%',
							transform: `rotate(${Math.atan(slope) * 26}deg) scaleY(${t})`,
						}}
					>
						{ch}
					</span>
				);
			})}
		</AbsoluteFill>
	);
};

/* ═══════════ 04 IDEA: the o floats up as a lens and reads the sentence ═══════════ */
const L1 = 'describe the video';
const L2 = 'in your head.';
const LINE_SIZE = 196;
const L1_TOP = 250;
const L2_TOP = 520;
const LENS_R = 150;
const serif: React.CSSProperties = {fontFamily: SERIF, fontStyle: 'italic', fontSize: LINE_SIZE, lineHeight: `${LINE_SIZE * 1.1}px`, color: C.ink, whiteSpace: 'nowrap'};
let SERIF_W: [number, number] | null = null;
const serifWidths = () => {
	if (!SERIF_W) {
		const c = document.createElement('canvas').getContext('2d')!;
		c.font = `italic 400 ${LINE_SIZE}px 'Instrument Serif'`;
		SERIF_W = [c.measureText(L1).width, c.measureText(L2).width];
	}
	return SERIF_W;
};
const lines = () => {
	const [w1, w2] = serifWidths();
	return [
		{text: L1, x: 960 - w1 / 2, w: w1, top: L1_TOP, cy: L1_TOP + LINE_SIZE * 0.62},
		{text: L2, x: 960 - w2 / 2, w: w2, top: L2_TOP, cy: L2_TOP + LINE_SIZE * 0.62},
	];
};
export const lensPos = (f: number) => {
	const T = TL.idea;
	const [a, b] = lines();
	return poseTrack(f, [
		{f: T.bubble[0], p: {x: a.x + 40, y: 1250, s: 1}},
		{f: T.bubble[1], p: {x: a.x + 40, y: a.cy, s: 1}, hold: true},
		{f: T.line1[0], p: {x: a.x + 40, y: a.cy, s: 1}, hold: true},
		{f: T.line1[1], p: {x: a.x + a.w - 30, y: a.cy, s: 1}},
		{f: T.line2[0], p: {x: b.x + 40, y: b.cy, s: 1}},
		{f: T.line2[1], p: {x: b.x + b.w - 20, y: b.cy, s: 1}, hold: true},
		{f: T.center[1], p: {x: 960, y: 540, s: 1}, hold: true},
	]);
};

const Sentence: React.FC<{blur?: number; opacity?: number; clip?: (i: number) => string | undefined; rise: number}> = ({blur = 0, opacity = 1, clip, rise}) => (
	<>
		{lines().map((l, i) => (
			<div key={i} style={{position: 'absolute', left: l.x, top: l.top, height: LINE_SIZE * 1.15, overflow: 'hidden', clipPath: clip ? clip(i) : undefined}}>
				<div style={{...serif, opacity, filter: blur ? `blur(${blur}px)` : undefined, transform: `translateY(${(1 - rise) * 100}%)`}}>{l.text}</div>
			</div>
		))}
	</>
);

export const Idea: React.FC<{f: number; inner: React.ReactNode}> = ({f, inner}) => {
	const T = TL.idea;
	const L = lensPos(f);
	const rise = ease.out(clamp01((f - T.text[0]) / (T.text[1] - T.text[0])));
	const [a, b] = lines();
	// how far each line has been read (sharp up to the lens, and stays sharp)
	const read1 = f >= T.line1[1] + 2 ? 1e4 : f >= T.line1[0] ? L.x : -1e4;
	const read2 = f >= T.line2[1] + 2 ? 1e4 : f >= T.line2[0] + 4 ? L.x : -1e4;
	const clipRead = (i: number) => `inset(0 ${Math.max(0, (i === 0 ? a : b).w - ((i === 0 ? read1 : read2) - (i === 0 ? a : b).x))}px 0 0)`;
	const bob = f < T.bubble[1] + 20 ? Math.sin((f - T.bubble[0]) * 0.35) * Math.exp(-(f - T.bubble[0]) / 18) * 0.12 : 0;
	const iris = prog(f, T.iris[0], T.iris[1], ease.out);
	const portal = prog(f, T.portal[0], T.portal[1], ease.expand);
	const far = Math.hypot(960, 540) * 1.05;
	const R = lerp(LENS_R, far, portal);
	const readOut = 1 - prog(f, T.center[0], T.center[0] + 10);
	return (
		<AbsoluteFill style={{background: C.coral}}>
			<Sentence blur={9} opacity={0.5 * readOut} rise={rise} />
			<Sentence clip={clipRead} rise={rise} opacity={readOut} />
			<LensPortal cx={L.x} cy={L.y} r={R} rim={1 - prog(f, T.portal[0] + 8, T.portal[1] - 4)}>
				<AbsoluteFill style={{background: mixColor(C.coral, '#FFB7A8', 0.5)}}>
					<AbsoluteFill style={{transformOrigin: `${L.x}px ${L.y}px`, transform: 'scale(1.22)'}}>
						<Sentence rise={rise} opacity={readOut} />
					</AbsoluteFill>
					{iris > 0 ? <AbsoluteFill style={{clipPath: `circle(${(iris * (R + 4)).toFixed(1)}px at ${L.x}px ${L.y}px)`}}>{inner}</AbsoluteFill> : null}
				</AbsoluteFill>
			</LensPortal>
			{/* the ring of the o (the lens frame), thick like the letter */}
			{portal < 0.4 ? (
				<div
					style={{
						position: 'absolute',
						left: L.x - R - 13,
						top: L.y - R - 13,
						width: 2 * (R + 13),
						height: 2 * (R + 13),
						borderRadius: '50%',
						border: `26px solid ${C.paper}`,
						boxSizing: 'border-box',
						transform: `scale(${1 + bob}, ${1 - bob})`,
						opacity: 1 - prog(f, T.portal[0], T.portal[0] + 10),
						boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
					}}
				/>
			) : null}
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
