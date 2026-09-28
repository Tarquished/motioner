/* The word "motioner": exact layout, particle targets, the coral tittle of the i, and the
 * crossbar of the t. Canvas and DOM use the same font and the same per-letter offsets, so the
 * particles, the solid word and the drawn bar all line up to the pixel. */
import React from 'react';
import {clamp01, ease, lerp, rand} from './motioner/motion';
import {C, displayFont, displayStyle, layout} from './shared';

export const WORD = 'motioner';
export const WSIZE = 250;
export const BL = 600; // baseline of the word on screen

type Box = {x: number; y: number; w: number; h: number};
type Info = {off: number[]; x0: number; top: number; pts: {x: number; y: number; tittle: boolean}[]; tittle: Box; tBar: Box; tBox: Box};
let INFO: Info | null = null;

export const wordInfo = (): Info => {
	if (INFO) return INFO;
	const off = layout(WORD, WSIZE);
	const total = off[off.length - 1];
	const x0 = Math.round(960 - total / 2);
	const cv = document.createElement('canvas');
	cv.width = 1920;
	cv.height = 1080;
	const c = cv.getContext('2d')!;
	c.font = displayFont(WSIZE);
	const m = c.measureText(WORD);
	const A = m.fontBoundingBoxAscent;
	const D = m.fontBoundingBoxDescent;
	const top = BL - A - (WSIZE - (A + D)) / 2; // CSS line box top for line-height 1
	c.fillStyle = '#fff';
	c.textBaseline = 'alphabetic';
	Array.from(WORD).forEach((ch, i) => c.fillText(ch, x0 + off[i], BL));
	const data = c.getImageData(0, 0, 1920, 1080).data;
	const at = (x: number, y: number) => data[(y * 1920 + x) * 4 + 3];
	const xh = c.measureText('x').actualBoundingBoxAscent;
	// tittle of the i: pixels of the i above the x-height
	const iL = Math.floor(x0 + off[3]);
	const iR = Math.ceil(x0 + off[4]);
	let tx0 = 9999, tx1 = -1, ty0 = 9999, ty1 = -1;
	for (let y = Math.floor(BL - WSIZE); y < BL - xh - 4; y++) for (let x = iL; x < iR; x++) if (at(x, y) > 128) {
		tx0 = Math.min(tx0, x);
		tx1 = Math.max(tx1, x);
		ty0 = Math.min(ty0, y);
		ty1 = Math.max(ty1, y);
	}
	const tittle = {x: tx0, y: ty0, w: tx1 - tx0 + 1, h: ty1 - ty0 + 1};
	// the t: its box and its crossbar (rows much wider than the stem)
	const tL = Math.floor(x0 + off[2]);
	const tR = Math.ceil(x0 + off[3]) + 4;
	const rows: {y: number; a: number; b: number}[] = [];
	for (let y = Math.floor(BL - WSIZE); y < BL + 10; y++) {
		let a = -1, b = -1;
		for (let x = tL; x < tR; x++) if (at(x, y) > 128) {
			if (a < 0) a = x;
			b = x;
		}
		if (a >= 0) rows.push({y, a, b});
	}
	const widths = rows.map((r) => r.b - r.a + 1);
	const stem = widths.slice().sort((p, q) => p - q)[Math.floor(widths.length * 0.3)];
	const barRows = rows.filter((r) => r.b - r.a + 1 > stem * 1.7 && r.y < BL - xh * 0.5);
	const tBar = {x: Math.min(...barRows.map((r) => r.a)), y: Math.min(...barRows.map((r) => r.y)), w: 0, h: 0};
	tBar.w = Math.max(...barRows.map((r) => r.b)) - tBar.x + 1;
	tBar.h = Math.max(...barRows.map((r) => r.y)) - tBar.y + 1;
	const tBox = {x: Math.min(...rows.map((r) => r.a)), y: rows[0].y, w: 0, h: 0};
	tBox.w = Math.max(...rows.map((r) => r.b)) - tBox.x + 1;
	tBox.h = rows[rows.length - 1].y - tBox.y + 1;
	// particle targets on a 7 px lattice
	const pts: Info['pts'] = [];
	for (let y = Math.floor(BL - WSIZE); y < BL + 70; y += 7) for (let x = x0 - 10; x < x0 + total + 10; x += 7) if (at(x, y) > 128) {
		pts.push({x, y, tittle: x >= tittle.x - 2 && x <= tittle.x + tittle.w + 2 && y >= tittle.y - 2 && y <= tittle.y + tittle.h + 2});
	}
	INFO = {off, x0, top, pts, tittle, tBar, tBox};
	return INFO;
};

