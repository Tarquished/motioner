/**
 * Motioner creative kit: the devices the benchmark films are built from (see
 * references/creative-playbook.md). Every component is a pure function of the `frame` you pass in.
 *
 *   HudFrame      film chrome: crop marks, reel title, chapter label, timecode, BPM/bar, progress ticks
 *   Grain         animated film grain (seeded per frame) + optional vignette
 *   Burst         radial rays + ring on an impact (hides a swap underneath)
 *   Aperture      camera iris blades closing/opening over a scene
 *   LensPortal    a round glass lens showing another scene inside it
 *   SlatReveal    slats retracting in a stagger;  BandWipe  a diagonal band wiping the frame
 *   EchoTrail     onion-skin echoes of a moving object (render it at earlier frames)
 *   KineticWord   per-letter behaviours: rise, drop, bounce, stretch, spin, snap, smear
 *   AbsorbWord    a word slides into its own final dot and disappears into it
 *   Counter       rolling number;  TypeOn  typed text with a caret
 *   ParticleForm  particles fly from a scatter/point to a target shape (sampleText / sampleCircle)
 *   RgbSplit      chromatic split on anything, for glitch accents
 *   squashStretch scale along the direction of travel from velocity
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp01, ease, Ease, lerp, prog, Pt, rand} from './motion';

/* ── beat helpers ─────────────────────────────────────────────────────────── */
/** Frame of a beat. Put every chapter change on one (prefer multiples of 4). */
export const beatFrame = (beat: number, bpm: number, fps: number, beat0 = 0) => Math.round(beat0 + (beat * 60 * fps) / bpm);

/* ── squash and stretch from velocity ───────────────────────────────────────
 * Stretch along the direction of travel, squash across it, keep the area. `k` ~ 0.012 per px/frame.
 * Returns a CSS transform fragment to apply at the object's centre. */
export const squashStretch = (vx: number, vy: number, k = 0.012, max = 0.6) => {
	const v = Math.hypot(vx, vy);
	const s = 1 + Math.min(max, v * k);
	const a = (Math.atan2(vy, vx) * 180) / Math.PI;
	return v < 0.05 ? '' : `rotate(${a}deg) scale(${s}, ${1 / s}) rotate(${-a}deg)`;
};

/** Landing squash: 0 before `contact`, a quick squash then a damped wobble back to 1. */
export const landingSquash = (frame: number, contact: number, amount = 0.28, frames = 18) => {
	const t = frame - contact;
	if (t < 0 || t > frames) return {sx: 1, sy: 1};
	const w = Math.exp(-t / (frames / 4)) * Math.cos((t / frames) * Math.PI * 3);
	return {sx: 1 + amount * w, sy: 1 - amount * w};
};

/* ── HUD / film chrome ──────────────────────────────────────────────────────
 * Stays still while scenes change beneath it. Mono 12 to 14 px, letterspaced, 50 to 70 % opacity. */
