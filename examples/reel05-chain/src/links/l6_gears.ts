/* Link 6, TURN: the last cradle ball strikes a paddle on the rim of the first gear. Four gears on an ink wall carry the turn upward and
 * the small ones spin fast. A peg on the last gear presses a lever; the lever pulls a wire that lifts the brake of the music box. */
import * as THREE from 'three';
import {Ev, PAL, V3, clamp, smooth} from '../base';
import {M, box, cyl, rbox, setRod, shadowed, unitRod} from '../mk';
import type {Cradle} from './l5_cradle';
import type {Link} from './types';

const ARM_TIP = 7.0; // pivot to the tip (the tip lies in the path of the peg)
const ARM_SHORT = 3.5; // pivot to the wire end
const ARM_TH = 0.55;
const R_PEG = 0.3;

type G = {R: number; N: number; col: string; c: V3; ph: number; hole: number};

const gearShape = (R: number, N: number, holes: number, hubHole: number) => {
	const s = new THREE.Shape();
	const p = (2 * Math.PI) / N;
	const rr = R - 0.62;
	for (let i = 0; i < N; i++) {
		const a = i * p;
		const pts: [number, number][] = [
			[rr, -0.30 * p],
			[R, -0.15 * p],
			[R, 0.15 * p],
			[rr, 0.30 * p],
		];
		pts.forEach(([r, da], k) => {
			const x = Math.cos(a + da) * r, y = Math.sin(a + da) * r;
			if (i === 0 && k === 0) s.moveTo(x, y);
			else s.lineTo(x, y);
		});
	}
	s.closePath();
	const hub = new THREE.Path();
	hub.absarc(0, 0, hubHole, 0, Math.PI * 2, true);
	s.holes.push(hub);
	for (let k = 0; k < holes; k++) {
		const a = (k / holes) * Math.PI * 2 + 0.3;
		const h = new THREE.Path();
		h.absarc(Math.cos(a) * R * 0.56, Math.sin(a) * R * 0.56, R * 0.2, 0, Math.PI * 2, true);
		s.holes.push(h);
	}
	return s;
};

export class Gears implements Link {
	name = 'gears';
	label = 'TURN';
	f0: number;
	f1: number;
	events: Ev[] = [];
	gears: G[] = [];
	fHit: number;
	fTrip: number;
	w0 = 0.042; // peak angular speed of the first gear, rad per frame
	tau = 150;
	base: V3;
	pegAngle0 = 0;
	leverPivot: V3 = [0, 0, 0];
	wireX = 0;
	lev!: {f0: number; step: number; th: Float32Array; trip: number; contact: number};
	private groups: THREE.Group[] = [];
	private paddleG!: THREE.Mesh;
	private lever!: THREE.Group;
	private wire!: THREE.Mesh;
	private pegR = 2.4;
	wireBottom: V3 = [0, 0, 0];
	private wireLift = 0;
	cradle: Cradle;

