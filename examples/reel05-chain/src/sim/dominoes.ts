/* A row of dominoes as coupled rotating slabs.
 * Each domino i pivots about its front-bottom edge by phi_i (0 = standing, pi/2 = lying). Its top-front corner meets the back face of
 * domino i+1: a contact constraint (perfectly inelastic impulse plus positional correction) pushes i+1 over. The wave, its speed and
 * every contact time come out of the simulation; nothing is keyframed. Units: world units and frames. */
import {GF} from '../base';

export type DominoOpts = {
	N: number;
	h0: number; // height of the first domino
	growth: number; // height multiplier per domino
	ratio: number; // gap between faces / height
	tStart: number; // frame at which the first domino is struck
	kick: number; // initial angular velocity of the first domino (rad per frame)
	friction?: number; // Coulomb friction torque as a fraction of m g h (dissipation that makes the wave settle to a steady speed)
	restitution?: number;
};

export type DominoSim = {
	N: number;
	h: number[];
	t: number[];
	w: number[];
	s: number[]; // arclength of the centre of every domino along the path
	f0: number;
	step: number; // frames per sample
	phi: Float32Array[]; // per domino, sampled every `step` frames
	contacts: {i: number; f: number; v: number}[]; // domino i touches domino i+1 (last one: never)
	floor: {i: number; f: number; v: number}[]; // domino i reaches the ground
	fEnd: number;
};

