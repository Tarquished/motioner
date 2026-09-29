/* Shared constants and helpers. Everything here is pure: the picture and the score both import the same numbers. */
import TL from './timeline.json';

export const FPS = TL.fps;
export const BEAT = (FPS * 60) / TL.bpm; // 30 frames at 120 BPM
export const G = 40; // gravity in world units per second squared (1 unit is about 10 cm, slowed down for legibility)
export const GF = G / (FPS * FPS); // per frame squared

export const PAL = {
	ink: '#0F0E11',
	paper: '#EFEBE4',
	coral: '#FF5436',
	blue: '#2F3BF4',
	yellow: '#F6C445',
};

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
	t = clamp(t);
	return t * t * t * (t * (t * 6 - 15) + 10);
};
export const eio = (t: number) => {
	t = clamp(t);
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const eout = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const ein = (t: number) => Math.pow(clamp(t), 3);
export const fit = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
export const bezier = (x1: number, y1: number, x2: number, y2: number) => {
	// cubic-bezier easing as in CSS
	const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
	const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
	const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
	const sy = (t: number) => ((ay * t + by) * t + cy) * t;
	const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
	return (x: number) => {
		x = clamp(x);
		let t = x;
		for (let i = 0; i < 8; i++) {
			const e = sx(t) - x;
			if (Math.abs(e) < 1e-6) break;
			const d = dx(t);
			if (Math.abs(d) < 1e-6) break;
			t -= e / d;
		}
		let lo = 0, hi = 1;
		for (let i = 0; i < 24 && Math.abs(sx(t) - x) > 1e-6; i++) {
			if (sx(t) < x) lo = t; else hi = t;
			t = (lo + hi) / 2;
		}
		return sy(t);
	};
};

export type V3 = [number, number, number];
export const v3 = {
	add: (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
	sub: (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
	mul: (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k],
	lerp: (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],
	len: (a: V3) => Math.hypot(a[0], a[1], a[2]),
	norm: (a: V3): V3 => {
		const l = Math.hypot(a[0], a[1], a[2]) || 1;
		return [a[0] / l, a[1] / l, a[2] / l];
	},
	cross: (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
	dot: (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
};

/** a sampled track: value at a fractional frame (linear between samples, clamped) */
export class Track<T extends number[]> {
	constructor(public f0: number, public step: number, public data: T[]) {}
	at(f: number): T {
		const x = (f - this.f0) / this.step;
		const n = this.data.length;
		if (x <= 0) return this.data[0];
		if (x >= n - 1) return this.data[n - 1];
		const i = Math.floor(x);
		const t = x - i;
		const a = this.data[i], b = this.data[i + 1];
		return a.map((v, k) => v + (b[k] - v) * t) as T;
	}
	get end() {
		return this.f0 + (this.data.length - 1) * this.step;
	}
}

/** a contact / sound event that the score will play */
export type Ev = {f: number; kind: string; [k: string]: any};

/** deterministic pseudo random (mulberry32) */
export const rng = (seed: number) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** bisection on a monotone function */
export const solve = (fn: (x: number) => number, target: number, lo: number, hi: number, it = 60) => {
	const inc = fn(hi) > fn(lo);
	for (let i = 0; i < it; i++) {
		const m = (lo + hi) / 2;
		const v = fn(m);
		if ((v < target) === inc) lo = m; else hi = m;
	}
	return (lo + hi) / 2;
};
