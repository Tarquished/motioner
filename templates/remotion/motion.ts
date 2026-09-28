/**
 * Motioner motion kit: deterministic, frame-driven animation helpers for Remotion.
 *
 * Everything here is a pure function of the frame number. No CSS transitions, no timers,
 * no Math.random(); seed any variation from an index.
 */
import {Easing, interpolate, spring} from 'remotion';

export type Ease = (t: number) => number;

/* ── Curves ──────────────────────────────────────────────────────────────────
 * Pick by role, not by habit. Values are standard, well-tested curves.
 *   out      entrances, things arriving, UI responding          (fast start, long settle)
 *   inOut    object moving from A to B on screen, camera moves   (symmetric)
 *   in       exits that leave the frame (only when they leave!)
 *   snap     morph carriers and shared elements                  (soft start, decisive, soft landing)
 *   whip     whip-pans and zoom-throughs                          (very slow ends, violent middle)
 *   anticip  a small pull-back before a big move
 */
export const ease = {
	linear: (t: number) => t,
	out: Easing.bezier(0.16, 1, 0.3, 1), // expo-like ease-out
	outSoft: Easing.bezier(0.23, 1, 0.32, 1),
	inOut: Easing.bezier(0.65, 0, 0.35, 1),
	inOutSoft: Easing.bezier(0.45, 0, 0.55, 1),
	in: Easing.bezier(0.55, 0, 1, 0.45),
	// carriers and shared elements: eases out of rest over ~4 frames, travels decisively, lands softly.
	// (0.2, 0, 0, 1) was tried and rejected: 8 -> 32 -> 70 px/frame in the first 3 frames of a 700 px
	// move reads as an object that sat still and then teleported.
	snap: Easing.bezier(0.45, 0, 0.15, 1),
	whip: Easing.bezier(0.77, 0, 0.175, 1),
	anticip: Easing.bezier(0.36, 0, 0.66, -0.56),
	expand: Easing.bezier(0.5, 0, 0.15, 1), // reveals growing from an element: leaves it gently, fills fast, lands soft
	backOut: (overshoot = 1.4): Ease => Easing.bezier(0.34, overshoot > 1.2 ? 1.56 : 1.3, 0.64, 1),
} as const;

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** 0..1 progress of `frame` through [start, end], eased. */
export const prog = (frame: number, start: number, end: number, e: Ease = ease.inOut) =>
	e(clamp01((frame - start) / Math.max(1e-6, end - start)));

/** Tween a number between two frames. */
export const tween = (frame: number, [f0, f1]: [number, number], [v0, v1]: [number, number], e: Ease = ease.inOut) =>
	v0 + (v1 - v0) * prog(frame, f0, f1, e);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Deterministic spring (0 -> 1) starting at `start`. */
export const springAt = (frame: number, fps: number, start: number, config: {damping?: number; stiffness?: number; mass?: number} = {}) =>
	spring({frame: frame - start, fps, config: {damping: 14, stiffness: 170, mass: 1, ...config}});

/* ── Keyframe tracks without hitches ─────────────────────────────────────────
 * A chain of separate eased tweens stops at every key (velocity 0) and then restarts: the eye
 * reads that as a stutter ("patah-patah"). When a value passes THROUGH a key, use a smooth
 * track: monotone cubic Hermite through the keys, with an overall ease on time if wanted.
 * Keys that should truly stop get `hold: true`.
 */
export type Key = {f: number; v: number; hold?: boolean};

export const smoothTrack = (frame: number, keys: Key[]): number => {
	if (keys.length === 0) return 0;
	if (frame <= keys[0].f) return keys[0].v;
	const last = keys[keys.length - 1];
	if (frame >= last.f) return last.v;
	let i = 0;
	while (i < keys.length - 2 && frame > keys[i + 1].f) i++;
	const k0 = keys[i];
	const k1 = keys[i + 1];
	const slope = (a: Key, b: Key) => (b.v - a.v) / Math.max(1e-6, b.f - a.f);
	const tangent = (j: number) => {
		const k = keys[j];
		if (k.hold || j === 0 || j === keys.length - 1) return 0;
		const s0 = slope(keys[j - 1], k);
		const s1 = slope(k, keys[j + 1]);
		if (s0 * s1 <= 0) return 0; // turning point: stop there, no overshoot
		return (2 * s0 * s1) / (s0 + s1); // harmonic mean keeps it monotone
	};
	const h = k1.f - k0.f;
	const t = (frame - k0.f) / h;
	const m0 = tangent(i) * h;
	const m1 = tangent(i + 1) * h;
	const t2 = t * t;
	const t3 = t2 * t;
	return (2 * t3 - 3 * t2 + 1) * k0.v + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * k1.v + (t3 - t2) * m1;
};

