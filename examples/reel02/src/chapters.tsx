import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Burst, EchoTrail, KineticWord, landingSquash, squashStretch, TypeOn} from './motioner/creative';
import {morphPath} from './motioner/Morph';
import {arc, clamp01, ease, Ease, lerp, mixColor, prog, Pt, rand} from './motioner/motion';
import {C, Caption, displayStyle, Dot, H, layout, MONO, TL, W} from './shared';

/* ════════════════════════ 01  SEED: one dot bounces ════════════════════════ */
const FLOOR = 600;
export const SEED_R = 24;
const FC = FLOOR - SEED_R;
const [K1, K2, K3, K4] = TL.seed.contacts;
export const seedPos = (f: number): Pt => {
	const x = lerp(780, 960, prog(f, TL.seed.appear, K4, ease.inOutSoft));
	let y = FC;
	if (f < K1) {
		const s = clamp01((f - TL.seed.appear) / (K1 - TL.seed.appear));
		y = 250 + (FC - 250) * s * s;
	} else if (f < K2) {
		const s = (f - K1) / (K2 - K1);
		y = FC - 230 * 4 * s * (1 - s);
	} else if (f < K3) {
		const s = (f - K2) / (K3 - K2);
		y = FC - 110 * 4 * s * (1 - s);
	} else if (f < K4) {
		const s = (f - K3) / (K4 - K3);
		y = FC - 36 * 4 * s * (1 - s);
	}
	return {x, y};
};
export const SEED_END: Pt = {x: 960, y: FC};

const seedDotTransform = (f: number) => {
	const amounts = [0.42, 0.32, 0.2, 0.12];
	for (let k = 0; k < 4; k++) {
		const c = TL.seed.contacts[k];
		if (f >= c && f < c + 8) {
			const {sx, sy} = landingSquash(f, c, amounts[k], 16);
			return `translateY(${(1 - sy) * SEED_R}px) scale(${sx}, ${sy})`;
		}
	}
	if (f >= 106) {
		// anticipation: sink, then spring up into the flood
		const down = prog(f, 106, 114, ease.inOut);
		const up = prog(f, 114, 120, ease.out);
		const sy = lerp(1, 0.72, down) + (1.1 - 0.72) * up;
		return `translateY(${(1 - sy) * SEED_R}px) scale(${1 / Math.sqrt(sy)}, ${sy})`;
	}
	const a = seedPos(f - 0.5);
	const b = seedPos(f + 0.5);
	return squashStretch(b.x - a.x, b.y - a.y, 0.011, 0.45);
};

export const Seed: React.FC<{f: number; bg?: string; dot?: string}> = ({f, bg = C.ink, dot = C.coral}) => {
	const pop = prog(f, TL.seed.appear, TL.seed.appear + 7, ease.backOut());
	const floorW = 1100 * prog(f, 0, 34, ease.out);
	const floorO = 0.22 * (1 - prog(f, 108, 118));
	return (
		<AbsoluteFill style={{background: bg}}>
			<div style={{position: 'absolute', left: 960 - floorW / 2, top: FLOOR, width: floorW, height: 1.5, background: C.paper, opacity: floorO}} />
			{/* the path it has travelled, dotted like an animator's arc chart, and a tick at every contact */}
			<svg width={W} height={H} style={{position: 'absolute', inset: 0, opacity: 1 - prog(f, 106, 118)}}>
				{Array.from({length: Math.max(0, Math.floor((Math.min(f, K4) - TL.seed.appear) / 3))}, (_, k) => {
					const q = seedPos(TL.seed.appear + 3 + k * 3);
					return <circle key={k} cx={q.x} cy={q.y} r={2.6} fill={C.paper} opacity={0.32} />;
				})}
				{TL.seed.contacts.map((c, k) => {
					const t = prog(f, c, c + 10, ease.out);
					const q = seedPos(c);
					return t > 0 ? <line key={k} x1={q.x} y1={FLOOR + 8} x2={q.x} y2={FLOOR + 8 + 18 * t} stroke={C.coral} strokeWidth={2} /> : null;
				})}
			</svg>
			{f >= TL.seed.appear ? (
				<EchoTrail
					frame={f}
					count={7}
					step={3}
					minFrame={TL.seed.appear + 2}
					fade={f < 108 ? 0.5 : 0.5 * (1 - prog(f, 108, 116))}
					render={(ff, i) =>
						i === 0 ? (
							<Dot p={seedPos(ff)} r={SEED_R * pop} color={dot} tr={seedDotTransform(ff)} />
						) : (
							<Dot p={seedPos(ff)} r={SEED_R} color={dot} ring={C.paper} />
						)
					}
				/>
			) : null}
		</AbsoluteFill>
	);
};

