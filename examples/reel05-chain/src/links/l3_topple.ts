/* Link 3, TOPPLE: the bead strikes the first domino; a wave of 34 growing dominoes runs along an S-shaped path.
 * The wave, its speed and every contact come from the rigid-body simulation in sim/dominoes.ts. */
import * as THREE from 'three';
import {BEAT, Ev, PAL, V3, clamp} from '../base';
import {M, Path3, box, rbox} from '../mk';
import {DominoSim, phiAt, simulateDominoes} from '../sim/dominoes';
import {Roll} from './l2_roll';
import type {Link} from './types';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const DOM = {N: 24, h0: 2.6, growth: 1.06, ratio: 0.3, kick: 0.05, friction: 0.01};
const COLS = [PAL.ink, PAL.blue, PAL.yellow, PAL.coral];
const PIP: Record<number, [number, number][]> = {
	0: [],
	1: [[0, 0]],
	2: [[-1, -1], [1, 1]],
	3: [[-1, -1], [0, 0], [1, 1]],
	4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
	5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
	6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

export class Topple implements Link {
	name = 'topple';
	label = 'TOPPLE';
	f0: number;
	f1 = 0;
	events: Ev[] = [];
	sim: DominoSim;
	path: Path3;
	base: V3; // start of the row (centre of the first domino at ground level)
	dir: V3;
	private pivots: V3[] = [];
	private yaws: number[] = [];
	private groups: THREE.Group[] = [];
	fCross: number[] = [];
	/** frame at which the last domino's top has swung to angle phiC */
	phiC = 0.77; // angle at which the last, giant domino meets the see-saw
	endPos: V3 = [0, 0, 0];
	endDir: V3 = [1, 0, 0];
	hLast = 0;
	pLast = 0;
	fLast = 0;
	vLast = 0;

	constructor(roll: Roll) {
		this.f0 = roll.f1;
		const hit = roll.hitPos;
		const dirv = roll.hitDir;
		// the first domino stands right behind... in front of the bead
		const t0 = DOM.h0 * 0.17;
		const startS = 0;
		void startS;
		const yaw0 = Math.atan2(-dirv[2], dirv[0]);
		void yaw0;
		this.dir = [dirv[0], 0, dirv[2]];
		const b0: V3 = [hit[0] + dirv[0] * (0.6 + t0 / 2), 0, hit[2] + dirv[2] * (0.6 + t0 / 2)];
		this.base = b0;
		// the S path in the plane
		const total = 90;
		const Z = 7;
		const X = 58;
		const fn = (u: number): V3 => {
			const env = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, u * 4));
			return [b0[0] + X * u, 0, b0[2] + Z * Math.sin(2 * Math.PI * u * 1.05) * env];
		};
		void total;
		this.path = new Path3(fn, 1500);
		this.sim = simulateDominoes({N: DOM.N, h0: DOM.h0, growth: DOM.growth, ratio: DOM.ratio, tStart: this.f0, kick: DOM.kick * 1, friction: DOM.friction});
		const sim = this.sim;
		for (let i = 0; i < sim.N; i++) {
			const sp = sim.s[i] + sim.t[i] / 2;
			this.pivots.push(this.path.at(sp));
			const T = this.path.tangent(sp);
			this.yaws.push(Math.atan2(-T[2], T[0]));
		}
		this.hLast = sim.h[sim.N - 1];
		this.pLast = sim.s[sim.N - 1] + sim.t[sim.N - 1] / 2;
		const eT = this.path.tangent(this.pLast);
		this.endDir = [eT[0], 0, eT[2]];
		this.endPos = this.path.at(this.pLast);
		// the bead meets the first domino: the first big hit of the film
		this.events.push({f: this.f0, kind: 'bead_hit', v: roll.vHit});
		// contact events
		for (const c of sim.contacts) {
			this.events.push({f: c.f, kind: 'clack', i: c.i, v: c.v});
			this.fCross.push(c.f);
		}
		// the last domino reaches phiC: time by scanning the sampled angles
		let fc = sim.fEnd;
		for (let f = sim.f0; f < sim.fEnd; f += 0.25) {
			if (phiAt(sim, sim.N - 1, f) >= this.phiC) {
				fc = f;
				break;
			}
		}
		this.fLast = fc;
		this.vLast = (phiAt(sim, sim.N - 1, fc + 0.5) - phiAt(sim, sim.N - 1, fc - 0.5)) * this.hLast * Math.cos(this.phiC);
		this.f1 = fc;
	}

	/** float index of the wave head at frame f */
	head(f: number) {
		const c = this.fCross;
		if (f < this.f0) return 0;
		if (f < c[0]) return (f - this.f0) / Math.max(1, c[0] - this.f0);
		for (let i = 0; i < c.length - 1; i++) {
			if (f < c[i + 1]) return i + 1 + (f - c[i]) / (c[i + 1] - c[i]);
		}
		return c.length + Math.min(1, (f - c[c.length - 1]) / 12);
	}

	build(scene: THREE.Scene) {
		const sim = this.sim;
		const pipMat = M.matte('#F2EEE6', 0.55);
		for (let i = 0; i < sim.N; i++) {
			const h = sim.h[i], t = sim.t[i], w = sim.w[i];
			const g = new THREE.Group();
			const body = rbox(t, h, w, Math.min(0.09, t * 0.35), M.matte(COLS[Math.floor(i / 2) % 4], 0.5));
			body.position.set(-t / 2, h / 2, 0);
			g.add(body);
			// pips on both wide faces and a divider line
			const geos: THREE.BufferGeometry[] = [];
			const rp = h * 0.055;
			const upV = (i * 3 + 1) % 7, dnV = (i * 5 + 2) % 7;
			for (const face of [1, -1]) {
				const x = -t / 2 + face * (t / 2 + 0.012);
				const line = new THREE.BoxGeometry(0.02, h * 0.02, w * 0.9);
				line.translate(x, h / 2, 0);
				geos.push(line);
				for (const [half, val] of [[1, upV], [-1, dnV]] as [number, number][]) {
					for (const [px, py] of PIP[Math.min(6, val)]) {
						const c = new THREE.CylinderGeometry(rp, rp, 0.02, 14);
						c.rotateZ(Math.PI / 2);
						c.translate(x, h / 2 + half * (h * 0.25) + py * h * 0.09, px * w * 0.27);
						geos.push(c);
					}
				}
			}
			const pips = new THREE.Mesh(mergeGeometries(geos)!, pipMat);
			pips.castShadow = false;
			pips.receiveShadow = true;
			g.add(pips);
			const P = this.pivots[i];
			g.position.set(P[0], 0, P[2]);
			g.rotation.y = this.yaws[i];
			scene.add(g);
			this.groups.push(g);
		}
		void box;
	}

	/** after the last domino has met the see-saw, its angle follows the striker end: set by Launch */
	lastPhi: ((f: number) => number | null) | null = null;

	pose(f: number) {
		for (let i = 0; i < this.sim.N; i++) {
			let phi = phiAt(this.sim, i, f);
			if (i === this.sim.N - 1 && this.lastPhi && f > this.fLast) {
				const o = this.lastPhi(f);
				if (o !== null) phi = o;
			}
			this.groups[i].children.forEach((c) => c);
			this.groups[i].rotation.set(0, this.yaws[i], -phi, 'YXZ');
		}
	}

	focus(f: number): V3 {
		const idx = clamp(this.head(f), 0, this.sim.N - 1);
		const i = Math.floor(idx);
		const s = this.sim.s[i] + (this.sim.s[Math.min(this.sim.N - 1, i + 1)] - this.sim.s[i]) * (idx - i);
		const p = this.path.at(s);
		return [p[0], this.sim.h[i] * 0.4, p[2]];
	}
}

void BEAT;
