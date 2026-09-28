/**
 * Motioner transition kit: reveals and camera handoffs that carry the eye from scene to scene.
 * All components are pure functions of `frame`. Wrap scenes in <AbsoluteFill> and render the
 * outgoing scene until the transition's end frame, the incoming one from its start frame.
 */
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {clamp01, Ease, ease, lerp, prog, Pt} from './motion';

/* ── Directional motion blur (SVG filter usable on HTML) ─────────────────────
 * Blur only along the direction of travel and only while the move is fast. Uniform CSS blur on a
 * moving object looks like a focus problem, not motion.
 */
export const MotionBlur: React.FC<{id: string; dx: number; dy: number; children: React.ReactNode; style?: React.CSSProperties}> = ({
	id,
	dx,
	dy,
	children,
	style,
}) => {
	const bx = Math.abs(dx);
	const by = Math.abs(dy);
	const active = bx > 0.15 || by > 0.15;
	return (
		<>
			{active ? (
				<svg width={0} height={0} style={{position: 'absolute'}}>
					<defs>
						<filter id={id} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
							<feGaussianBlur stdDeviation={`${bx.toFixed(2)} ${by.toFixed(2)}`} edgeMode="duplicate" />
						</filter>
					</defs>
				</svg>
			) : null}
			<div style={{...style, filter: active ? `url(#${id})` : undefined}}>{children}</div>
		</>
	);
};

/** Blur amount from speed (px per frame). About 0.35 of the per-frame travel reads as natural
 *  motion blur at 60 fps (a 180-degree shutter would be 0.5); cap it so detail survives. */
export const blurFromSpeed = (pxPerFrame: number, k = 0.35, max = 40) => Math.min(max, Math.abs(pxPerFrame) * k);

/* ── Flood reveal: a shape grows from an element and becomes the next scene ──
 * Start the shape at the size and colour of the element it grows from (a button, a dot, a bomb),
 * so frame `start` is continuous with the outgoing picture. Use ONE continuous curve for the radius:
 * accelerate out of the element, then decelerate as the edge reaches the far corners. Do not splice
 * a fast "punch" onto a slow "creep": the velocity breaks at the join and the reveal pops, then
 * stalls. Anything in the incoming scene that sits near the moving edge (captions, UI) should enter
 * only after the edge has passed it, or the two scenes' text meet at the rim.
 */
export const burstPolygon = (cx: number, cy: number, R: number, spikes = 12, depth = 0.22, rot = 0, wobbleSeed = 3) => {
	const pts: string[] = [];
	for (let i = 0; i < spikes * 2; i++) {
		const a = rot + (i / (spikes * 2)) * Math.PI * 2;
		const wob = 1 + 0.08 * Math.sin(i * 2.3 + wobbleSeed);
		const r = (i % 2 === 0 ? R : R * (1 - depth)) * wob;
		pts.push(`${(cx + Math.cos(a) * r).toFixed(1)}px ${(cy + Math.sin(a) * r).toFixed(1)}px`);
	}
	return `polygon(${pts.join(', ')})`;
};

export const FloodReveal: React.FC<{
	frame: number;
	start: number;
	end: number;
	origin: Pt;
	/** radius of the element the flood grows from, so the first frame matches it */
	r0: number;
	width: number;
	height: number;
	shape?: 'circle' | 'burst';
	/** optional ring running just ahead of the edge; fades out before it reaches the frame edges */
	rim?: {color: string; width: number};
	children: React.ReactNode; // the incoming scene (its background = flood colour)
	/** radius curve over time; default accelerates out of the element and settles at the edges */
	curve?: Ease;
}> = ({frame, start, end, origin, r0, width, height, shape = 'circle', rim, children, curve = ease.expand}) => {
	if (frame < start) return null;
	const t = clamp01((frame - start) / (end - start));
	const far = Math.max(
		Math.hypot(origin.x, origin.y),
		Math.hypot(width - origin.x, origin.y),
		Math.hypot(origin.x, height - origin.y),
		Math.hypot(width - origin.x, height - origin.y),
	);
	const Rmax = far * (shape === 'burst' ? 1.35 : 1.04);
	const k = curve(t);
	const R = lerp(r0, Rmax, k);
	const clip = shape === 'circle' ? `circle(${R.toFixed(1)}px at ${origin.x}px ${origin.y}px)` : burstPolygon(origin.x, origin.y, R, 12, lerp(0.22, 0.04, k), k * 0.6);
	const rimO = rim ? clamp01(1 - (R - far * 0.55) / (far * 0.3)) : 0;
	return (
		<>
			{rim && rimO > 0.01 && t < 1 ? (
				<AbsoluteFill style={{pointerEvents: 'none'}}>
					<div
						style={{
							position: 'absolute',
							left: origin.x - R - rim.width * 1.5,
							top: origin.y - R - rim.width * 1.5,
							width: 2 * (R + rim.width * 1.5),
							height: 2 * (R + rim.width * 1.5),
							borderRadius: '50%',
							border: `${rim.width}px solid ${rim.color}`,
							opacity: rimO,
						}}
					/>
				</AbsoluteFill>
			) : null}
			<AbsoluteFill style={{clipPath: t >= 1 ? undefined : clip}}>{children}</AbsoluteFill>
		</>
	);
};