/* ════════════════════════ 02  IDEA: words on the beat ═══════════════════════ */
const IDEA_SIZE = 172;
const L1 = 'EVERY IDEA';
const L2 = 'STARTS SMALL';
const L1_TOP = 322;
const L2_TOP = 522;
const BASE = 0.84; // baseline as a fraction of the size, from the line box top
const DOT_R_IDEA = 16;
export const ideaDot = (): Pt => {
	const off = layout(L2, IDEA_SIZE);
	const T = off[off.length - 1];
	const total = T + 16 + 2 * DOT_R_IDEA;
	const x0 = 960 - total / 2;
	return {x: x0 + T + 16 + DOT_R_IDEA, y: L2_TOP + BASE * IDEA_SIZE - DOT_R_IDEA};
};

/** A masked word whose letters rise in and later leave upwards. */
const RiseWord: React.FC<{text: string; x: number; top: number; size: number; color: string; f: number; start: number; out?: number; offsets: number[]}> = ({
	text,
	x,
	top,
	size,
	color,
	f,
	start,
	out,
	offsets,
}) => {
	const chars = Array.from(text);
	return (
		<div style={{position: 'absolute', left: x, top, width: offsets[offsets.length - 1] + size * 0.1, height: size * 1.02, overflow: 'hidden'}}>
			{chars.map((ch, i) => {
				const tin = ease.out(clamp01((f - start - i * 1.5) / 14));
				const tout = out !== undefined ? ease.in(clamp01((f - out - i * 1) / 12)) : 0;
				const y = (1 - tin) * 105 - tout * 105;
				return (
					<span key={i} style={{...displayStyle(size, color), position: 'absolute', left: offsets[i] - offsets[0], top: 0, transform: `translateY(${y}%)`, willChange: 'transform'}}>
						{ch}
					</span>
				);
			})}
		</div>
	);
};

export const Idea: React.FC<{f: number; drawDot?: boolean}> = ({f, drawDot = true}) => {
	const o1 = layout(L1, IDEA_SIZE);
	const o2 = layout(L2, IDEA_SIZE);
	const x1 = 960 - o1[o1.length - 1] / 2;
	const d = ideaDot();
	const x2 = d.x - DOT_R_IDEA - 16 - o2[o2.length - 1];
	const sp1 = L1.indexOf(' ');
	const sp2 = L2.indexOf(' ');
	const [w0, w1, w2, w3] = TL.idea.words;
	const [o0, oEnd] = TL.idea.out;
	const shrink = prog(f, TL.idea.shrink[0], TL.idea.shrink[1], ease.inOut);
	const smallX = x2 + o2[sp2 + 1];
	const smallW = o2[o2.length - 1] - o2[sp2 + 1];
	const pop = prog(f, TL.idea.dotPop, TL.idea.dotPop + 9, ease.backOut());
	return (
		<AbsoluteFill style={{background: C.coral}}>
			<RiseWord text="EVERY" x={x1} top={L1_TOP} size={IDEA_SIZE} color={C.ink} f={f} start={w0} out={o0} offsets={o1.slice(0, sp1 + 1)} />
			<RiseWord text="IDEA" x={x1 + o1[sp1 + 1]} top={L1_TOP} size={IDEA_SIZE} color={C.ink} f={f} start={w1} out={o0 + 3} offsets={o1.slice(sp1 + 1)} />
			<RiseWord text="STARTS" x={x2} top={L2_TOP} size={IDEA_SIZE} color={C.ink} f={f} start={w2} out={o0 + 6} offsets={o2.slice(0, sp2 + 1)} />
			{shrink < 0.999 ? (
				<div style={{position: 'absolute', left: smallX, top: L2_TOP, width: smallW, height: IDEA_SIZE * 1.02, transformOrigin: `100% ${BASE * 100}%`, transform: `scale(${1 - shrink})`}}>
					<RiseWord text="SMALL" x={0} top={0} size={IDEA_SIZE} color={C.ink} f={f} start={w3} offsets={o2.slice(sp2 + 1)} />
				</div>
			) : null}
			{drawDot && f >= TL.idea.dotPop && f < TL.idea.travel[0] ? <Dot p={d} r={DOT_R_IDEA * pop} color={C.ink} /> : null}
			{void oEnd}
		</AbsoluteFill>
	);
};

