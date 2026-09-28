/**
 * Motioner morph kit: the carrier model for seamless shared-element and shape morphs.
 *
 * THE CONTRACT (this is what removes double images, ghost cards and ghost text):
 *   1. frame <  start : the SOURCE element is drawn by its scene; no carrier.
 *   2. start <= frame < end : ONLY the carrier is drawn. Source and target are hidden.
 *      On frame `start` the carrier must look pixel-identical to the source; on frame `end`
 *      it must look pixel-identical to the target.
 *   3. frame >= end  : the TARGET element is drawn by its scene; no carrier.
 *   The rest of the incoming scene may appear only around/after the carrier (stagger outward
 *   from it, late in the morph), never already sitting behind it.
 * Use `handoff()` in both scenes so the three states can never overlap.
 *   Carried content that animates must be rendered with the CURRENT frame (never a snapshot of the
 *   start/end frame), and scenes must use the same shadowOf()/decorations as the carrier surfaces,
 *   or small things jump on the handoff frame.
 */
import React, {useLayoutEffect, useRef, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import {interpolate as flubberInterpolate} from 'flubber';
import {clamp01, Ease, ease, lerp, mixColor, prog, Rect, rectArc, rectLerp} from './motion';

export type Phase = 'before' | 'during' | 'after';

/** Which side of a morph the frame is on. Use it to hide the source and the target. */
export const handoff = (frame: number, start: number, end: number): Phase =>
	frame < start ? 'before' : frame < end ? 'during' : 'after';

export type Surface = {
	rect: Rect; // absolute px in the composition (or in the shared parent)
	fill: string; // #rrggbb
	rot?: number; // degrees, around the rect centre
	elevation?: number; // 0..1 shadow strength
	shadowColor?: string; // #rrggbb, default near-black; use the object's own colour for a glow
	border?: {width: number; color: string};
	/** Content drawn inside the surface, laid out at the surface's own size (rect.w x rect.h). */
	content?: React.ReactNode;
};

type CarrierProps = {
	frame: number;
	start: number;
	end: number;
	from: Surface;
	to: Surface;
	ease?: Ease;
	/** Arc bend of the travel path; 0 = straight. Big moves read better on a slight arc. */
	bend?: number;
	/** Portion of the morph during which the old content fades out (no overlap with `contentIn`). */
	contentOut?: [number, number];
	contentIn?: [number, number];
	/** Colour change window inside the morph (defaults to the whole morph). */
	colorWindow?: [number, number];
	/** Extra per-frame styling (e.g. a subtle lift). */
	style?: React.CSSProperties;
	/** Leave unset: carriers stack by render order like everything else. A z-index here lifts the
	 *  carrier over overlays drawn later (a pointer, a ripple) and they vanish on the handoff frame. */
	zIndex?: number;
	/** Stagger inside a group: hold the start state for `delay` frames. The carrier still exists
	 *  from `start`, so the element is never missing (never stagger by shifting `start`). */
	delay?: number;
	/** Extra elevation in the middle of the move (0..1). Keeps a carrier separated from a background
	 *  of similar lightness while its colour passes through the in-between tones. */
	lift?: number;
};

/**
 * The one shadow formula for carriers AND the scenes they hand over to. Style every source and
 * target with shadowOf() and the same elevation/colour as the carrier's from/to surface, or the
 * shadow (or a coloured glow) snaps on the handoff frame.
 */
export const shadowOf = (e0: number, color = '#0F141E') => {
	const e = Math.min(1.4, e0);
	if (e <= 0) return 'none';
	const h = color.replace('#', '');
	const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
	return `0 ${(2 + 22 * e).toFixed(1)}px ${(6 + 48 * e).toFixed(1)}px rgba(${r}, ${g}, ${b}, ${(0.1 + 0.18 * e).toFixed(3)})`;
};

/**
 * The carrier: one element that is the source at `start` and the target at `end`.
 * Geometry is animated with left/top/width/height/border-radius (not transform: scale), so corners,
 * borders and shadows stay crisp and undistorted. Content is scaled uniformly with the width and
 * swapped sequentially (out, then in), never cross-dissolved.
 */
export const MorphCarrier: React.FC<CarrierProps> = ({
	frame,
	start,
	end,
	from,
	to,
	ease: e = ease.snap,
	bend = 0,
	contentOut = [0, 0.35],
	contentIn = [0.55, 1],
	colorWindow = [0, 1],
	style,
	zIndex,
	delay = 0,
	lift = 0,
}) => {
	if (handoff(frame, start, end) !== 'during') return null;
	const raw = clamp01((frame - start - delay) / Math.max(1, end - start - delay));
	const t = e(raw);
	const r = bend ? rectArc(from.rect, to.rect, t, bend) : rectLerp(from.rect, to.rect, t);
	const ct = clamp01((raw - colorWindow[0]) / (colorWindow[1] - colorWindow[0]));
	const fill = mixColor(from.fill, to.fill, ease.inOut(ct));
	const elev = lerp(from.elevation ?? 0, to.elevation ?? 0, t) + lift * Math.sin(Math.PI * raw);
	const rot = lerp(from.rot ?? 0, to.rot ?? 0, t);
	const bw = lerp(from.border?.width ?? 0, to.border?.width ?? 0, t);
	const bc = mixColor(from.border?.color ?? from.fill, to.border?.color ?? to.fill, ct);
	const outO = 1 - clamp01((raw - contentOut[0]) / (contentOut[1] - contentOut[0]));
	const inO = clamp01((raw - contentIn[0]) / (contentIn[1] - contentIn[0]));
	const layer = (s: Surface, opacity: number, blurFrom: number) =>
		s.content && opacity > 0.001 ? (
			<div
				style={{
					position: 'absolute',
					left: 0,
					top: 0,
					width: s.rect.w,
					height: s.rect.h,
					transformOrigin: '0 0',
					transform: `scale(${r.w / s.rect.w})`,
					opacity,
					filter: opacity < 1 ? `blur(${((1 - opacity) * blurFrom).toFixed(2)}px)` : undefined,
				}}
			>
				{s.content}
			</div>
		) : null;
	return (
		<div
			style={{
				position: 'absolute',
				left: r.x,
				top: r.y,
				width: r.w,
				height: r.h,
				borderRadius: r.r,
				background: fill,
				boxShadow: shadowOf(elev, mixColor(from.shadowColor ?? '#0F141E', to.shadowColor ?? '#0F141E', t).replace(/rgb\((\d+), (\d+), (\d+)\)/, (_, r, g, b) => '#' + [r, g, b].map((v) => Number(v).toString(16).padStart(2, '0')).join(''))),
				outline: bw > 0.05 ? `${bw}px solid ${bc}` : undefined,
				outlineOffset: bw > 0.05 ? -bw : undefined,
				overflow: 'hidden',
				transform: rot ? `rotate(${rot.toFixed(3)}deg)` : undefined,
				zIndex,
				...style,
			}}
		>
			{layer(from, outO, 6)}
			{layer(to, inO, 6)}
		</div>
	);
};

/* ── Shape morph (SVG path to SVG path) ─────────────────────────────────────
 * flubber resamples both shapes to matching point lists, so any two closed paths morph without
 * the "folding" and self-intersection that plain point interpolation gives. Keep both shapes
 * similar in orientation and start point for the cleanest in-betweens; check the midpoint frame.
 */
const flubberCache = new Map<string, (t: number) => string>();
export const morphPath = (a: string, b: string, t: number, maxSegmentLength = 3): string => {
	const key = `${a}|${b}|${maxSegmentLength}`;
	let fn = flubberCache.get(key);
	if (!fn) {
		fn = flubberInterpolate(a, b, {maxSegmentLength, string: true}) as (t: number) => string;
		flubberCache.set(key, fn);
	}
	return fn(clamp01(t));
};

export const PathMorph: React.FC<{
	frame: number;
	start: number;
	end: number;
	from: string;
	to: string;
	fillFrom: string;
	fillTo: string;
	ease?: Ease;
	viewBox: string;
	width: number;
	height: number;
	style?: React.CSSProperties;
}> = ({frame, start, end, from, to, fillFrom, fillTo, ease: e = ease.inOut, viewBox, width, height, style}) => {
	const t = prog(frame, start, end, e);
	const d = t <= 0 ? from : t >= 1 ? to : morphPath(from, to, t);
	return (
		<svg viewBox={viewBox} width={width} height={height} style={{overflow: 'visible', ...style}}>
			<path d={d} fill={mixColor(fillFrom, fillTo, t)} />
		</svg>
	);
};

/* ── Letter morph (word A becomes word B) ────────────────────────────────────
 * Only a SHARED CHUNK travels: a run of at least `minRun` consecutive letters that appears in both
 * strings ("Paper" in "Paper notes" -> "Papertrail"). Single letters that happen to match in two
 * unrelated sentences must NOT travel: they cross over the letters still standing and the middle
 * frames become unreadable letter soup. Everything else rolls: old letters leave upward with a
 * short stagger, then new letters rise in (sequential, never both at full opacity in one place).
 * Layout is measured from the real font once (render held with delayRender until fonts are ready),
 * so kerning and widths are the browser's own. Use the same font settings for both strings.
 */
type Glyph = {ch: string; x: number; w: number};

const pairLetters = (a: string, b: string, minRun: number) => {
	const pairs = new Map<number, number>();
	const solve = (a0: number, a1: number, b0: number, b1: number) => {
		let best = 0;
		let bi = 0;
		let bj = 0;
		for (let i = a0; i < a1; i++)
			for (let j = b0; j < b1; j++) {
				let k = 0;
				while (i + k < a1 && j + k < b1 && a[i + k].toLowerCase() === b[j + k].toLowerCase()) k++;
				if (k > best && a.slice(i, i + k).trim().length >= Math.min(k, minRun)) {
					best = k;
					bi = i;
					bj = j;
				}
			}
		if (best < minRun) return;
		for (let k = 0; k < best; k++) if (a[bi + k] !== ' ') pairs.set(bi + k, bj + k);
		solve(a0, bi, b0, bj);
		solve(bi + best, a1, bj + best, b1);
	};
	solve(0, a.length, 0, b.length);
	return pairs;
};

export const LetterMorph: React.FC<{
	frame: number;
	start: number;
	end: number;
	from: string;
	to: string;
	font: React.CSSProperties; // fontFamily, fontSize, fontWeight, letterSpacing ...
	color?: string;
	colorTo?: string;
	/** centre x and baseline-ish y of the line in the parent */
	x: number;
	y: number;
	ease?: Ease;
	/** 'roll' (default): no letter travels. 'travel': shared runs of >= minRun letters travel. */
	mode?: 'roll' | 'travel';
	minRun?: number;
}> = ({frame, start, end, from, to, font, color = '#111111', colorTo, x, y, ease: e = ease.inOut, mode = 'roll', minRun = 3}) => {
	const refA = useRef<HTMLDivElement>(null);
	const refB = useRef<HTMLDivElement>(null);
	const [layout, setLayout] = useState<{a: Glyph[]; b: Glyph[]; wa: number; wb: number} | null>(null);
	const [handle] = useState(() => delayRender('measure LetterMorph'));
	const measure = () => {
		// offset* are layout values, untouched by any ancestor transform (camera, scale-up wrapper).
		// getBoundingClientRect would bake the current frame's transform into the layout.
		const read = (el: HTMLDivElement | null): [Glyph[], number] => {
			if (!el) return [[], 0];
			const spans = Array.from(el.children) as HTMLElement[];
			return [spans.map((s) => ({ch: s.textContent ?? '', x: s.offsetLeft, w: s.offsetWidth})), el.offsetWidth];
		};
		const [a, wa] = read(refA.current);
		const [b, wb] = read(refB.current);
		setLayout({a, b, wa, wb});
	};
	useLayoutEffect(() => {
		let done = false;
		document.fonts.ready.then(() => {
			if (done) return;
			measure();
			continueRender(handle);
		});
		return () => {
			done = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [from, to]);
	const hidden: React.CSSProperties = {position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', display: 'inline-flex', left: 0, top: 0, ...font};
	const probe = (
		<>
			<div ref={refA} style={hidden}>
				{from.split('').map((c, i) => <span key={i}>{c}</span>)}
			</div>
			<div ref={refB} style={hidden}>
				{to.split('').map((c, i) => <span key={i}>{c}</span>)}
			</div>
		</>
	);
	if (!layout) return probe;
	const raw = clamp01((frame - start) / (end - start));
	const pairs = mode === 'travel' ? pairLetters(from, to, minRun) : new Map<number, number>();
	const used = new Set(pairs.values());
	const ax = x - layout.wa / 2;
	const bx = x - layout.wb / 2;
	const dur = end - start;
	const N = Math.max(1, layout.a.length);
	const M = Math.max(1, layout.b.length);
	const size = Number(font.fontSize ?? 60);
	const letters: React.ReactNode[] = [];
	const col = colorTo ? mixColor(color, colorTo, e(raw)) : color;
	const base: React.CSSProperties = {position: 'absolute', top: y, whiteSpace: 'pre', ...font, color: col, lineHeight: 1};
	layout.a.forEach((g, i) => {
		const j = pairs.get(i);
		if (j !== undefined) {
			const tgt = layout.b[j];
			// travellers share one move, offset by at most 10 % of the morph across the word
			const off = (i / N) * 0.1 * dur;
			const t = e(clamp01((frame - start - off) / (dur * 0.9)));
			letters.push(<span key={`p${i}`} style={{...base, left: lerp(ax + g.x, bx + tgt.x, t)}}>{g.ch}</span>);
		} else {
			// leaving letter: out within the first 50 % (staggered over 15 %)
			const t = clamp01((frame - start - (i / N) * 0.15 * dur) / (dur * 0.35));
			const o = 1 - ease.in(t);
			if (o > 0.01)
				letters.push(
					<span key={`a${i}`} style={{...base, left: ax + g.x, opacity: o, transform: `translateY(${-0.25 * t * size}px) scale(${1 - 0.3 * t})`, filter: `blur(${4 * t}px)`}}>
						{g.ch}
					</span>,
				);
		}
	});
	layout.b.forEach((g, j) => {
		if (used.has(j)) return;
		// arriving letter: starts after the leavers are gone (50 %), staggered over 20 %, done at `end`
		const t = ease.out(clamp01((frame - start - dur * 0.5 - (j / M) * 0.2 * dur) / (dur * 0.3)));
		if (t > 0.001)
			letters.push(
				<span key={`b${j}`} style={{...base, left: bx + g.x, opacity: t, transform: `translateY(${(1 - t) * 0.3 * size}px) scale(${0.7 + 0.3 * t})`, filter: `blur(${4 * (1 - t)}px)`}}>
					{g.ch}
				</span>,
			);
	});
	return (
		<>
			{probe}
			{letters}
		</>
	);
};

export {mixColor, rectLerp};
