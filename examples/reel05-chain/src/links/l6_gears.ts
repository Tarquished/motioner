/* Link 6, TURN: the last cradle ball strikes a paddle on the rim of the first gear. Four gears on an ink wall carry the turn upward and
 * the small ones spin fast. A peg on the last gear presses a lever; the lever pulls a wire that lifts the brake of the music box. */
import * as THREE from 'three';
import {Ev, PAL, V3, clamp, smooth} from '../base';
import {M, box, cyl, rbox, setRod, shadowed, unitRod} from '../mk';
import type {Cradle} from './l5_cradle';
import type {Link} from './types';

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
	w0 = 0.06; // peak angular speed of the first gear, rad per frame
	tau = 150;
	base: V3;
	pegAngle0 = 0;
	leverPivot: V3 = [0, 0, 0];
	private groups: THREE.Group[] = [];
	private paddleG!: THREE.Mesh;
	private lever!: THREE.Group;
	private wire!: THREE.Mesh;
	private pegR = 1.25;
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
			{R: 1.75, N: 7, col: PAL.paper, angle: 0.17},
		];
		let c = c1;
		const gs: G[] = [];
		defs.forEach((d, k) => {
			if (k > 0) {
				const prev = gs[k - 1];
				const dist = prev.R + d.R - 0.05;
				c = [prev.c[0] + Math.cos(d.angle) * dist, prev.c[1] + Math.sin(d.angle) * dist, O[2]];
			}
			gs.push({R: d.R, N: d.N, col: d.col, c: [...c] as V3, ph: 0, hole: k === 3 ? 4 : 5});
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
		// the peg on gear 4 must be at the lever when the trip time arrives
		const g4 = gs[3];
		const th4 = this.angle(3, this.fTrip - 6);
		// the lever tip sits at angle 0 of gear 4's peg circle (to the right); the peg moves downward there (clockwise)
		this.pegAngle0 = -th4 + 0.0; // peg angle in the gear's own frame such that its world angle is 0 at fTrip - 6
		this.leverPivot = [g4.c[0] + this.pegR + 1.7, g4.c[1] + 0.25, O[2] + 1.0];
		this.wireBottom = [this.leverPivot[0] + 1.2, 0.6, this.leverPivot[2]];
		// events: gear teeth ticks (first and last gear) and the trip
		this.events.push({f: this.fHit, kind: 'paddle_gear', v: cradle.sim.paddle.v});
		const ticks1 = this.tickFrames(0, this.fHit, 240);
		const ticks4 = this.tickFrames(3, this.fHit, 240);
		this.events.push({f: this.fHit, kind: 'gearticks', ticks: ticks1, gain: 1, tone: 0});
		this.events.push({f: this.fHit, kind: 'gearticks', ticks: ticks4, gain: 0.6, tone: 1});
		this.events.push({f: this.fTrip, kind: 'lever'});
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
		const x1 = last.c[0] + 3.6;
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
		const arm = rbox(1.9 + 1.4, 0.55, 0.7, 0.1, M.matte(PAL.ink, 0.4));
		arm.position.set(-0.25, 0, 0);
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

	leverAngle(f: number) {
		// pressed down (clockwise: negative z rotation of the tip) when the peg arrives, then rests pressed for a while
		const t = f - (this.fTrip - 6);
		return 0.42 * smooth(t / 9) - 0.02;
	}

	wireOffset(f: number) {
		return 1.4 * smooth((f - this.fTrip) / 6);
	}

	pose(f: number) {
		this.gears.forEach((gr, k) => {
			let a = this.angle(k, f);
			this.groups[k].rotation.z = a;
		});
		this.lever.rotation.z = this.leverAngle(f);
		// wire: from the short end of the lever (right of the pivot) down; pulled up when the lever trips
		const top: V3 = [this.leverPivot[0] + 1.2 * Math.cos(this.leverAngle(f)), this.leverPivot[1] + 1.2 * Math.sin(this.leverAngle(f)) + 0.0, this.leverPivot[2]];
		const lift = this.wireOffset(f);
		setRod(this.wire, top, [this.wireBottom[0], this.wireBottom[1] + lift, this.wireBottom[2]]);
	}

	focus(f: number): V3 {
		const k = clamp((f - this.fHit) / (this.fTrip - this.fHit), 0, 1);
		const a = this.gears[0].c, b = this.gears[3].c;
		return [a[0] + (b[0] - a[0]) * smooth(k), a[1] + (b[1] - a[1]) * smooth(k), a[2]];
	}
}