/** Carrier: the period of SMALL. travels to the centre and becomes the next scene's seed. */
export const ideaCarrier = (f: number): {p: Pt; r: number; tr: string} => {
	const [a, b] = TL.idea.travel;
	const pos = (ff: number) => arc(ideaDot(), {x: 960, y: 540}, prog(ff, a, b, ease.snap), -0.18);
	const p = pos(f);
	const q0 = pos(f - 0.5);
	const q1 = pos(f + 0.5);
	return {p, r: lerp(DOT_R_IDEA, SEED_R, prog(f, a, b, ease.snap)), tr: squashStretch(q1.x - q0.x, q1.y - q0.y, 0.01, 0.5)};
};

/* ════════════════════════ 03  MOTION: four ways from A to B ═════════════════ */
const RAIL_Y = [410, 530, 650, 770];
const RAIL_X0 = 720;
const RAIL_X1 = 1650;
const bounceOut: Ease = (t) => {
	const n = 7.5625;
	const d = 2.75;
	if (t < 1 / d) return n * t * t;
	if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
	if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
	return n * (t -= 2.625 / d) * t + 0.984375;
};
const RAILS: {label: string; e: Ease; color: string; icon: string}[] = [
	{label: 'ROBOTIC', e: (t) => t, color: C.ink, icon: 'M2,26 L42,2'},
	{label: 'SMOOTH', e: ease.inOut, color: C.coral, icon: 'M2,26 C22,26 22,2 42,2'},
	{label: 'PLAYFUL', e: ease.backOut(), color: C.blue, icon: 'M2,26 C14,-10 24,-4 42,2'},
	{label: 'BOUNCY', e: bounceOut, color: C.coral, icon: 'M2,26 Q12,2 20,2 Q25,10 30,2 Q35,6 42,2'},
];
export const MERGE: Pt = {x: 960, y: 560};

const railDot = (f: number, i: number): {p: Pt; color: string; r: number} => {
	const T = TL.motion;
	const sp = prog(f, T.split[0] + i * 2, T.split[1] - 4 + i * 2, ease.snap);
	const start = {x: RAIL_X0, y: RAIL_Y[i]};
	if (f < T.railStart + i * T.railStep) {
		return {p: arc({x: 960, y: 540}, start, sp, i % 2 ? 0.22 : -0.22), color: mixColor(C.ink, RAILS[i].color, sp), r: lerp(SEED_R, 22, sp)};
	}
	const tt = clamp01((f - T.railStart - i * T.railStep) / T.railDur);
	const x = lerp(RAIL_X0, RAIL_X1, RAILS[i].e(tt));
	const cv = prog(f, T.converge[0] + i, T.converge[1], ease.snap);
	if (cv <= 0) return {p: {x, y: RAIL_Y[i]}, color: RAILS[i].color, r: 22};
	return {p: arc({x: RAIL_X1, y: RAIL_Y[i]}, MERGE, cv, i % 2 ? 0.2 : -0.2), color: mixColor(RAILS[i].color, C.coral, cv), r: lerp(22, SEED_R, cv)};
};

