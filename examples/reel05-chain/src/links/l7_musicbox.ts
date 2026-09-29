/* Link 7, PLAY: the wire lifts the brake of a big music box. A brass drum turns at constant speed and its pins pluck the teeth of a
 * comb, one note per eighth: the machine plays the film's tune, every pin on the beat grid. The last pin plucks a longer coral tooth
 * and a pulse of light runs along a cable to the gate of the last link. */
import * as THREE from 'three';
import {BEAT, Ev, PAL, V3, clamp, smooth} from '../base';
import {M, box, cyl, rbox, shadowed, sphere, unitRod, setRod} from '../mk';
import type {Gears} from './l6_gears';
import type {Link} from './types';

// G dorian tune, one slot per eighth note (15 frames at 120 BPM). null is a rest.
export const TUNE: (number | null)[] = [
	67, null, 70, 74, 79, null, 77, 74, //  Gm
	76, null, 79, 84, 79, 76, 74, 72, //  C
	81, null, 77, 72, 77, 81, 84, null, //  F
	82, null, 77, 74, 77, 82, 86, null, //  Bb
];
export const FN0 = 900;
const PIN_R = 0.58;
const RD = 3.3;
const YAXIS = 5.5;

export class MusicBox implements Link {
	name = 'musicbox';
	label = 'PLAY';
	f0: number;
	f1: number;
	events: Ev[] = [];
	fBrake: number;
	fN0: number;
	fLast: number; // the special tooth
	slot = BEAT / 2;
	wc = 0.041;
	brakeX: number;
	xd0: number;
	zc: number;
	pitches: number[] = [];
	notes: {f: number; midi: number; tooth: number; phi0: number}[] = [];
	cablePts: V3[] = [];
	end: V3 = [0, 0, 0]; // right end of the box, where the cable leaves
	private theta: Float32Array;
	private thStep = 0.5;
	private drum!: THREE.Group;
	private teeth: {g: THREE.Group; mat: THREE.MeshStandardMaterial; len: number; k: number}[] = [];
	private brakeM!: THREE.Mesh;
	private beads: THREE.Mesh[] = [];
	private beadMats: THREE.MeshStandardMaterial[] = [];
	private toothX: number[] = [];
	private gears: Gears;
	fPulse: number;

	constructor(gears: Gears) {
		this.gears = gears;
		this.f0 = gears.fTrip;
		this.fBrake = gears.lev.trip + 12;
		this.fN0 = FN0;
		const lp = gears.leverPivot;
		this.brakeX = gears.wireX;
		this.zc = gears.cradle.O[2];
		this.xd0 = this.brakeX + 2.6;
		// the drum angle as a function of time
		const n = 1400;
		this.theta = new Float32Array(n);
		let th = 0;
		for (let i = 0; i < n; i++) {
			const f = this.fBrake + i * this.thStep;
			this.theta[i] = th;
			th += this.wc * smooth((f - this.fBrake) / 22) * this.thStep;
		}
		// teeth: one per distinct pitch, ascending
		this.pitches = [...new Set(TUNE.filter((x): x is number => x !== null))].sort((a, b) => a - b);
		this.toothX = this.pitches.map((_, k) => this.xd0 + 2.0 + k * 1.95);
		const xSpecial = this.xd0 + 2.0 + this.pitches.length * 1.95 + 0.6;
		this.toothX.push(xSpecial);
		let f = this.fN0;
		TUNE.forEach((m, i) => {
			const t = this.fN0 + i * this.slot;
			if (m !== null) {
				const k = this.pitches.indexOf(m);
				const phi0 = 0.24 - this.thetaAt(t);
				this.notes.push({f: t, midi: m, tooth: k, phi0});
				this.events.push({f: t, kind: 'mbox', midi: m, tooth: k});
			}
			f = t;
		});
		this.fLast = this.fN0 + TUNE.length * this.slot;
		this.events.push({f: this.fBrake - 2, kind: 'brake'});
		this.events.push({f: this.fBrake, kind: 'motor', frames: Math.round(this.fLast - this.fBrake + 30), w: this.wc});
		this.events.push({f: this.fLast, kind: 'mbox_last'});
		this.notes.push({f: this.fLast, midi: 43, tooth: this.pitches.length, phi0: 0.24 - this.thetaAt(this.fLast)});
		this.fPulse = this.fLast + 2;
		this.f1 = this.fLast + 12;
		this.end = [xSpecial + 6.5, 0, this.zc];
	}

	toothX2() {
		return this.toothX[this.toothX.length - 1];
	}

	thetaAt(f: number) {
		const x = (f - this.fBrake) / this.thStep;
		if (x <= 0) return 0;
		const i = Math.min(this.theta.length - 2, Math.floor(x));
		const u = x - i;
		return this.theta[i] * (1 - u) + this.theta[i + 1] * u;
	}

	/** vertical lift of the tip of tooth k at frame f */
	toothLift(k: number, f: number) {
		const isSpecial = k === this.pitches.length;
		const A = isSpecial ? 0.55 : 0.3;
		const notes = this.notes.filter((n) => n.tooth === k);
		let lift = 0;
		for (const n of notes) {
			const tau = f - n.f;
			if (tau < -6) continue;
			if (tau < 0) {
				lift = Math.max(lift, A * smooth((tau + 6) / 6));
			} else {
				const P = isSpecial ? 15 : 11 - (k / this.pitches.length) * 5;
				lift = Math.max(lift, Math.abs(A * Math.exp(-tau / (isSpecial ? 34 : 22)) * Math.cos((2 * Math.PI * tau) / P)) * Math.sign(Math.cos((2 * Math.PI * tau) / P)));
			}
		}
		return lift;
	}