export const HudFrame: React.FC<{
	frame: number;
	fps: number;
	total: number;
	width: number;
	height: number;
	title: string;
	chapter?: string;
	bpm?: number;
	color: string;
	accent: string;
	font?: string;
	inset?: number;
	/** chrome fades in over these frames at the start (the seed appears first) */
	appear?: [number, number];
}> = ({frame, fps, total, width, height, title, chapter, bpm, color, accent, font = "'JetBrains Mono', monospace", inset = 44, appear = [0, 1]}) => {
	const o = prog(frame, appear[0], appear[1], ease.out);
	const sec = frame / fps;
	const tc = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}:${String(Math.floor(frame % fps)).padStart(2, '0')}`;
	const beat = bpm ? Math.floor((frame / fps) * (bpm / 60)) : 0;
	const bar = Math.floor(beat / 4) + 1;
	const txt: React.CSSProperties = {position: 'absolute', fontFamily: font, fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color, whiteSpace: 'nowrap'};
	const L = 18; // crop mark arm
	const mark = (x: number, y: number, sx: number, sy: number) => (
		<path d={`M${x},${y + sy * L} L${x},${y} L${x + sx * L},${y}`} stroke={color} strokeWidth={1.4} fill="none" />
	);
	const p = frame / Math.max(1, total - 1);
	const ticks = 16;
	const barW = 260;
	return (
		<AbsoluteFill style={{opacity: o, pointerEvents: 'none'}}>
			<svg width={width} height={height} style={{position: 'absolute', inset: 0, opacity: 0.7}}>
				{mark(inset, inset, 1, 1)}
				{mark(width - inset, inset, -1, 1)}
				{mark(inset, height - inset, 1, -1)}
				{mark(width - inset, height - inset, -1, -1)}
				<line x1={width - inset - barW} y1={height - inset - 8} x2={width - inset - 30} y2={height - inset - 8} stroke={color} strokeOpacity={0.35} strokeWidth={1} />
				<line x1={width - inset - barW} y1={height - inset - 8} x2={width - inset - barW + (barW - 30) * p} y2={height - inset - 8} stroke={accent} strokeWidth={1.6} />
				{Array.from({length: ticks + 1}, (_, i) => (
					<line key={i} x1={width - inset - barW + ((barW - 30) * i) / ticks} y1={height - inset - 12} x2={width - inset - barW + ((barW - 30) * i) / ticks} y2={height - inset - 4} stroke={color} strokeOpacity={0.5} strokeWidth={1} />
				))}
			</svg>
			<div style={{...txt, left: inset + 28, top: inset - 6, opacity: 0.75}}>{title}</div>
			<div style={{...txt, right: inset + 28, top: inset - 6, opacity: 0.75, fontVariantNumeric: 'tabular-nums'}}>
				{tc}
				{bpm ? (
					<>
						<span style={{color: accent, margin: '0 10px'}}>●</span>
						{bpm} BPM · BAR {bar}
					</>
				) : null}
			</div>
			{chapter ? <div style={{...txt, left: inset + 28, bottom: inset - 6, opacity: 0.75}}>{chapter}</div> : null}
		</AbsoluteFill>
	);
};

/* ── Grain and vignette ─────────────────────────────────────────────────────
 * Seeded per frame (deterministic). 3 to 5 % opacity on paper, 5 to 8 % on dark. */
export const Grain: React.FC<{frame: number; opacity?: number; vignette?: number; id?: string}> = ({frame, opacity = 0.05, vignette = 0.25, id = 'grain'}) => (
	<AbsoluteFill style={{pointerEvents: 'none'}}>
		<svg width="100%" height="100%" style={{position: 'absolute', inset: 0, opacity, mixBlendMode: 'overlay'}}>
			<filter id={`${id}-f`}>
				<feTurbulence type="fractalNoise" baseFrequency={0.85} numOctaves={2} seed={frame % 97} stitchTiles="stitch" />
				<feColorMatrix type="saturate" values="0" />
			</filter>
			<rect width="100%" height="100%" filter={`url(#${id}-f)`} />
		</svg>
		{vignette > 0 ? <AbsoluteFill style={{background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,${vignette}) 100%)`}} /> : null}
	</AbsoluteFill>
);

/* ── Burst ──────────────────────────────────────────────────────────────────
 * Rays shoot out and retract from the tip (the base leaves first), plus an expanding thin ring. */
export const Burst: React.FC<{frame: number; start: number; x: number; y: number; color: string; rays?: number; r0?: number; r1?: number; frames?: number; width?: number; ring?: boolean; rot?: number}> = ({
	frame,
	start,
	x,
	y,
	color,
	rays = 12,
	r0 = 30,
	r1 = 180,
	frames = 22,
	width = 5,
	ring = true,
	rot = 0,
}) => {
	const t = (frame - start) / frames;
	if (t < 0 || t > 1.4) return null;
	const head = ease.out(clamp01(t));
	const tail = ease.inOut(clamp01((t - 0.25) / 0.9));
	const rr = lerp(r0, r1 * 1.3, ease.out(clamp01(t / 1.2)));
	return (
		<svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
			{Array.from({length: rays}, (_, i) => {
				const a = rot + (i / rays) * Math.PI * 2;
				const len = i % 2 ? 0.75 : 1;
				const a0 = lerp(r0, r1 * len, tail);
				const a1 = lerp(r0, r1 * len, head);
				if (a1 - a0 < 0.5) return null;
				return <line key={i} x1={x + Math.cos(a) * a0} y1={y + Math.sin(a) * a0} x2={x + Math.cos(a) * a1} y2={y + Math.sin(a) * a1} stroke={color} strokeWidth={width} strokeLinecap="round" />;
			})}
			{ring ? <circle cx={x} cy={y} r={rr} fill="none" stroke={color} strokeWidth={Math.max(0.5, 2.5 * (1 - clamp01(t)))} opacity={1 - clamp01(t)} /> : null}
		</svg>
	);
};

/* ── Aperture (camera iris) ─────────────────────────────────────────────────
 * `open` 0 = fully closed (solid), 1 = fully open (nothing drawn). The blades rotate around the
 * rim; the hole is a regular polygon with `blades` sides. Put the incoming scene underneath. */
export const Aperture: React.FC<{cx: number; cy: number; r: number; open: number; blades?: number; color?: string; edge?: string; spin?: number}> = ({
	cx,
	cy,
	r,
	open,
	blades = 6,
	color = '#141418',
	edge = 'rgba(255,255,255,0.18)',
	spin = 60,
}) => {
	if (open >= 0.999) return null;
	const hole = r * clamp01(open) * 1.02;
	const rot = (1 - open) * ((spin * Math.PI) / 180);
	const R = r * 1.5;
	const polys: string[] = [];
	for (let i = 0; i < blades; i++) {
		const a0 = rot + (i / blades) * Math.PI * 2;
		const a1 = rot + ((i + 1) / blades) * Math.PI * 2;
		// blade: from the hole's edge i to edge i+1, out to the rim, swept by one blade width
		const p0 = [cx + Math.cos(a0) * hole, cy + Math.sin(a0) * hole];
		const p1 = [cx + Math.cos(a1) * hole, cy + Math.sin(a1) * hole];
		const q1 = [p1[0] + Math.cos(a1 + Math.PI / 2 - Math.PI / blades) * R * 2, p1[1] + Math.sin(a1 + Math.PI / 2 - Math.PI / blades) * R * 2];
		const q0 = [p0[0] + Math.cos(a0 + Math.PI / 2 - Math.PI / blades) * R * 2, p0[1] + Math.sin(a0 + Math.PI / 2 - Math.PI / blades) * R * 2];
		polys.push([p0, p1, q1, q0].map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '));
	}
	const id = `ap-${Math.round(cx)}-${Math.round(cy)}-${Math.round(r)}`;
	return (
		<svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
			<defs>
				<clipPath id={id}>
					<circle cx={cx} cy={cy} r={r} />
				</clipPath>
			</defs>
			<g clipPath={`url(#${id})`}>
				{polys.map((pts, i) => (
					<polygon key={i} points={pts} fill={color} stroke={edge} strokeWidth={1.5} />
				))}
			</g>
		</svg>
	);
};

/* ── Lens / portal ──────────────────────────────────────────────────────────
 * A round window onto another scene with a glass rim, a soft top highlight and a thin chromatic
 * fringe. Grow `r` past the frame's far corner to make the inside scene the new frame. */
export const LensPortal: React.FC<{cx: number; cy: number; r: number; children: React.ReactNode; rim?: number; zoom?: number}> = ({cx, cy, r, children, rim = 1, zoom = 1}) => (
	<>
		<AbsoluteFill style={{clipPath: `circle(${r.toFixed(1)}px at ${cx}px ${cy}px)`}}>
			<AbsoluteFill style={{transformOrigin: `${cx}px ${cy}px`, transform: zoom !== 1 ? `scale(${zoom})` : undefined}}>{children}</AbsoluteFill>
		</AbsoluteFill>
		{rim > 0.01 ? (
			<div
				style={{
					position: 'absolute',
					left: cx - r,
					top: cy - r,
					width: r * 2,
					height: r * 2,
					borderRadius: '50%',
					opacity: rim,
					boxShadow: `inset 0 0 0 1.5px rgba(255,255,255,0.75), inset 0 0 ${r * 0.18}px rgba(255,255,255,0.35), 0 ${r * 0.06}px ${r * 0.2}px rgba(0,0,0,0.25), inset 2px 0 0 rgba(255,60,60,0.35), inset -2px 0 0 rgba(60,120,255,0.35)`,
					background: `radial-gradient(circle at 35% 25%, rgba(255,255,255,0.35), rgba(255,255,255,0) 40%)`,
				}}
			/>
		) : null}
	</>
);

/* ── Slats and band wipes ───────────────────────────────────────────────── */
export const SlatReveal: React.FC<{progress: number; n?: number; color: string; width: number; height: number; vertical?: boolean; stagger?: number; e?: Ease}> = ({
	progress,
	n = 7,
	color,
	width,
	height,
	vertical = true,
	stagger = 0.1,
	e = ease.inOut,
}) => {
	const span = (vertical ? width : height) / n;
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			{Array.from({length: n}, (_, i) => {
				const t = e(clamp01(progress * (1 + stagger * (n - 1)) - i * stagger));
				const s = span * (1 - t);
				if (s < 0.3) return null;
				const off = i * span + (span - s) / 2;
				return <div key={i} style={{position: 'absolute', background: color, left: vertical ? off - 0.3 : 0, top: vertical ? 0 : off - 0.3, width: vertical ? s + 0.6 : width, height: vertical ? height : s + 0.6}} />;
			})}
		</AbsoluteFill>
	);
};