export const MotionCh: React.FC<{f: number; caption?: boolean}> = ({f, caption = true}) => {
	const T = TL.motion;
	return (
		<AbsoluteFill style={{background: C.paper}}>
			{caption ? <Caption text="Give it motion." frame={f} start={T.caption} color={C.ink} /> : null}
			{RAILS.map((r, i) => {
				const len = prog(f, 262 + i * 4, 284 + i * 4, ease.out);
				const lab = prog(f, 266 + i * 4, 282 + i * 4, ease.out);
				const arrive = T.railStart + i * T.railStep + T.railDur;
				const ring = clamp01((f - arrive) / 22);
				return (
					<React.Fragment key={i}>
						<div style={{position: 'absolute', left: RAIL_X0, top: RAIL_Y[i] - 0.75, width: (RAIL_X1 - RAIL_X0) * len, height: 1.5, background: C.ink, opacity: 0.16}} />
						<div style={{position: 'absolute', left: RAIL_X1 - 32, top: RAIL_Y[i] - 32, width: 64, height: 64, borderRadius: '50%', border: `1.5px solid ${C.ink}`, opacity: 0.22 * len, boxSizing: 'border-box'}} />
						<div style={{position: 'absolute', left: 220, top: RAIL_Y[i] - 18, height: 38, overflow: 'hidden'}}>
							<div style={{fontFamily: MONO, fontSize: 26, fontWeight: 500, letterSpacing: '0.16em', color: C.ink, opacity: 0.8, transform: `translateY(${(1 - lab) * 100}%)`, lineHeight: '38px'}}>{r.label}</div>
						</div>
						<svg width={46} height={30} style={{position: 'absolute', left: 520, top: RAIL_Y[i] - 22, opacity: lab, overflow: 'visible', transform: 'scale(1.5)', transformOrigin: '0 50%'}}>
							<path d={r.icon} fill="none" stroke={r.color} strokeWidth={2.2} strokeLinecap="round" strokeDasharray={80} strokeDashoffset={80 * (1 - lab)} />
						</svg>
						{ring > 0 && ring < 1 ? <Dot p={{x: RAIL_X1, y: RAIL_Y[i]}} r={lerp(24, 64, ease.out(ring))} color="none" ring={r.color} opacity={0.7 * (1 - ring)} /> : null}
					</React.Fragment>
				);
			})}
			{f >= T.split[0]
				? RAILS.map((r, i) => {
						const moving = f >= T.railStart + i * T.railStep && f < T.railStart + i * T.railStep + T.railDur + 4;
						return (
							<EchoTrail
								key={i}
								frame={f}
								count={moving ? 5 : 0}
								step={2}
								fade={0.45}
								render={(ff, k) => {
									const d = railDot(ff, i);
									return k === 0 ? <Dot p={d.p} r={d.r} color={d.color} /> : <Dot p={d.p} r={d.r} color="none" ring={d.color} />;
								}}
							/>
						);
					})
				: null}
		</AbsoluteFill>
	);
};

/* ════════════════════════ 04  SHAPE: circle, triangle, star, square ═════════ */
const S_C: Pt = MERGE;
const polyPath = (pts: [number, number][]) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L') + ' Z';
const circlePath = (r: number) => `M ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0 Z`;
const SHAPES = [
	{name: 'CIRCLE', d: circlePath(150)},
	{name: 'TRIANGLE', d: polyPath([0, 1, 2].map((k) => [Math.cos(-Math.PI / 2 + (k * 2 * Math.PI) / 3) * 185, 30 + Math.sin(-Math.PI / 2 + (k * 2 * Math.PI) / 3) * 185] as [number, number]))},
	{name: 'STAR', d: polyPath(Array.from({length: 10}, (_, k) => {
		const a = -Math.PI / 2 + (k * Math.PI) / 5;
		const r = k % 2 ? 78 : 188;
		return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
	}))},
	{name: 'SQUARE', d: 'M -94 -130 L 94 -130 Q 130 -130 130 -94 L 130 94 Q 130 130 94 130 L -94 130 Q -130 130 -130 94 L -130 -94 Q -130 -130 -94 -130 Z'},
];
const shapeRot = (f: number) => 0.35 * (f - 364) + TL.shape.morphs.reduce((s, m) => s + 60 * prog(f, m, m + TL.shape.morphDur, ease.snap), 0);
const shapeState = (f: number): {d: string; name: string} => {
	const M = TL.shape.morphs;
	for (let j = M.length - 1; j >= 0; j--) {
		if (f >= M[j]) {
			const t = prog(f, M[j], M[j] + TL.shape.morphDur, ease.snap);
			return {d: t >= 1 ? SHAPES[j + 1].d : morphPath(SHAPES[j].d, SHAPES[j + 1].d, t), name: SHAPES[t > 0.5 ? j + 1 : j].name};
		}
	}
	return {d: SHAPES[0].d, name: SHAPES[0].name};
};