	constructor(cradle: Cradle, fTrip: number) {
		this.cradle = cradle;
		this.f0 = cradle.f1;
		this.fHit = cradle.f1;
		this.fTrip = fTrip;
		this.f1 = this.fTrip;
		const O = cradle.O;
		const c1: V3 = [O[0] + 8.54, 14.4, O[2]];
		const defs: {R: number; N: number; col: string; angle: number}[] = [
			{R: 5, N: 20, col: PAL.coral, angle: 0},
			{R: 3.5, N: 14, col: PAL.blue, angle: 0.35},
			{R: 2.5, N: 10, col: PAL.yellow, angle: 0.78},
			{R: 5, N: 20, col: PAL.paper, angle: 0.2},
		];
		let c = c1;
		const gs: G[] = [];
		defs.forEach((d, k) => {
			if (k > 0) {
				const prev = gs[k - 1];
				const dist = prev.R + d.R - 0.05;
				c = [prev.c[0] + Math.cos(d.angle) * dist, prev.c[1] + Math.sin(d.angle) * dist, O[2]];
			}
			gs.push({R: d.R, N: d.N, col: d.col, c: [...c] as V3, ph: 0, hole: 5});
		});
		// mesh phases: theta_b = -(Na/Nb) theta_a + phase_b
		gs[0].ph = 0;
		for (let k = 0; k < 3; k++) {
			const a = gs[k], b = gs[k + 1];
			const phi = Math.atan2(b.c[1] - a.c[1], b.c[0] - a.c[0]);
			const phaseA0 = (phi - a.ph) * (a.N / (2 * Math.PI));
			const cc = ((2 * Math.PI) / b.N) * (phaseA0 + ((phi + Math.PI) * b.N) / (2 * Math.PI) - 0.5);
			b.ph = cc; // theta_b = -(Na/Nb) * (theta_a - a.ph...) + cc : handled in angle()
		}
		this.gears = gs;
		this.base = c1;
		// the lever: a long arm pivoting to the right of gear 4, its tip lying under the path of the peg. The peg presses it down by
		// contact (solved every step so they never overlap) and it stays latched; its short end lifts a wire.
		const g4 = gs[3];
		this.leverPivot = [g4.c[0] + 1.6 + ARM_TIP, g4.c[1] + 1.2 - ARM_TH / 2, O[2] + 1.0];
		this.wireX = this.leverPivot[0] + ARM_SHORT;
		this.wireBottom = [this.wireX, 0.6, this.leverPivot[2]];
		// choose the phase of the peg so that the lever passes 0.25 rad exactly on fTrip (scan, then bisect)
		let best = 0, bestErr = 1e9;
		for (let p0 = 0; p0 < 2 * Math.PI; p0 += 0.04) {
			const r = this.levSim(p0);
			if (r.contact < this.fHit + 30) continue; // the peg must not start on the lever
			const e = Math.abs(r.trip - this.fTrip);
			if (e < bestErr) {
				bestErr = e;
				best = p0;
			}
		}
		let lo = best - 0.04, hi = best + 0.04;
		for (let i = 0; i < 24; i++) {
			const m = (lo + hi) / 2;
			if (this.levSim(m).trip > this.fTrip) lo = m;
			else hi = m;
		}
		this.pegAngle0 = (lo + hi) / 2;
		this.lev = this.levSim(this.pegAngle0);
		// events: gear teeth ticks (first and last gear) and the trip
		this.events.push({f: this.fHit, kind: 'paddle_gear', v: cradle.sim.paddle.v});
		const ticks1 = this.tickFrames(0, this.fHit, 240);
		const ticks4 = this.tickFrames(3, this.fHit, 240);
		this.events.push({f: this.fHit, kind: 'gearticks', ticks: ticks1, gain: 1, tone: 0});
		this.events.push({f: this.fHit, kind: 'gearticks', ticks: ticks4, gain: 0.6, tone: 1});
		this.events.push({f: this.lev.contact, kind: 'lever'});
	}

	/** angle of gear k at frame f */
	angle(k: number, f: number) {
		const t = Math.max(0, f - this.fHit);
		const th1 = this.w0 * this.tau * (1 - Math.exp(-t / this.tau));
		if (k === 0) return th1;
		let th = th1;
		for (let i = 0; i < k; i++) {
			const a = this.gears[i], b = this.gears[i + 1];
			th = -(a.N / b.N) * th + b.ph * (i === 0 ? 1 : 1);
			if (i > 0) th = th; // phases accumulate through the chain
		}
		return th;
	}

	private tickFrames(k: number, f0: number, span: number) {
		const g = this.gears[k];
		const step = (2 * Math.PI) / g.N;
		const out: number[] = [];
		let last = 0;
		for (let f = f0; f < f0 + span; f += 0.25) {
			const a = Math.abs(this.angle(k, f) - this.angle(k, f0));
			const n = Math.floor(a / step);
			if (n > last) {
				out.push(f);
				last = n;
			}
		}
		return out;
	}

	build(scene: THREE.Scene) {
		const g = new THREE.Group();
		const O = this.cradle.O;
		const ink = M.matte(PAL.ink, 0.42);
		// the wall
		const last = this.gears[3];
		const x0 = O[0] + 3.2;
		const x1 = last.c[0] + 1.6 + ARM_TIP + ARM_SHORT + 1.4;
		const wall = rbox(x1 - x0, 30, 0.9, 0.12, M.matte('#1B1A20', 0.5));
		wall.position.set((x0 + x1) / 2, 15, O[2] - 1.5);
		g.add(wall);
		const wfoot = box(x1 - x0 + 2, 0.6, 5, M.matte('#1B1A20', 0.5));
		wfoot.position.set((x0 + x1) / 2, 0.3, O[2] - 1.0);
		g.add(wfoot);
		const steel = M.metal('#b8bcc6', 0.3);
		this.gears.forEach((gr, k) => {
			const grp = new THREE.Group();
			const sh = gearShape(gr.R, gr.N, gr.hole, 0.55);
			const geo = new THREE.ExtrudeGeometry(sh, {depth: 0.9, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 2, curveSegments: 10});
			geo.translate(0, 0, -0.45);
			const mesh = shadowed(new THREE.Mesh(geo, M.matte(gr.col, 0.42)));
			grp.add(mesh);
			const hub = cyl(0.62, 0.62, 1.5, steel, 20);
			hub.rotation.x = Math.PI / 2;
			grp.add(hub);
			grp.position.set(gr.c[0], gr.c[1], gr.c[2]);
			g.add(grp);
			this.groups.push(grp);
			// axle to the wall
			const ax = cyl(0.3, 0.3, 1.2, steel, 12);
			ax.rotation.x = Math.PI / 2;
			ax.position.set(gr.c[0], gr.c[1], O[2] - 0.9);
			g.add(ax);
			if (k === 0) {
				// the paddle that the cradle ball hits: hangs below the rim
				const pad = rbox(0.5, 3.0, 1.6, 0.1, M.matte(PAL.ink, 0.4));
				pad.position.set(0, -gr.R - 1.0, 0);
				grp.add(pad);
				this.paddleG = pad;
			}
			if (k === 3) {
				const peg = cyl(0.3, 0.3, 1.0, M.gloss(PAL.coral, 0.25, 0.6), 16);
				peg.rotation.x = Math.PI / 2;
				peg.position.set(Math.cos(this.pegAngle0) * this.pegR, Math.sin(this.pegAngle0) * this.pegR, 0.9);
				grp.add(peg);
			}
		});
		// lever: pivots at the right of gear 4; its tip lies in the path of the peg
		const lg = (this.lever = new THREE.Group());
		lg.position.set(...this.leverPivot);
		const arm = rbox(ARM_TIP + ARM_SHORT, ARM_TH, 0.7, 0.1, M.matte(PAL.ink, 0.4));
		arm.position.set((-ARM_TIP + ARM_SHORT) / 2, 0, 0);
		lg.add(arm);
		const pin = cyl(0.3, 0.3, 1.0, steel, 12);
		pin.rotation.x = Math.PI / 2;
		lg.add(pin);
		g.add(lg);
		// wire from the lever's short end down to the brake of the music box
		const wire = unitRod(0.07, M.matte(PAL.coral, 0.4));
		this.wire = wire;
		g.add(wire);
		scene.add(g);
	}