/** A band of colour crossing the frame at an angle; the new scene is revealed behind its trailing edge. */
export const BandWipe: React.FC<{progress: number; angle?: number; color: string; width: number; height: number; band?: number; incoming?: React.ReactNode}> = ({
	progress,
	angle = -18,
	color,
	width,
	height,
	band = 0.35,
	incoming,
}) => {
	const D = Math.hypot(width, height);
	const a = (angle * Math.PI) / 180;
	// position along the wipe axis (perpendicular to the band) from -D/2..D/2 + band
	const lead = lerp(-D / 2, D / 2 + band * D, progress);
	const trail = lead - band * D;
	const nx = Math.cos(a);
	const ny = Math.sin(a);
	const poly = (s0: number, s1: number) => {
		const cx = width / 2;
		const cy = height / 2;
		const px = -ny;
		const py = nx;
		const pts = [
			[cx + nx * s0 + px * D, cy + ny * s0 + py * D],
			[cx + nx * s1 + px * D, cy + ny * s1 + py * D],
			[cx + nx * s1 - px * D, cy + ny * s1 - py * D],
			[cx + nx * s0 - px * D, cy + ny * s0 - py * D],
		];
		return `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')})`;
	};
	return (
		<>
			{incoming ? <AbsoluteFill style={{clipPath: poly(-D, trail)}}>{incoming}</AbsoluteFill> : null}
			<AbsoluteFill style={{clipPath: poly(trail, lead), background: color}} />
		</>
	);
};