export const ShapeCh: React.FC<{f: number; caption?: boolean}> = ({f, caption = true}) => {
	const T = TL.shape;
	const grow = prog(f, T.grow[0], T.grow[1], ease.snap);
	const rot = shapeRot(f);
	const col = mixColor(C.coral, C.paper, grow);
	const box = prog(f, 378, 394, ease.out);
	const {d, name} = shapeState(f);
	return (
		<AbsoluteFill style={{background: C.blue}}>
			{caption ? <Caption text="Give it shape." frame={f} start={372} color={C.paper} /> : null}
			<svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
				{Array.from({length: 12}, (_, i) => {
					const a = ((i * 30 + 0.5 * (f - 364)) * Math.PI) / 180;
					const s = prog(f, 370 + i * 2, 384 + i * 2, ease.backOut());
					return <circle key={i} cx={S_C.x + Math.cos(a) * 300} cy={S_C.y + Math.sin(a) * 300} r={5 * s} fill={C.paper} opacity={0.85} />;
				})}
				{T.morphs.map((m, j) => {
					const g = 1 - prog(f, m, m + 36);
					if (f < m || g <= 0) return null;
					return <path key={j} d={SHAPES[j].d} transform={`translate(${S_C.x},${S_C.y}) rotate(${shapeRot(m) + 0.15 * (f - m)})`} fill="none" stroke={C.coral} strokeWidth={2.5} opacity={0.9 * g} />;
				})}
				{box > 0 ? (
					<g transform={`translate(${S_C.x},${S_C.y}) rotate(${rot})`} opacity={0.5 * box}>
						<rect x={-210} y={-210} width={420} height={420} fill="none" stroke={C.paper} strokeWidth={1.2} strokeDasharray="4 6" />
						{[[-210, -210], [210, -210], [-210, 210], [210, 210]].map(([x, y], k) => (
							<rect key={k} x={x - 6} y={y - 6} width={12} height={12} fill={C.blue} stroke={C.paper} strokeWidth={1.5} />
						))}
					</g>
				) : null}
				{f < T.grow[0] ? <circle cx={S_C.x} cy={S_C.y} r={SEED_R} fill={C.coral} /> : grow < 1 ? <circle cx={S_C.x} cy={S_C.y} r={lerp(SEED_R, 150, grow)} fill={col} /> : <path d={d} transform={`translate(${S_C.x},${S_C.y}) rotate(${rot})`} fill={C.paper} />}
			</svg>
			<div style={{position: 'absolute', left: S_C.x + 240, top: S_C.y - 250, fontFamily: MONO, fontSize: 16, letterSpacing: '0.14em', color: C.paper, opacity: 0.8 * box, lineHeight: 1.6, fontVariantNumeric: 'tabular-nums'}}>
				ROT {(((rot % 360) + 360) % 360).toFixed(1)}°
				<br />
				{name}
			</div>
		</AbsoluteFill>
	);
};

/* ════════════════════════ 05  RHYTHM: ON THE BEAT. ═════════════════════════ */
const RH_SIZE = 190;
const RH_TOP = 356;
const RH_WORDS = ['ON', 'THE', 'BEAT'];
const RH_DOT_R = 19;
const rhythmLayout = () => {
	const ws = RH_WORDS.map((w) => layout(w, RH_SIZE));
	const g = 0.26 * RH_SIZE;
	const widths = ws.map((o) => o[o.length - 1]);
	const total = widths.reduce((a, b) => a + b, 0) + 2 * g + 12 + 2 * RH_DOT_R;
	let x = 960 - total / 2;
	const xs = widths.map((w) => {
		const v = x;
		x += w + g;
		return v;
	});
	const dot = {x: xs[2] + widths[2] + 12 + RH_DOT_R, y: RH_TOP + BASE * RH_SIZE - RH_DOT_R};
	return {xs, dot};
};
export const rhythmDot = () => rhythmLayout().dot;