/* ── Zoom-through: push into an element until its fill becomes the next scene ─
 * Scale grows exponentially (perceptually constant speed). The outgoing scene is replaced at
 * `swapAt` by the incoming scene, which continues the same zoom from `inFrom` down to 1, so the
 * motion never stops at the cut. Choose a focus element whose colour equals the incoming
 * background, or bridge the colour with the element's own fill.
 */
export const ZoomThrough: React.FC<{
	frame: number;
	start: number;
	end: number;
	focus: Pt; // point in the outgoing scene to push into
	maxScale?: number;
	swapAt?: number; // 0..1
	inFrom?: number; // incoming scene starts this much larger
	incomingFocus?: Pt;
	e?: Ease;
	outgoing: React.ReactNode;
	incoming: React.ReactNode;
	blur?: number; // max radial-ish blur at the swap (px)
}> = ({frame, start, end, focus, maxScale = 9, swapAt = 0.6, inFrom = 1.8, incomingFocus, e = ease.whip, outgoing, incoming, blur = 6}) => {
	const t = clamp01((frame - start) / (end - start));
	const u = e(t);
	if (frame < start) return <AbsoluteFill>{outgoing}</AbsoluteFill>;
	if (u < swapAt) {
		const s = Math.pow(maxScale, u / swapAt);
		const b = blur * clamp01((u / swapAt - 0.6) / 0.4);
		return (
			<AbsoluteFill style={{transformOrigin: `${focus.x}px ${focus.y}px`, transform: `scale(${s})`, filter: b > 0.1 ? `blur(${b}px)` : undefined}}>
				{outgoing}
			</AbsoluteFill>
		);
	}
	const v = (u - swapAt) / (1 - swapAt);
	const s = Math.pow(inFrom, 1 - v);
	const f = incomingFocus ?? focus;
	const b = blur * (1 - clamp01(v / 0.4));
	return (
		<AbsoluteFill style={{transformOrigin: `${f.x}px ${f.y}px`, transform: `scale(${s})`, filter: b > 0.1 ? `blur(${b}px)` : undefined}}>
			{incoming}
		</AbsoluteFill>
	);
};

/* ── Whip-pan along one continuous world ─────────────────────────────────────
 * Both scenes sit on one strip (left/right or up/down) sharing the same background texture, so
 * the whip reads as a camera move, not a slide. Blur follows the actual speed of the strip.
 */
export const WhipPan: React.FC<{
	frame: number;
	start: number;
	end: number;
	direction: 'left' | 'right' | 'up' | 'down';
	width: number;
	height: number;
	outgoing: React.ReactNode;
	incoming: React.ReactNode;
	id?: string;
}> = ({frame, start, end, direction, width, height, outgoing, incoming, id = 'whip'}) => {
	const horizontal = direction === 'left' || direction === 'right';
	const span = horizontal ? width : height;
	const sign = direction === 'left' || direction === 'up' ? -1 : 1;
	const pos = (f: number) => sign * span * prog(f, start, end, ease.whip);
	const p = pos(frame);
	const speed = pos(frame + 0.5) - pos(frame - 0.5);
	const b = blurFromSpeed(speed, 0.3, 60);
	const place = (offset: number): React.CSSProperties => ({
		position: 'absolute',
		left: horizontal ? offset : 0,
		top: horizontal ? 0 : offset,
		width,
		height,
	});
	return (
		<AbsoluteFill style={{overflow: 'hidden'}}>
			<MotionBlur id={`${id}-${start}`} dx={horizontal ? b : 0} dy={horizontal ? 0 : b} style={{position: 'absolute', inset: 0}}>
				<div style={place(p)}>{outgoing}</div>
				<div style={place(p - sign * span)}>{incoming}</div>
			</MotionBlur>
		</AbsoluteFill>
	);
};

/* ── Sharp zoom: keep close-ups crisp ────────────────────────────────────────
 * A layer that is scaled up (especially with 3D transforms) can be rasterised at its layout size
 * and then enlarged: soft text and jagged edges in close-ups. Lay the content out `Z` times larger
 * with CSS zoom (text and SVG re-render at that size) and scale it back down by 1/Z, so a
 * camera scale of k is drawn at full resolution. Z = ceil(k * 1.15), capped for memory.
 */
export const rasterZoom = (k: number, cap = 6) => Math.min(cap, Math.max(1, Math.ceil(k * 1.15)));

export const SharpZoom: React.FC<{scale: number; origin: Pt; width: number; height: number; children: React.ReactNode; extra?: string}> = ({
	scale,
	origin,
	width,
	height,
	children,
	extra = '',
}) => {
	const Z = rasterZoom(scale);
	// point p of the content is drawn at p*Z by the zoomed layout; map it to origin + (p - origin) * scale
	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				top: 0,
				width: width * Z,
				height: height * Z,
				transformOrigin: '0 0',
				transform: `translate(${origin.x}px, ${origin.y}px) scale(${scale / Z}) translate(${-origin.x * Z}px, ${-origin.y * Z}px) ${extra}`,
			}}
		>
			<div style={{width: width, height: height, zoom: Z, transformOrigin: '0 0'} as React.CSSProperties}>{children}</div>
		</div>
	);
};