/* ── Echo trail (onion skin) ────────────────────────────────────────────────
 * Draws `render(f)` at earlier frames with decaying opacity: arcs and spacing become visible. */
export const EchoTrail: React.FC<{frame: number; count?: number; step?: number; render: (f: number, i: number) => React.ReactNode; fade?: number; minFrame?: number}> = ({
	frame,
	count = 6,
	step = 3,
	render,
	fade = 0.55,
	minFrame = -Infinity,
}) => (
	<>
		{Array.from({length: count}, (_, k) => {
			const i = count - k;
			const f = frame - i * step;
			if (f < minFrame) return null;
			return (
				<div key={i} style={{position: 'absolute', inset: 0, opacity: fade * Math.pow(1 - i / (count + 1), 1.6)}}>
					{render(f, i)}
				</div>
			);
		})}
		{render(frame, 0)}
	</>
);

/* ── Kinetic word ───────────────────────────────────────────────────────────
 * Letters are laid out once with fixed advance widths (pass `widths` measured with measureWidths
 * after fonts load, or let the browser lay out inline-blocks: each letter is its own span so a
 * transform never reflows the line). Behaviours per letter i with progress u_i (0..1, staggered):
 *   rise    from below a mask line with motion blur
 *   drop    falls from above, lands with squash
 *   bounce  drops and bounces twice
 *   stretch scales Y on the baseline, middle letters most (the word STRETCH)
 *   spin    rotates in Y 360° (the word SPIN)
 *   snap    no easing: jumps into place between guide lines (the word SNAP)
 *   smear   slides in horizontally with directional blur
 */