const beatEnv = (f: number) => {
	let e = 0;
	for (let b = 16; b <= 20; b++) {
		const fb = b * 30;
		// 2-frame attack so a hit never jumps in one frame, then a musical decay
		const hit = (d: number, dec: number) => (d < 0 ? 0 : d < 2 ? d / 2 : Math.exp(-(d - 2) / dec));
		e += hit(f - fb, 11) + 0.45 * hit(f - fb - 15, 7);
	}
	return Math.min(1.2, e);
};

export const Rhythm: React.FC<{f: number; caption?: boolean; drawDot?: boolean}> = ({f, caption = true, drawDot = true}) => {
	const T = TL.rhythm;
	const {xs, dot} = rhythmLayout();
	const pop = prog(f, T.dotPop, T.dotPop + 9, ease.backOut());
	const env = beatEnv(f);
	return (
		<AbsoluteFill style={{background: C.paper}}>
			{caption ? <Caption text="Give it rhythm." frame={f} start={490} color={C.ink} /> : null}
			{RH_WORDS.map((w, j) => (
				<div key={j} style={{position: 'absolute', left: xs[j], top: RH_TOP}}>
					<KineticWord text={w} frame={f} start={T.drops[j] - 11} mode="drop" dur={20} stagger={1.5} amount={1.1} style={displayStyle(RH_SIZE, C.ink)} id={`rh${j}`} />
				</div>
			))}
			{drawDot && f >= T.dotPop && f < T.travel[0] ? <Dot p={dot} r={RH_DOT_R * pop} color={C.coral} /> : null}
			<svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
				{Array.from({length: 40}, (_, i) => {
					const g = prog(f, T.bars + i * 0.8, T.bars + i * 0.8 + 12, ease.out);
					const pat = 0.3 + 0.7 * Math.sin((Math.PI * (i + 0.5)) / 40) * (0.55 + 0.45 * rand(i * 3.7));
					const h = (16 + 240 * pat * env) * g;
					const x = 960 - 680 + i * 34 + 17;
					return <rect key={i} x={x - 8} y={815 - h / 2} width={16} height={Math.max(0.1, h)} rx={8} fill={i % 4 === 0 ? C.coral : C.ink} />;
				})}
			</svg>
		</AbsoluteFill>
	);
};

export const rhythmCarrier = (f: number): {p: Pt; r: number; tr: string} => {
	const [a, b] = TL.rhythm.travel;
	const pos = (ff: number) => arc(rhythmDot(), BUTTON, prog(ff, a, b, ease.snap), 0.22);
	const q0 = pos(f - 0.5);
	const q1 = pos(f + 0.5);
	return {p: pos(f), r: lerp(RH_DOT_R, BUTTON_R, prog(f, a, b, ease.snap)), tr: squashStretch(q1.x - q0.x, q1.y - q0.y, 0.01, 0.5)};
};

/* ════════════════════════ 06  PROMPT: just describe it ══════════════════════ */
export const BUTTON: Pt = {x: 1454, y: 560};
export const BUTTON_R = 38;
const PILL = {x: 400, y: 496, w: 1120, h: 128};
const PROMPT_TEXT = 'a dot that becomes a logo';

