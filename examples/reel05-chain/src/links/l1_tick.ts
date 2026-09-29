/* Link 1, TICK: a pendulum is let go, and its bob taps the coral bead resting on a blue plinth. */
import * as THREE from 'three';
import {BEAT, Ev, GF, V3, PAL, clamp} from '../base';
import {M, box, cyl, rbox, rod, sphere} from '../mk';
import type {Link} from './types';

export const PLINTH_TOP = 6;
export const RAIL_Y = PLINTH_TOP + 0.12; // axis of the rails lying on the plinth
export const RB = 0.6; // bead radius
export const BEAD_LIFT = 0.56; // bead centre above the rail axis
export const BEAD_Y = RAIL_Y + BEAD_LIFT;

export class Tick implements Link {
	name = 'tick';
	label = 'TICK';
	f0 = 0;
	f1: number;
	events: Ev[] = [];
	L = 9;
	th0 = (-16 * Math.PI) / 180;
	rob = 0.45;
	pivot: V3;
	fRelease: number;
	fHit: number;
	vBob: number; // bob speed at contact, units per frame
	vBead: number; // bead speed after contact
	private samples: number[] = []; // theta per 1/4 frame from fRelease
	private thAt: (f: number) => number;
	private bob!: THREE.Mesh;
	private rodM!: THREE.Mesh;
	private pinM!: THREE.Mesh;
	private grp!: THREE.Group;

	constructor(fHit: number) {
		this.fHit = fHit;
		this.f1 = fHit;
		this.pivot = [-(RB + this.rob), BEAD_Y + this.L, 0];
		// quarter period for this length and amplitude, by integration (frames)
		const k = GF / this.L;
		const step = (th: number, w: number, dt: number): [number, number] => {
			const acc = (t: number) => -k * Math.sin(t);
			// RK4 on (th, w)
			const k1t = w, k1w = acc(th);
			const k2t = w + 0.5 * dt * k1w, k2w = acc(th + 0.5 * dt * k1t);
			const k3t = w + 0.5 * dt * k2w, k3w = acc(th + 0.5 * dt * k2t);
			const k4t = w + dt * k3w, k4w = acc(th + dt * k3t);
			return [th + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t), w + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w)];
		};
		let th = this.th0;
		let w = 0;
		let t = 0;
		const dt = 0.05;
		let prev = th;
		while (th < 0) {
			prev = th;
			[th, w] = step(th, w, dt);
			t += dt;
		}
		const tq = t - (dt * th) / (th - prev); // time of the crossing, refined
		this.fRelease = fHit - tq;
		this.vBob = this.L * w;
		this.vBead = 1.5 * this.vBob;
		// sample the swing: before release held, until impact free, after impact damped
		const dt2 = 0.25;
		let th2 = this.th0, w2 = 0;
		const n = Math.ceil((fHit + 600 - this.fRelease) / dt2);
		let hit = false;
		let tt = this.fRelease;
		for (let i = 0; i < n; i++) {
			this.samples.push(th2);
			const before = th2;
			const sub = 5;
			for (let s = 0; s < sub; s++) {
				const c = hit ? 0.0035 : 0;
				const acc = (t_: number, w_: number) => -k * Math.sin(t_) - c * w_;
				const h = dt2 / sub;
				const k1t = w2, k1w = acc(th2, w2);
				const k2t = w2 + 0.5 * h * k1w, k2w = acc(th2 + 0.5 * h * k1t, k2t);
				const k3t = w2 + 0.5 * h * k2w, k3w = acc(th2 + 0.5 * h * k2t, k3t);
				const k4t = w2 + h * k3w, k4w = acc(th2 + h * k3t, k4t);
				th2 += (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
				w2 += (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
			}
			tt += dt2;
			if (!hit && before < 0 && th2 >= 0) {
				hit = true;
				w2 *= 0.5; // the bob gives most of its speed to the bead
			}
		}
		const f0 = this.fRelease;
		const th0 = this.th0;
		this.thAt = (f: number) => {
			if (f <= f0) return th0;
			const x = (f - f0) / dt2;
			const i = Math.min(this.samples.length - 2, Math.floor(x));
			const u = x - i;
			return this.samples[i] * (1 - u) + this.samples[i + 1] * u;
		};
		this.events.push({f: this.fRelease - 10, kind: 'pin', gain: 0.9});
		this.events.push({f: this.fRelease, kind: 'swing', frames: Math.round(fHit - this.fRelease), speed: this.speedCurve()});
		this.events.push({f: fHit, kind: 'tock', v: this.vBead});
	}

	speedCurve() {
		const out: number[] = [];
		for (let f = Math.floor(this.fRelease); f <= this.fHit; f++) {
			const a = this.thAt(f - 0.5), b = this.thAt(f + 0.5);
			out.push(Math.abs(b - a) * this.L);
		}
		return out;
	}

	bobPos(f: number): V3 {
		const th = this.thAt(f);
		return [this.pivot[0] + this.L * Math.sin(th), this.pivot[1] - this.L * Math.cos(th), 0];
	}

	build(scene: THREE.Scene) {
		const g = (this.grp = new THREE.Group());
		// plinth
		const plinth = rbox(16.6, PLINTH_TOP, 7, 0.3, M.matte(PAL.blue, 0.5));
		plinth.position.set(-1.5, PLINTH_TOP / 2, 0);
		g.add(plinth);
		// gantry: a post behind and an arm carrying the pivot
		const px = this.pivot[0], py = this.pivot[1];
		const post = box(0.55, py + 0.8, 0.55, M.matte(PAL.ink, 0.45));
		post.position.set(px, (py + 0.8) / 2, -3.2);
		g.add(post);
		const foot = box(3, 0.4, 3, M.matte(PAL.ink, 0.45));
		foot.position.set(px, 0.2, -3.2);
		g.add(foot);
		const arm = box(0.45, 0.45, 3.6, M.matte(PAL.ink, 0.45));
		arm.position.set(px, py + 0.25, -1.4);
		g.add(arm);
		const pin = cyl(0.2, 0.2, 0.9, M.metal('#b8bcc6', 0.25));
		pin.rotation.x = Math.PI / 2;
		pin.position.set(px, py, 0);
		g.add(pin);
		this.pinM = pin;
		// rod and bob
		const rodM = rod([0, 0, 0], [0, -this.L, 0], 0.07, M.metal('#b8bcc6', 0.3));
		this.rodM = rodM;
		const bob = sphere(this.rob, M.metal('#2a2930', 0.22), 40);
		this.bob = bob;
		g.add(rodM, bob);
		scene.add(g);
	}

	pose(f: number) {
		const th = this.thAt(f);
		const [px, py] = this.pivot;
		this.rodM.position.set(px + (this.L / 2) * Math.sin(th), py - (this.L / 2) * Math.cos(th), 0);
		this.rodM.rotation.set(0, 0, th);
		const b = this.bobPos(f);
		this.bob.position.set(b[0], b[1], b[2]);
	}

	focus(f: number): V3 {
		return [0, BEAD_Y, 0];
	}
}

void clamp;
void BEAT;