export type KineticMode = 'rise' | 'drop' | 'bounce' | 'stretch' | 'spin' | 'snap' | 'smear';
export const KineticWord: React.FC<{
	text: string;
	frame: number;
	start: number;
	mode: KineticMode;
	style: React.CSSProperties; // font, size, colour, letterSpacing
	stagger?: number; // frames between letters
	dur?: number; // frames per letter
	fromCenter?: boolean; // stagger from the middle outwards
	amount?: number; // mode strength (stretch factor, drop height in em, ...)
	id?: string;
	mask?: boolean; // clip letters to the line box (rise)
}> = ({text, frame, start, mode, style, stagger = 3, dur = 18, fromCenter = false, amount = 1, id = 'kw', mask = mode === 'rise'}) => {
	const chars = Array.from(text);
	const mid = (chars.length - 1) / 2;
	return (
		<span style={{display: 'inline-flex', alignItems: 'flex-end', whiteSpace: 'pre', ...style, overflow: mask ? 'hidden' : undefined, paddingBottom: mask ? '0.08em' : undefined}}>
			{chars.map((c, i) => {
				const order = fromCenter ? Math.abs(i - mid) : i;
				const f0 = start + order * stagger;
				const t = clamp01((frame - f0) / dur);
				let tr = '';
				let op = 1;
				let blur = 0;
				const origin = 'center bottom';
				if (mode === 'rise') {
					const u = ease.out(t);
					tr = `translateY(${(1 - u) * 110}%)`;
					blur = (1 - u) * 6 * (t > 0 && t < 1 ? 1 : 0);
				} else if (mode === 'drop') {
					const fall = clamp01(t / 0.55);
					const y = -(1 - fall * fall) * 1.2 * amount;
					const land = t > 0.55 ? Math.exp(-(t - 0.55) * 9) * Math.cos((t - 0.55) * 22) : 0;
					tr = `translateY(${y}em) scale(${1 + 0.18 * land}, ${1 - 0.22 * land})`;
					op = t > 0 ? 1 : 0;
				} else if (mode === 'bounce') {
					// two decaying parabolic hops after the fall
					const T = t * 3;
					const seg = T < 1 ? T : T < 2 ? T - 1 : T - 2;
					const h = T < 1 ? 1 - seg * seg : (T < 2 ? 0.45 : 0.15) * 4 * seg * (1 - seg);
					const squash = T >= 1 && seg < 0.12 ? 1 - seg / 0.12 : 0;
					tr = `translateY(${-h * amount}em) scale(${1 + 0.2 * squash}, ${1 - 0.25 * squash})`;
					op = t > 0 ? 1 : 0;
				} else if (mode === 'stretch') {
					const k = 1 - Math.abs(i - mid) / (mid + 1);
					const u = ease.inOut(t);
					tr = `scale(${lerp(1, 1 - 0.18 * k * amount, u)}, ${lerp(1, 1 + 1.05 * k * amount, u)})`;
				} else if (mode === 'spin') {
					const u = ease.inOut(t);
					tr = `perspective(600px) rotateY(${(1 - u) * 360 * amount}deg)`;
					op = t > 0 ? 1 : 0;
				} else if (mode === 'snap') {
					op = t > 0 ? 1 : 0;
					tr = t > 0 && t < 0.12 ? 'scale(1.06)' : '';
				} else if (mode === 'smear') {
					const u = ease.out(t);
					tr = `translateX(${(1 - u) * 1.5 * amount}em)`;
					op = clamp01(t * 4);
					blur = (1 - u) * 14;
				}
				return (
					<span key={i} style={{display: 'inline-block', transformOrigin: origin, transform: tr || undefined, opacity: op, filter: blur > 0.3 ? `url(#${id}-b${i})` : undefined, willChange: 'transform'}}>
						{blur > 0.3 ? (
							<svg width={0} height={0} style={{position: 'absolute'}}>
								<filter id={`${id}-b${i}`} x="-50%" y="-50%" width="200%" height="200%">
									<feGaussianBlur stdDeviation={mode === 'smear' ? `${blur.toFixed(2)} 0` : `0 ${blur.toFixed(2)}`} />
								</filter>
							</svg>
						) : null}
						{c === ' ' ? ' ' : c}
					</span>
				);
			})}
		</span>
	);
};