/** One letter of the word as an absolutely placed span (plus the coral tittle over the i). */
export const Letter: React.FC<{i: number; color: string; tittleColor?: string; tr?: string; origin?: string; opacity?: number}> = ({i, color, tittleColor = C.coral, tr, origin = '50% 100%', opacity = 1}) => {
	const {off, x0, top, tittle} = wordInfo();
	const ch = WORD[i];
	const left = x0 + off[i];
	return (
		<div style={{position: 'absolute', left, top, width: off[i + 1] - off[i] + 40, height: WSIZE, transform: tr, transformOrigin: origin, opacity, willChange: 'transform'}}>
			<span style={{...displayStyle(WSIZE, color), position: 'absolute', left: 0, top: 0}}>{ch}</span>
			{i === 3 ? <div style={{position: 'absolute', left: tittle.x - left, top: tittle.y - top, width: tittle.w, height: tittle.h, background: tittleColor}} /> : null}
		</div>
	);
};

/** The solid word, revealed from the left by a scan line (`reveal` 0..1). */
export const SolidWord: React.FC<{reveal: number; color: string; scan?: string; tittleScale?: number}> = ({reveal, color, scan = C.coral, tittleScale = 1}) => {
	const {off, x0} = wordInfo();
	const total = off[off.length - 1];
	const edge = lerp(x0 - 30, x0 + total + 30, reveal);
	return (
		<>
			<div style={{position: 'absolute', inset: 0, clipPath: reveal >= 1 ? undefined : `inset(0 ${1920 - edge}px 0 0)`}}>
				{Array.from(WORD).map((_, i) => (
					<Letter key={i} i={i} color={color} />
				))}
			</div>
			{tittleScale !== 1 ? <TittlePulse scale={tittleScale} /> : null}
			{reveal > 0 && reveal < 1 ? <div style={{position: 'absolute', left: edge - 1.5, top: BL - WSIZE * 0.95, width: 3, height: WSIZE * 1.2, background: scan}} /> : null}
		</>
	);
};

const TittlePulse: React.FC<{scale: number}> = ({scale}) => {
	const {tittle} = wordInfo();
	return (
		<div style={{position: 'absolute', left: tittle.x, top: tittle.y, width: tittle.w, height: tittle.h, background: C.coral, borderRadius: 3, transform: `scale(${scale})`}} />
	);
};

/** Particles of the word. `pos(i, p)` gives each particle's position; drawn as dots with a streak. */
export const WordParticles: React.FC<{
	t: (i: number) => number; // 0..1 flight progress per particle
	from: (i: number) => {x: number; y: number};
	swirl?: number;
	fade?: (x: number) => number; // opacity by screen x (used by the scan-line wipe)
	r?: number;
	color: string;
	startOpacity?: number;
}> = ({t, from, swirl = 1.1, fade, r = 3.2, color, startOpacity = 0.25}) => {
	const {pts} = wordInfo();
	const path = (i: number, u: number) => {
		const p = pts[i];
		const s = from(i);
		// spiral in around the frame centre: interpolate in polar coordinates with an extra turn
		const cx = 960;
		const cy = 540;
		const r0 = Math.hypot(s.x - cx, s.y - cy);
		const a0 = Math.atan2(s.y - cy, s.x - cx);
		const r1 = Math.hypot(p.x - cx, p.y - cy);
		let a1 = Math.atan2(p.y - cy, p.x - cx);
		while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
		while (a1 - a0 < -Math.PI) a1 += 2 * Math.PI;
		const turn = swirl * (0.6 + 0.8 * rand(i * 3.3)) * (1 - u);
		const rr = lerp(r0, r1, u);
		const aa = lerp(a0, a1, u) + turn * Math.sin(Math.PI * u) * 0.9;
		return {x: cx + Math.cos(aa) * rr, y: cy + Math.sin(aa) * rr};
	};
	return (
		<svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
			{pts.map((p, i) => {
				const ti = clamp01(t(i));
				const u = ease.inOut(ti);
				const q = path(i, u);
				const q0 = path(i, ease.inOut(clamp01(ti - 0.05)));
				const o = (startOpacity + (1 - startOpacity) * clamp01(ti * 3)) * (fade ? fade(q.x) : 1);
				if (o <= 0.01) return null;
				const col = p.tittle ? C.coral : color;
				return (
					<g key={i} opacity={o}>
						{ti > 0.02 && ti < 0.96 ? <line x1={q0.x} y1={q0.y} x2={q.x} y2={q.y} stroke={col} strokeWidth={r * 0.8} strokeOpacity={0.4} strokeLinecap="round" /> : null}
						<circle cx={q.x} cy={q.y} r={r} fill={col} />
					</g>
				);
			})}
		</svg>
	);
};