	toothFlash(k: number, f: number) {
		let fl = 0;
		for (const n of this.notes) if (n.tooth === k && f >= n.f) fl = Math.max(fl, Math.exp(-(f - n.f) / 9));
		return fl;
	}

	build(scene: THREE.Scene) {
		const g = new THREE.Group();
		const ink = M.matte(PAL.ink, 0.42);
		const steel = M.metal('#b8bcc6', 0.3);
		const nT = this.pitches.length + 1;
		const xEnd = this.toothX[nT - 1] + 3.0;
		const bx0 = this.brakeX - 0.4;
		// base
		const base = rbox(xEnd - bx0, 2.0, 15.5, 0.2, M.matte(PAL.blue, 0.5));
		base.position.set((bx0 + xEnd) / 2, 1.0, this.zc + 3.0);
		g.add(base);
		// drum
		const dg = (this.drum = new THREE.Group());
		dg.position.set(0, YAXIS, this.zc);
		const dl = xEnd - 2.2 - this.xd0;
		const drum = cyl(RD, RD, dl, M.metal('#e0b13c', 0.27), 64);
		drum.rotation.z = Math.PI / 2;
		drum.position.set(this.xd0 + dl / 2, 0, 0);
		dg.add(drum);
		// painted bands on the drum
		for (let k = 0; k < 4; k++) {
			const band = cyl(RD + 0.03, RD + 0.03, 0.35, M.matte(PAL.ink, 0.4), 64);
			band.rotation.z = Math.PI / 2;
			band.position.set(this.xd0 + 0.7 + k * (dl - 1.4) / 3, 0, 0);
			dg.add(band);
		}
		// pins
		const pinMat = M.metal('#f4f0e8', 0.25);
		for (const n of this.notes) {
			const x = this.toothX[n.tooth];
			const a = n.phi0;
			const A: V3 = [x, RD * Math.sin(a), RD * Math.cos(a)];
			const B: V3 = [x, (RD + PIN_R) * Math.sin(a), (RD + PIN_R) * Math.cos(a)];
			const pin = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1, 10), pinMat), true, false);
			setRod(pin, A, B);
			dg.add(pin);
		}
		g.add(dg);
		// end brackets and caps
		for (const x of [this.xd0 - 0.3, xEnd - 2.2 + 0.3]) {
			const cap = cyl(RD + 0.15, RD + 0.15, 0.5, ink, 48);
			cap.rotation.z = Math.PI / 2;
			cap.position.set(x, YAXIS, this.zc);
			g.add(cap);
			const br = box(0.8, YAXIS - 1.0, 4.2, ink);
			br.position.set(x + (x < this.xd0 + 1 ? -0.5 : 0.5), 2.0 + (YAXIS - 2.0) / 2, this.zc);
			g.add(br);
		}
		// comb: teeth along z, tips at the front of the drum
		const zTip = this.zc + RD + 0.2;
		for (let k = 0; k < nT; k++) {
			const special = k === nT - 1;
			const len = special ? 9.0 : 6.6 - 0.36 * k;
			const zRoot = zTip + len;
			const tg = new THREE.Group();
			tg.position.set(this.toothX[k], YAXIS, zRoot);
			const mat = new THREE.MeshStandardMaterial({color: special ? PAL.coral : '#dfe2e8', metalness: special ? 0.2 : 0.9, roughness: 0.28, emissive: new THREE.Color(PAL.coral), emissiveIntensity: 0});
			const tooth = shadowed(new THREE.Mesh(new THREE.BoxGeometry(special ? 1.5 : 1.05, special ? 0.3 : 0.16, len), mat));
			tooth.position.set(0, 0, -len / 2);
			tg.add(tooth);
			const root = box(special ? 2.0 : 1.5, 1.3, 0.9, M.matte(PAL.ink, 0.42));
			root.position.set(0, -0.5, 0.35);
			tg.add(root);
			g.add(tg);
			this.teeth.push({g: tg, mat, len, k});
		}
		const rail = box(xEnd - bx0 - 1.0, 1.3, 2.6, M.matte(PAL.ink, 0.42));
		rail.position.set((bx0 + xEnd) / 2, 2.5, zTip + 9.3 + 1.0);
		g.add(rail);
		// brake block at the left cap
		const brake = box(1.2, 2.0, 1.2, M.matte(PAL.paper, 0.6));
		this.brakeM = brake;
		g.add(brake);
		// wire's lower end is set on the gear link; keep it at the brake
		this.gears.wireBottom = [this.brakeX, 4.4, this.zc + RD - 0.2 + 0.0];
		this.gears.leverPivot[2] = this.gears.leverPivot[2];
		// cable from the special tooth to the right: pulse of light beads (built by the last link, here only the endpoint marker)
		scene.add(g);
	}

	pose(f: number) {
		this.drum.rotation.x = -this.thetaAt(f);
		this.teeth.forEach((t) => {
			const lift = this.toothLift(t.k, f);
			t.g.rotation.x = lift / t.len;
			t.mat.emissiveIntensity = this.toothFlash(t.k, f) * (t.k === this.pitches.length ? 2.2 : 1.1);
		});
		const lift = this.gears.wireOffset(f);
		this.brakeM.position.set(this.brakeX, 3.4 + lift, this.zc + RD - 0.2);
	}

	focus(f: number): V3 {
		// the tooth being played
		let best = this.notes[0];
		for (const n of this.notes) if (n.f <= f + 4) best = n;
		return [this.toothX[best.tooth], YAXIS, this.zc + RD + 1.5];
	}
}

void clamp;
void sphere;
void unitRod;