/* ── Absorb into the dot ────────────────────────────────────────────────────
 * The word's letters slide right into its final dot, compressing and fading from the left, with
 * horizontal blur while fast. The dot stays and becomes the carrier for the next scene.
 * `letterX` are the letters' left offsets (px) and `dotX` the dot's centre, both relative to the
 * word's origin. */
export const AbsorbWord: React.FC<{
	chars: string[];
	letterX: number[];
	dotX: number;
	progress: number; // 0..1 of the absorb
	style: React.CSSProperties;
	id?: string;
}> = ({chars, letterX, dotX, progress, style, id = 'absorb'}) => {
	const n = chars.length;
	return (
		<div style={{position: 'relative', ...style}}>
			{chars.map((c, i) => {
				const order = (n - 1 - i) / Math.max(1, n - 1); // rightmost letters go first
				const t = clamp01((progress - order * 0.35) / 0.65);
				const u = ease.in(t);
				const x = lerp(letterX[i], dotX, u);
				const sx = lerp(1, 0.15, u);
				const blur = Math.sin(Math.PI * t) * 10;
				return (
					<span key={i} style={{position: 'absolute', left: x, top: 0, transform: `scaleX(${sx})`, transformOrigin: 'right center', opacity: 1 - clamp01((t - 0.75) / 0.25), filter: blur > 0.3 ? `url(#${id}-${i})` : undefined}}>
						{blur > 0.3 ? (
							<svg width={0} height={0} style={{position: 'absolute'}}>
								<filter id={`${id}-${i}`} x="-50%" y="-20%" width="200%" height="140%">
									<feGaussianBlur stdDeviation={`${blur.toFixed(2)} 0`} />
								</filter>
							</svg>
						) : null}
						{c}
					</span>
				);
			})}
		</div>
	);
};

/** Measure letter advance widths with canvas once fonts are loaded (use inside a component after
 *  delayRender/continueRender on document.fonts). Deterministic for a given font. */
export const measureWidths = (text: string, font: string, letterSpacingPx = 0): number[] => {
	const c = document.createElement('canvas').getContext('2d')!;
	c.font = font;
	const chars = Array.from(text);
	const xs: number[] = [];
	let x = 0;
	for (let i = 0; i < chars.length; i++) {
		xs.push(x);
		// advance = width(prefix incl. char) - width(prefix) keeps kerning
		x = c.measureText(chars.slice(0, i + 1).join('')).width + letterSpacingPx * (i + 1);
	}
	xs.push(x);
	return xs; // left offset of each letter, plus the total width as the last entry
};