	/** distance from the peg (radius R_PEG) to the arm at arm angle th; negative when they overlap */
	private clear(cx: number, cy: number, th: number) {
		const dx = cx - this.leverPivot[0], dy = cy - this.leverPivot[1];
		const lx = dx * Math.cos(th) + dy * Math.sin(th);
		const ly = -dx * Math.sin(th) + dy * Math.cos(th);
		const mid = (-ARM_TIP + ARM_SHORT) / 2, hx = (ARM_TIP + ARM_SHORT) / 2, hy = ARM_TH / 2;
		const qx = Math.abs(lx - mid) - hx, qy = Math.abs(ly) - hy;
		if (qx > 0 || qy > 0) return Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
		return Math.max(qx, qy);
	}

	private pegWorld(f: number, p0: number): [number, number] {
		const a = this.angle(3, f) + p0;
		const g = this.gears[3];
		return [g.c[0] + Math.cos(a) * this.pegR, g.c[1] + Math.sin(a) * this.pegR];
	}

	/** the lever angle over time for a given phase of the peg: pushed down by contact, then latched */
	private levSim(p0: number) {
		const dt = 0.25, f0 = this.fHit;
		const n = Math.round(420 / dt);
		const th = new Float32Array(n);
		let a = 0, trip = Infinity, contact = Infinity;
		for (let i = 0; i < n; i++) {
			const f = f0 + i * dt;
			const [px, py] = this.pegWorld(f, p0);
			let guard = 0;
			while (a < 0.9 && guard++ < 400 && this.clear(px, py, a) < R_PEG) a += 0.002;
			th[i] = a;
			if (contact === Infinity && a > 0.004) contact = f;
			if (trip === Infinity && a >= 0.25) trip = f;
		}
		return {f0, step: dt, th, trip, contact};
	}

	leverAngle(f: number) {
		const x = (f - this.lev.f0) / this.lev.step;
		if (x <= 0) return 0;
		const i = Math.min(this.lev.th.length - 2, Math.floor(x));
		const u = x - i;
		return this.lev.th[i] * (1 - u) + this.lev.th[i + 1] * u;
	}

	wireOffset(f: number) {
		return ARM_SHORT * Math.sin(this.leverAngle(f));
	}

	pose(f: number) {
		this.gears.forEach((gr, k) => {
			let a = this.angle(k, f);
			this.groups[k].rotation.z = a;
		});
		this.lever.rotation.z = this.leverAngle(f);
		// wire: from the short end of the lever (right of the pivot) down; pulled up when the lever trips
		const top: V3 = [this.leverPivot[0] + ARM_SHORT * Math.cos(this.leverAngle(f)), this.leverPivot[1] + ARM_SHORT * Math.sin(this.leverAngle(f)), this.leverPivot[2]];
		const lift = this.wireOffset(f);
		setRod(this.wire, top, [top[0], this.wireBottom[1] + lift, this.wireBottom[2]]);
	}

	focus(f: number): V3 {
		const k = clamp((f - this.fHit) / (this.fTrip - this.fHit), 0, 1);
		const a = this.gears[0].c, b = this.gears[3].c;
		return [a[0] + (b[0] - a[0]) * smooth(k), a[1] + (b[1] - a[1]) * smooth(k), a[2]];
	}
}
