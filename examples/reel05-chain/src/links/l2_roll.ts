/* Link 2, ROLL: the bead rolls along the blue plinth and down a ladder track whose height follows an ease-in-out curve:
 * it starts slowly, is fastest in the steep middle and settles at the foot, then runs on the floor to the first domino. */
import * as THREE from 'three';
import {Ev, GF, PAL, Track, V3, smooth, solve} from '../base';
import {M, Path3, beadMat, box, rod, sphere, rbox} from '../mk';
import {BEAD_LIFT, RAIL_Y, RB, Tick} from './l1_tick';
import type {Link} from './types';

const X1 = 6.8; // where the ramp starts (edge of the plinth)
const LX = 16; // horizontal length of the ramp
const DROP = RAIL_Y - 0.12;
const ZA = 3.4; // sideways swing of the ramp
const X_START = 0;
const RAIL_HALF = 0.45;
const RAIL_R = 0.12;
const FLOOR_R = RB;

const smoother = (t: number) => smooth(t);
const railBase = (x: number) => (x <= X1 ? RAIL_Y : RAIL_Y - DROP * smoother((x - X1) / LX));
const railZ = (x: number) => (x <= X1 ? 0 : ZA * Math.sin(Math.PI * Math.min(1, (x - X1) / LX)) ** 2);
const XE = X1 + LX;
const centreY = (x: number) => {
	if (x <= XE) return railBase(x) + BEAD_LIFT;
	const t = smooth((x - XE) / 1.6);
	return (0.12 + BEAD_LIFT) * (1 - t) + FLOOR_R * t;
};

export class Roll implements Link {
	name = 'roll';
	label = 'ROLL';
	f0: number;
	f1: number;
	events: Ev[] = [];
	path!: Path3;
	flat = 0;
	hitS = 0;
	vHit = 0;
	hitPos: V3 = [0, 0, 0];
	hitDir: V3 = [1, 0, 0];
	private trk!: Track<[number, number, number, number, number, number, number, number]>; // s, x,y,z, qx,qy,qz,qw
	private beadM!: THREE.Mesh;
	private speeds: number[] = [];

	constructor(private tick: Tick, fArrive: number) {
		this.f0 = tick.fHit;
		this.f1 = fArrive;
		const v0 = tick.vBead;
		const sim = (flat: number) => this.simulate(v0, flat);
		// choose the length of the floor run so that the bead touches the first domino on fArrive
		this.flat = solve((fl) => sim(fl).tHit, fArrive - this.f0, 0.5, 40);
		const r = sim(this.flat);
		this.trk = r.trk;
		this.hitS = r.sHit;
		this.vHit = r.vHit;
		this.speeds = r.speeds;
		this.hitPos = this.path.at(this.hitS);
		this.hitDir = this.path.tangent(this.hitS - 0.5);
		this.events.push({f: this.f0, kind: 'roll', frames: Math.round(fArrive - this.f0), speed: this.speeds});
	}

	private simulate(v0: number, flat: number) {
		const xEnd = XE + 1.6 + flat;
		this.path = new Path3((u) => {
			const x = X_START + (xEnd - X_START) * u;
			return [x, centreY(x), railZ(x)];
		}, 900);
		const path = this.path;
		const y0 = path.at(0)[1];
		const afr = 0.0004;
		let s = 0;
		let t = 0; // frames after the tick
		const dt = 0.25;
		const rows: [number, number, number, number, number, number, number, number][] = [];
		const speeds: number[] = [];
		// orientation quaternion of the bead (rolling without slipping)
		const q = new THREE.Quaternion();
		const sHit = path.len;
		let vHit = 0;
		let v = v0;
		let lastFrame = -1;
		while (s < sHit && t < 900) {
			const p = path.at(s);
			const T = path.tangent(s);
			v = Math.sqrt(Math.max(0.0004, v0 * v0 + (10 / 7) * GF * (y0 - p[1]) - 2 * afr * s));
			rows.push([s, p[0], p[1], p[2], q.x, q.y, q.z, q.w]);
			if (Math.floor(t) !== lastFrame) {
				speeds.push(v);
				lastFrame = Math.floor(t);
			}
			const ds = v * dt;
			// roll: angular velocity = N x v / r, N = up
			const ax = new THREE.Vector3(0, 1, 0).cross(new THREE.Vector3(T[0], T[1], T[2])).normalize();
			const dq = new THREE.Quaternion().setFromAxisAngle(ax, ds / RB);
			q.premultiply(dq);
			s += ds;
			t += dt;
		}
		vHit = v;
		const p = path.at(Math.min(s, sHit));
		rows.push([sHit, p[0], p[1], p[2], q.x, q.y, q.z, q.w]);
		// a small rebound and rest after the hit
		let tt = 0;
		let sr = sHit;
		let vr = -0.05 * vHit;
		while (tt < 40) {
			sr += vr * dt;
			vr *= 0.93;
			t += dt;
			tt += dt;
			const pp = path.at(sr);
			const T = path.tangent(sr);
			const ax = new THREE.Vector3(0, 1, 0).cross(new THREE.Vector3(T[0], T[1], T[2])).normalize();
			q.premultiply(new THREE.Quaternion().setFromAxisAngle(ax, (vr * dt) / RB));
			rows.push([sr, pp[0], pp[1], pp[2], q.x, q.y, q.z, q.w]);
		}
		return {trk: new Track(this.f0, dt, rows), tHit: (rows.findIndex((r) => r[0] >= sHit - 1e-6) * dt), sHit, vHit, speeds};
	}