/* ── Numbers and typing ─────────────────────────────────────────────────── */
export const Counter: React.FC<{from: number; to: number; progress: number; decimals?: number; prefix?: string; suffix?: string; style?: React.CSSProperties; e?: Ease}> = ({
	from,
	to,
	progress,
	decimals = 0,
	prefix = '',
	suffix = '',
	style,
	e = ease.out,
}) => {
	const v = lerp(from, to, e(clamp01(progress)));
	const s = v.toLocaleString('en-US', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
	return <span style={{fontVariantNumeric: 'tabular-nums', ...style}}>{prefix + s + suffix}</span>;
};

/** Typed text: characters appear at `cps` characters per second with small human jitter,
 *  and a caret that blinks when idle. Returns the frames each character appears on (for typing
 *  sounds) through `onFrames` when you need them: use typeFrames() instead in the cue script. */
export const typeFrames = (text: string, start: number, fps: number, cps = 16, seed = 1) => {
	const out: number[] = [];
	let f = start;
	for (let i = 0; i < text.length; i++) {
		out.push(Math.round(f));
		const ch = text[i];
		f += (fps / cps) * (0.7 + 0.6 * rand(seed * 100 + i)) * (ch === ' ' ? 1.3 : 1) * ('.,!?'.includes(ch) ? 2.2 : 1);
	}
	return out;
};

export const TypeOn: React.FC<{text: string; frame: number; start: number; fps: number; cps?: number; seed?: number; caretColor?: string; style?: React.CSSProperties; caret?: boolean}> = ({
	text,
	frame,
	start,
	fps,
	cps = 16,
	seed = 1,
	caretColor = 'currentColor',
	style,
	caret = true,
}) => {
	const fr = typeFrames(text, start, fps, cps, seed);
	const n = fr.filter((f) => f <= frame).length;
	const typing = n < text.length && frame >= start;
	const blinkOn = typing || Math.floor((frame - (fr[fr.length - 1] ?? start)) / (fps * 0.5)) % 2 === 0;
	return (
		<span style={{whiteSpace: 'pre', ...style}}>
			{text.slice(0, n)}
			{/* zero-width caret right after the typed text; it never moves the line */}
			{caret && frame >= start ? (
				<span style={{position: 'relative', display: 'inline-block', width: 0, height: '1em', verticalAlign: '-0.14em'}}>
					<span style={{position: 'absolute', left: '0.04em', top: 0, width: '0.07em', height: '100%', background: caretColor, opacity: blinkOn ? 1 : 0}} />
				</span>
			) : null}
			{/* reserve the rest so the line never reflows */}
			<span style={{opacity: 0}}>{text.slice(n)}</span>
		</span>
	);
};

/* ── Particles ──────────────────────────────────────────────────────────────
 * Targets from text or shapes; each particle flies from its source on a bent path with its own
 * delay (left to right by default), trails a short streak while fast, and settles. */
export type P3 = {x: number; y: number};
export const sampleText = (text: string, font: string, width: number, height: number, step = 6, align: 'center' | 'left' = 'center'): P3[] => {
	const cv = document.createElement('canvas');
	cv.width = width;
	cv.height = height;
	const c = cv.getContext('2d')!;
	c.font = font;
	c.fillStyle = '#fff';
	c.textBaseline = 'middle';
	c.textAlign = align;
	c.fillText(text, align === 'center' ? width / 2 : 0, height / 2);
	const d = c.getImageData(0, 0, width, height).data;
	const pts: P3[] = [];
	for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) if (d[(y * width + x) * 4 + 3] > 128) pts.push({x, y});
	return pts;
};
export const sampleCircle = (cx: number, cy: number, r: number, n: number, ring = false): P3[] =>
	Array.from({length: n}, (_, i) => {
		const a = i * 2.39996323; // golden angle
		const rr = ring ? r : r * Math.sqrt((i + 0.5) / n);
		return {x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr};
	});