export const simulateDominoes = (o: DominoOpts): DominoSim => {
	const N = o.N;
	const h: number[] = [], t: number[] = [], w: number[] = [], s: number[] = [];
	for (let i = 0; i < N; i++) {
		h.push(o.h0 * Math.pow(o.growth, i));
		t.push(h[i] * 0.17);
		w.push(h[i] * 0.62);
	}
	s.push(0);
	for (let i = 0; i < N - 1; i++) s.push(s[i] + o.ratio * h[i] + (t[i] + t[i + 1]) / 2);
	// mass ~ h * t * w ; pivot inertia of a slab about its bottom edge: m (h^2 + t^2) / 3
	const mass = h.map((x, i) => x * t[i] * w[i]);
	const I = h.map((x, i) => (mass[i] * (x * x + t[i] * t[i])) / 3);
	const p = s.map((x, i) => x + t[i] / 2); // pivot position (front-bottom edge)

	const phi = new Array(N).fill(0);
	const om = new Array(N).fill(0);
	om[0] = o.kick;
	phi[0] = 0.0005;
	const dt = 0.02; // frames per substep
	const sampleEvery = 0.25;
	const out: number[][] = Array.from({length: N}, () => []);
	const contacts: {i: number; f: number; v: number}[] = [];
	const floor: {i: number; f: number; v: number}[] = [];
	const touched = new Array(N).fill(false);
	const grounded = new Array(N).fill(false);
	const FLAT = Math.PI / 2;

	// d > 0 : the top-front corner of i is in front of... free; d < 0 : penetrating domino i+1
	const dist = (i: number, a: number, b: number) => {
		const cx = p[i] + h[i] * Math.sin(a);
		const cy = h[i] * Math.cos(a);
		const q0x = p[i + 1] - t[i + 1] * Math.cos(b);
		const q0y = t[i + 1] * Math.sin(b);
		return (cx - q0x) * -Math.cos(b) + (cy - q0y) * Math.sin(b);
	};
	const ddA = (i: number, a: number, b: number) => (h[i] * Math.cos(a)) * -Math.cos(b) + (-h[i] * Math.sin(a)) * Math.sin(b);
	const ddB = (i: number, a: number, b: number) => {
		const cx = p[i] + h[i] * Math.sin(a);
		const cy = h[i] * Math.cos(a);
		const q0x = p[i + 1] - t[i + 1] * Math.cos(b);
		const q0y = t[i + 1] * Math.sin(b);
		const dq0x = t[i + 1] * Math.sin(b);
		const dq0y = t[i + 1] * Math.cos(b);
		const rx = cx - q0x, ry = cy - q0y;
		return -dq0x * -Math.cos(b) + rx * Math.sin(b) + -dq0y * Math.sin(b) + ry * Math.cos(b);
	};

	let f = o.tStart;
	const tEndMax = o.tStart + 900;
	let nextSample = f;
	let quiet = 0;
	while (f < tEndMax) {
		if (f >= nextSample - 1e-9) {
			for (let i = 0; i < N; i++) out[i].push(phi[i]);
			nextSample += sampleEvery;
		}
		// 1. velocities from gravity and friction
		for (let i = 0; i < N; i++) {
			if (grounded[i]) continue;
			const a = phi[i];
			const acom = (h[i] / 2) * Math.sin(a) - (t[i] / 2) * Math.cos(a);
			let alpha = (3 * GF * acom) / (h[i] * h[i] + t[i] * t[i]);
			if (om[i] > 0) alpha -= (3 * GF * (o.friction ?? 0) * h[i]) / (h[i] * h[i] + t[i] * t[i]);
			om[i] += alpha * dt;
			if (phi[i] <= 0 && om[i] < 0) om[i] = 0;
		}
		// 2. contacts by sequential impulses (with a little positional bias)
		const acc = new Array(N).fill(0);
		const pre = new Array(N).fill(0);
		for (let i = 0; i < N - 1; i++) {
			const d = dist(i, phi[i], phi[i + 1]);
			if (d < 0.004) {
				pre[i] = ddA(i, phi[i], phi[i + 1]) * om[i] + ddB(i, phi[i], phi[i + 1]) * om[i + 1];
				if (!touched[i]) {
					touched[i] = true;
					contacts.push({i, f, v: Math.abs(pre[i])});
				}
			}
		}
		for (let iter = 0; iter < 8; iter++) {
			for (let i = N - 2; i >= 0; i--) {
				const d = dist(i, phi[i], phi[i + 1]);
				if (d >= 0.004) continue;
				const A = ddA(i, phi[i], phi[i + 1]);
				const B = ddB(i, phi[i], phi[i + 1]);
				const rel = A * om[i] + B * om[i + 1];
				const bias = d < 0 ? (-0.25 * d) / dt : 0;
				const restitution = pre[i] < -0.004 ? -(o.restitution ?? 0.05) * pre[i] : 0;
				const den = (A * A) / I[i] + (B * B) / I[i + 1];
				let lam = -(rel - Math.max(bias, restitution)) / den;
				const old = acc[i];
				acc[i] = Math.max(0, old + lam);
				lam = acc[i] - old;
				om[i] += (lam * A) / I[i];
				om[i + 1] += (lam * B) / I[i + 1];
			}
		}
		// 3. positions and the floor
		for (let i = 0; i < N; i++) {
			if (grounded[i]) continue;
			phi[i] += om[i] * dt;
			if (phi[i] < 0) {
				phi[i] = 0;
				om[i] = Math.max(0, om[i]);
			}
			if (phi[i] >= FLAT) {
				floor.push({i, f, v: om[i] * h[i]});
				phi[i] = FLAT;
				om[i] = 0;
				grounded[i] = true;
			}
		}
		f += dt;
		const moving = om.some((x, i) => !grounded[i] && Math.abs(x) > 1e-5 && phi[i] > 0.02);
		quiet = moving ? 0 : quiet + dt;
		if (quiet > 30) break;
	}
	const phiArr = out.map((a) => Float32Array.from(a));
	return {N, h, t, w, s, f0: o.tStart, step: sampleEvery, phi: phiArr, contacts, floor, fEnd: f};
};

export const phiAt = (sim: DominoSim, i: number, f: number) => {
	const x = (f - sim.f0) / sim.step;
	const a = sim.phi[i];
	if (x <= 0) return a[0];
	if (x >= a.length - 1) return a[a.length - 1];
	const k = Math.floor(x);
	const u = x - k;
	return a[k] * (1 - u) + a[k + 1] * u;
};