/** Pose track for cameras/objects: every field is interpolated with smoothTrack. */
export type Pose = {x: number; y: number; s: number; r?: number};
export const poseTrack = (frame: number, keys: {f: number; p: Pose; hold?: boolean}[]): Pose => {
	const get = (k: keyof Pose) => smoothTrack(frame, keys.map((q) => ({f: q.f, v: (q.p[k] as number) ?? 0, hold: q.hold})));
	return {x: get('x'), y: get('y'), s: get('s'), r: get('r')};
};

/* ── Paths ───────────────────────────────────────────────────────────────── */
export type Pt = {x: number; y: number};

/** Point on a quadratic arc from a to b; `bend` is the sideways offset of the control point
 *  as a fraction of the distance (0.2 is a natural throw; negative bends the other way). */
export const arc = (a: Pt, b: Pt, t: number, bend = 0.2): Pt => {
	const mx = (a.x + b.x) / 2;
	const my = (a.y + b.y) / 2;
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const cx = mx - dy * bend;
	const cy = my + dx * bend;
	const u = 1 - t;
	return {x: u * u * a.x + 2 * u * t * cx + t * t * b.x, y: u * u * a.y + 2 * u * t * cy + t * t * b.y};
};

/* ── Rectangles (shared-element morphs) ─────────────────────────────────── */
export type Rect = {x: number; y: number; w: number; h: number; r?: number};

export const rectLerp = (a: Rect, b: Rect, t: number): Rect => ({
	x: lerp(a.x, b.x, t),
	y: lerp(a.y, b.y, t),
	w: lerp(a.w, b.w, t),
	h: lerp(a.h, b.h, t),
	r: lerp(a.r ?? 0, b.r ?? 0, t),
});

/** Rect whose CENTER travels on an arc while its size interpolates. */
export const rectArc = (a: Rect, b: Rect, t: number, bend = 0.15): Rect => {
	const c = arc({x: a.x + a.w / 2, y: a.y + a.h / 2}, {x: b.x + b.w / 2, y: b.y + b.h / 2}, t, bend);
	const w = lerp(a.w, b.w, t);
	const h = lerp(a.h, b.h, t);
	return {x: c.x - w / 2, y: c.y - h / 2, w, h, r: lerp(a.r ?? 0, b.r ?? 0, t)};
};

/* ── Colour: mix in OKLab, never in sRGB ─────────────────────────────────────
 * sRGB mixes of complementary hues pass through grey/brown ("muddy midpoint"). OKLab keeps
 * perceived lightness and chroma coherent through the blend.
 */
const hexToRgb = (hex: string): [number, number, number] => {
	const h = hex.replace('#', '');
	const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
	return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255) as [number, number, number];
};
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

const rgbToOklab = ([r, g, b]: [number, number, number]) => {
	const [lr, lg, lb] = [toLin(r), toLin(g), toLin(b)];
	const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
	const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
	const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
};
const oklabToRgb = ([L, a, b]: number[]) => {
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	].map((c) => Math.round(Math.min(1, Math.max(0, toSrgb(c))) * 255));
};

/** Perceptual colour mix. `a`, `b` are #rrggbb. */
export const mixColor = (a: string, b: string, t: number): string => {
	const A = rgbToOklab(hexToRgb(a));
	const B = rgbToOklab(hexToRgb(b));
	const [r, g, bl] = oklabToRgb(A.map((v, i) => lerp(v, B[i], clamp01(t))));
	return `rgb(${r}, ${g}, ${bl})`;
};

/** Colour along several stops (0..1), each segment mixed in OKLab. */
export const colorRamp = (stops: string[], t: number): string => {
	const x = clamp01(t) * (stops.length - 1);
	const i = Math.min(stops.length - 2, Math.floor(x));
	return mixColor(stops[i], stops[i + 1], x - i);
};

/* ── Speed: for sound placement and motion blur ──────────────────────────── */

/** Absolute speed (units per frame) of any animated scalar or point. */
export const speedAt = (fn: (f: number) => number | Pt, frame: number): number => {
	const a = fn(frame - 0.5);
	const b = fn(frame + 0.5);
	if (typeof a === 'number' && typeof b === 'number') return Math.abs(b - a);
	const p = a as Pt;
	const q = b as Pt;
	return Math.hypot(q.x - p.x, q.y - p.y);
};

/** Frame of highest speed within [start, end]: put a whoosh's PEAK here. */
export const fastestFrame = (fn: (f: number) => number | Pt, start: number, end: number): number => {
	let best = start;
	let bestV = -1;
	for (let f = start; f <= end; f++) {
		const v = speedAt(fn, f);
		if (v > bestV) {
			bestV = v;
			best = f;
		}
	}
	return best;
};

/** Seeded pseudo-random in [0,1) for deterministic scatter. */
export const rand = (seed: number) => {
	const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
	return x - Math.floor(x);
};

export {interpolate};