export const ParticleForm: React.FC<{
	frame: number;
	start: number;
	dur: number; // frames for one particle's flight
	targets: P3[];
	from?: 'scatter' | P3; // a point: everything bursts out of it
	spread?: number; // stagger width in frames across the formation
	color: string | ((i: number) => string);
	size?: number;
	width: number;
	height: number;
	seed?: number;
	swirl?: number; // curl of the path (radians at mid-flight)
	reverse?: boolean; // collapse instead of form
}> = ({frame, start, dur, targets, from = 'scatter', spread = 30, color, size = 2.4, width, height, seed = 3, swirl = 0.6, reverse = false}) => {
	const xs = targets.map((p) => p.x);
	const minX = Math.min(...xs);
	const maxX = Math.max(...xs) || 1;
	return (
		<svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
			{targets.map((p, i) => {
				const src = from === 'scatter' ? {x: rand(seed + i * 3.1) * width, y: rand(seed + i * 7.7) * height} : from;
				const d = ((p.x - minX) / (maxX - minX + 1e-6)) * spread + rand(i + seed) * 8;
				let t = clamp01((frame - start - d) / dur);
				if (reverse) t = 1 - t;
				const u = ease.inOut(t);
				const mx = (src.x + p.x) / 2;
				const my = (src.y + p.y) / 2;
				const dx = p.x - src.x;
				const dy = p.y - src.y;
				const bend = swirl * (rand(i * 1.3 + seed) - 0.3);
				const cx = mx - dy * bend;
				const cy = my + dx * bend;
				const at = (v: number) => ({x: (1 - v) * (1 - v) * src.x + 2 * (1 - v) * v * cx + v * v * p.x, y: (1 - v) * (1 - v) * src.y + 2 * (1 - v) * v * cy + v * v * p.y});
				const q = at(u);
				const q0 = at(ease.inOut(clamp01(t - 0.06)));
				const fast = t > 0.02 && t < 0.95;
				const col = typeof color === 'function' ? color(i) : color;
				return (
					<g key={i}>
						{fast ? <line x1={q0.x} y1={q0.y} x2={q.x} y2={q.y} stroke={col} strokeWidth={size * 0.7} strokeOpacity={0.35} strokeLinecap="round" /> : null}
						<circle cx={q.x} cy={q.y} r={size * (t > 0.97 ? 1 : 0.85)} fill={col} opacity={0.35 + 0.65 * t} />
					</g>
				);
			})}
		</svg>
	);
};

/* ── RGB split ──────────────────────────────────────────────────────────────
 * Chromatic separation for 4 to 10 frame glitch accents on a hard cut. `amount` in px. */
export const RgbSplit: React.FC<{amount: number; id: string; children: React.ReactNode; angle?: number}> = ({amount, id, children, angle = 0}) => {
	if (Math.abs(amount) < 0.3) return <>{children}</>;
	const dx = Math.cos(angle) * amount;
	const dy = Math.sin(angle) * amount;
	return (
		<>
			<svg width={0} height={0} style={{position: 'absolute'}}>
				<filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
					<feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
					<feOffset in="r" dx={dx} dy={dy} result="ro" />
					<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
					<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
					<feOffset in="b" dx={-dx} dy={-dy} result="bo" />
					<feBlend in="ro" in2="g" mode="screen" result="rg" />
					<feBlend in="rg" in2="bo" mode="screen" />
				</filter>
			</svg>
			<div style={{position: 'absolute', inset: 0, filter: `url(#${id})`}}>{children}</div>
		</>
	);
};

/** Speed per frame of any animated point over [start, end], for synth_score whooshes
 *  ("speed": [...]) so the sound's loudness follows the picture exactly. */
export const speedCurve = (fn: (f: number) => Pt | number, start: number, end: number) => {
	const out: number[] = [];
	for (let f = start; f <= end; f++) {
		const a = fn(f - 0.5);
		const b = fn(f + 0.5);
		out.push(typeof a === 'number' ? Math.abs((b as number) - a) : Math.hypot((b as Pt).x - a.x, (b as Pt).y - a.y));
	}
	return out.map((v) => Math.round(v * 100) / 100);
};