	build(scene: THREE.Scene) {
		const g = new THREE.Group();
		// rails
		const xs: number[] = [];
		for (let x = -1.8; x <= XE + 0.8; x += 0.25) xs.push(x);
		const railPts = (side: number) =>
			xs.map((x) => {
				const dx = 0.05;
				const a: V3 = [x - dx, railBase(x - dx), railZ(x - dx)];
				const b: V3 = [x + dx, railBase(x + dx), railZ(x + dx)];
				const T = new THREE.Vector3(b[0] - a[0], 0, b[2] - a[2]).normalize();
				const lat = new THREE.Vector3(0, 1, 0).cross(T).normalize();
				return new THREE.Vector3(x + lat.x * RAIL_HALF * side, railBase(x), railZ(x) + lat.z * RAIL_HALF * side);
			});
		for (const side of [-1, 1]) {
			const curve = new THREE.CatmullRomCurve3(railPts(side));
			const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 400, RAIL_R, 10, false), M.matte(PAL.ink, 0.35));
			tube.castShadow = true;
			tube.receiveShadow = true;
			g.add(tube);
		}
		// ties and legs
		const up = new THREE.Vector3(0, 1, 0);
		for (let x = -1.2; x <= XE + 0.4; x += 1.15) {
			const y = railBase(x), z = railZ(x);
			const dx = 0.05;
			const T = new THREE.Vector3(dx * 2, railBase(x + dx) - railBase(x - dx), railZ(x + dx) - railZ(x - dx)).normalize();
			const lat = new THREE.Vector3(0, 1, 0).cross(new THREE.Vector3(T.x, 0, T.z)).normalize();
			const nrm = new THREE.Vector3().crossVectors(lat, T).normalize();
			const m = new THREE.Matrix4().makeBasis(T, nrm, lat);
			const tie = box(0.3, 0.14, RAIL_HALF * 2 + 0.5, M.matte(PAL.paper, 0.6));
			tie.quaternion.setFromRotationMatrix(m);
			tie.position.set(x, y - 0.13, z);
			g.add(tie);
			void up;
		}
		for (let x = X1 + 1.5; x <= XE - 0.5; x += 3.2) {
			const y = railBase(x), z = railZ(x);
			const h = y - 0.2;
			if (h < 0.6) continue;
			const leg = box(0.26, h, 0.26, M.matte(PAL.ink, 0.45));
			leg.position.set(x, h / 2, z);
			g.add(leg);
			const foot = box(1.2, 0.18, 1.2, M.matte(PAL.ink, 0.45));
			foot.position.set(x, 0.09, z);
			g.add(foot);
		}
		void rod;
		void rbox;
		// bead
		this.beadM = sphere(RB, beadMat(PAL.coral, PAL.paper), 64);
		g.add(this.beadM);
		scene.add(g);
	}

	pose(f: number) {
		const r = this.trk.at(f);
		this.beadM.position.set(r[1], r[2], r[3]);
		this.beadM.quaternion.set(r[4], r[5], r[6], r[7]);
	}

	beadAt(f: number): V3 {
		const r = this.trk.at(f);
		return [r[1], r[2], r[3]];
	}

	focus(f: number): V3 {
		return this.beadAt(f);
	}
}