export const Prompt: React.FC<{f: number; caption?: boolean}> = ({f, caption = true}) => {
	const T = TL.prompt;
	const grow = prog(f, T.pill[0], T.pill[1], ease.snap);
	const collapse = prog(f, T.collapse[0], T.collapse[1], ease.inOut);
	const right = PILL.x + PILL.w;
	// the pill grows out of the button (same circle on its first frame) and collapses back into it
	const k = grow * (1 - collapse);
	const pl = lerp(BUTTON.x - BUTTON_R, PILL.x, k);
	const pr = lerp(BUTTON.x + BUTTON_R, right, k);
	const pt = lerp(BUTTON.y - BUTTON_R, PILL.y, k);
	const ph = lerp(2 * BUTTON_R, PILL.h, k);
	const w = pr - pl;
	const pillO = f < T.collapse[1] ? 1 : 0;
	const press = f >= T.press - 2 && f < T.press + 10 ? 1 - 0.14 * Math.sin((Math.PI * (f - (T.press - 2))) / 12) : 1;
	const launch = prog(f, T.launch[0], T.launch[1], ease.inOut);
	const bp = {x: lerp(BUTTON.x, 960, launch), y: lerp(BUTTON.y, 540, launch)};
	const br = lerp(BUTTON_R, 44, launch);
	const cur = arc({x: 1640, y: 840}, {x: 1462, y: 572}, prog(f, T.cursor[0], T.cursor[1], ease.inOut), 0.18);
	const curOut = prog(f, 700, 716, ease.in);
	const curP = {x: lerp(cur.x, 1600, curOut), y: lerp(cur.y, 780, curOut)};
	const curO = prog(f, T.cursor[0] - 4, T.cursor[0] + 4) * (1 - curOut);
	const textO = 1 - prog(f, T.collapse[0], T.collapse[0] + 8);
	return (
		<AbsoluteFill style={{background: C.ink}}>
			{caption ? <Caption text="Just describe it." frame={f} start={T.caption} color={C.paper} out={T.collapse[0]} /> : null}
			{f >= T.pill[0] && pillO ? (
				<div style={{position: 'absolute', left: pl, top: pt, width: w, height: ph, borderRadius: ph / 2, background: C.dark2, boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.14)', overflow: 'hidden'}}>
					<div style={{position: 'absolute', left: 64 - (pl - PILL.x), top: (ph - PILL.h) / 2, width: PILL.w - 160, height: PILL.h, display: 'flex', alignItems: 'center', fontFamily: "'Archivo Variable', sans-serif", fontSize: 48, fontWeight: 450, color: C.paper, opacity: textO * grow}}>
						{f < T.type ? <span style={{color: C.grey, opacity: prog(f, 610, 618)}}>Describe your video</span> : <TypeOn text={PROMPT_TEXT} frame={f} start={T.type} fps={60} cps={19} caretColor={C.coral} />}
					</div>
				</div>
			) : null}
			{f >= T.pill[0] ? (
				<>
					<Dot p={bp} r={br} color={C.coral} tr={`scale(${press})`} />
					<svg width={40} height={40} style={{position: 'absolute', left: bp.x - 20, top: bp.y - 20, scale: '1.35', opacity: prog(f, 604, 614) * (1 - prog(f, T.launch[0], T.launch[0] + 6)), transform: `scale(${press})`}}>
						<path d="M20,29 L20,11 M12,18 L20,10 L28,18" stroke={C.paper} strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</>
			) : null}
			<Burst frame={f} start={T.press + 2} x={BUTTON.x} y={BUTTON.y} color={C.coral} rays={12} r0={54} r1={170} frames={22} width={5} />
			{curO > 0.01 ? (
				<svg width={40} height={48} style={{position: 'absolute', left: curP.x, top: curP.y, opacity: curO, transform: `scale(${f >= T.press - 3 && f < T.press + 5 ? 0.88 : 1})`, transformOrigin: '0 0'}}>
					<path d="M2,2 L2,34 L11,26 L17,40 L23,37 L17,24 L29,24 Z" fill={C.paper} stroke={C.ink} strokeWidth={2} strokeLinejoin="round" />
				</svg>
			) : null}
		</AbsoluteFill>
	);
};

/* ════════════════════════ LOGO: motioner. ══════════════════════════════════ */
const LOGO_SIZE = 240;
const LOGO_TOP = 350;
const LOGO_R = 27;
const logoLayout = () => {
	const o = layout('motioner', LOGO_SIZE);
	const wWord = o[o.length - 1];
	const total = wWord + 16 + 2 * LOGO_R;
	const x0 = 960 - total / 2;
	return {o, x0, dot: {x: x0 + wWord + 16 + LOGO_R, y: LOGO_TOP + BASE * LOGO_SIZE - LOGO_R}};
};

export const Logo: React.FC<{f: number; closing: React.ReactNode}> = ({f, closing}) => {
	const T = TL.logo;
	const far = Math.hypot(960, 540) * 1.04;
	const R = lerp(far, LOGO_R, prog(f, T.close[0], T.close[1], ease.snap));
	const {o, x0, dot} = logoLayout();
	const tr = prog(f, T.travel[0], T.travel[1], ease.snap);
	const posAt = (ff: number) => arc({x: 960, y: 540}, dot, prog(ff, T.travel[0], T.travel[1], ease.snap), -0.12);
	const p = posAt(f);
	const q0 = posAt(f - 0.5);
	const q1 = posAt(f + 0.5);
	const pulse = T.pulses.reduce((s, pf) => s + (f >= pf ? Math.exp(-(f - pf) / 6) * 0.12 : 0), 0);
	const tag = ease.out(clamp01((f - T.tagline) / 20));
	const rule = prog(f, T.rule[0], T.rule[1], ease.out);
	const foot = prog(f, T.footer, T.footer + 18, ease.out);
	return (
		<AbsoluteFill style={{background: C.ink}}>
			{f < T.close[1] ? (
				<AbsoluteFill style={{clipPath: `circle(${R.toFixed(1)}px at 960px 540px)`, background: C.coral}}>
					<AbsoluteFill style={{transformOrigin: '960px 540px', transform: `scale(${Math.max(0.02, R / far)})`, opacity: 1 - prog(f, T.close[0] + 8, T.close[1] - 2)}}>{closing}</AbsoluteFill>
				</AbsoluteFill>
			) : null}
			{f >= T.rise - 2 ? (
				<div style={{position: 'absolute', left: x0, top: LOGO_TOP, height: LOGO_SIZE * 1.1, width: o[o.length - 1] + 10, overflow: 'hidden'}}>
					{Array.from('motioner').map((ch, i) => {
						const t = ease.out(clamp01((f - T.rise - i * 2) / 16));
						return (
							<span key={i} style={{...displayStyle(LOGO_SIZE, C.paper), position: 'absolute', left: o[i], top: 0, transform: `translateY(${(1 - t) * 108}%)`, willChange: 'transform'}}>
								{ch}
							</span>
						);
					})}
				</div>
			) : null}
			{f >= T.close[1] - 1 ? (
				<>
					{T.pulses.map((pf, k) => {
						const t = clamp01((f - pf) / 26);
						return f >= pf && t < 1 ? <Dot key={k} p={dot} r={lerp(LOGO_R, 80, ease.out(t))} color="none" ring={C.coral} opacity={0.7 * (1 - t)} /> : null;
					})}
					<Dot p={f >= T.travel[0] ? p : {x: 960, y: 540}} r={LOGO_R} color={C.coral} tr={`${tr > 0 && tr < 1 ? squashStretch(q1.x - q0.x, q1.y - q0.y, 0.01, 0.5) : ''} scale(${1 + pulse})`} />
				</>
			) : null}
			<div style={{position: 'absolute', left: 0, width: W, top: 650, height: 92, overflow: 'hidden', textAlign: 'center'}}>
				<div style={{fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 76, lineHeight: '92px', color: C.paper, opacity: 0.9, transform: `translateY(${(1 - tag) * 100}%)`}}>your ideas, in motion.</div>
			</div>
			<div style={{position: 'absolute', left: 960 - 280 * rule, top: 770, width: 560 * rule, height: 1, background: C.paper, opacity: 0.3}} />
			<div style={{position: 'absolute', left: 0, width: W, top: 796, textAlign: 'center', fontFamily: MONO, fontSize: 17, letterSpacing: '0.2em', color: C.paper, opacity: 0.6 * foot, transform: `translateY(${(1 - foot) * 10}px)`}}>
				EVERY FRAME AND EVERY SOUND WRITTEN IN CODE
			</div>
		</AbsoluteFill>
	);
};
