/* Link 4, LAUNCH: the giant last domino falls onto a see-saw; its far end slams against a stop bar and throws a blue ball high
 * into the dark. The ball hangs at the top, falls back and lands on a big coral button. The press is the drop of the film. */
import * as THREE from 'three';
import {Ev, GF, PAL, V3, clamp, eout} from '../base';
import {M, beadMat, box, cyl, rbox, shadowed, sphere} from '../mk';
import {Topple} from './l3_topple';
import type {Link} from './types';

const THICK = 0.4;
const RBALL = 0.75;

export class Launch implements Link {
	name = 'launch';
	label = 'LAUNCH';
	f0: number;
	f1: number;
	events: Ev[] = [];
	// local frame at the last domino
	B: V3;
	F: V3;
	Lt: V3;
	yaw: number;
	// see-saw
	L = 5.6;
	Hf = 0;
	aP = 0;
	phi0 = -0.5;
	phiR = -0.16;
	sB = this.L - 1.1;
	tR = 0; // release frame
	tauR = 0;
	fButton: number;
	// ball flight
	p0: V3 = [0, 0, 0]; // launch position, world
	vel: V3 = [0, 0, 0]; // per frame
	buttonPos: V3 = [0, 0, 0]; // world, centre of the button
	apexF = 0;
	private bounce: {f: number; y: number}[] = [];
	private plankG!: THREE.Group;
	private ballM!: THREE.Mesh;
	private capM!: THREE.Mesh;
	private topple: Topple;

	constructor(topple: Topple, fButton: number) {
		this.topple = topple;
		this.f0 = topple.fLast;
		this.f1 = fButton;
		this.fButton = fButton;
		const T = topple.endDir;
		this.F = [T[0], 0, T[2]];
		const fl = Math.hypot(this.F[0], this.F[2]);
		this.F = [this.F[0] / fl, 0, this.F[2] / fl];
		this.Lt = [-this.F[2], 0, this.F[0]];
		this.yaw = Math.atan2(-this.F[2], this.F[0]);
		this.B = topple.endPos;
		const h = topple.hLast;
		const phiC = topple.phiC;
		const ac = h * Math.sin(phiC);
		const yc = h * Math.cos(phiC);
		const ypt = yc - THICK * 0.9;
		this.Hf = ypt - this.L * Math.abs(Math.sin(this.phi0));
		this.aP = ac + this.L * Math.cos(this.phi0);
		// plank kinematics
		const delta = this.phiR - this.phi0;
		const Vm = 1 / (1 - 0.125);
		const rb = Math.hypot(this.sB, RBALL + THICK / 2);
		const pr = this.ballCentreLocal(this.phiR);
		const yb = 1.4 + RBALL; // ball centre when it sits on the pressed button cap: top at 1.4
		// flight: from the release frame to fButton
		// tauR depends on speed, speed depends on the flight time: iterate
		let tauR = 4;
		let vy = 0;
		let v = 0;
		for (let k = 0; k < 20; k++) {
			this.tR = this.f0 + tauR;
			const Tf = fButton - this.tR;
			vy = (yb - pr[1]) / Tf + 0.5 * GF * Tf;
			const u: [number, number] = [-Math.sin(this.phiR), Math.cos(this.phiR)];
			v = vy / u[1];
			const omega = v / rb;
			tauR = (Vm * Math.abs(delta)) / omega;
		}
		this.tauR = tauR;
		this.tR = this.f0 + tauR;
		const Tf = fButton - this.tR;
		const u: [number, number] = [-Math.sin(this.phiR), Math.cos(this.phiR)];
		const vloc: [number, number] = [u[0] * v, u[1] * v]; // (forward, up) per frame
		this.p0 = this.world(pr[0], 0, pr[1]);
		this.vel = [this.F[0] * vloc[0], vloc[1], this.F[2] * vloc[0]];
		const land = this.world(pr[0] + vloc[0] * Tf, 0, 0);
		this.buttonPos = [land[0], 0, land[2]];
		this.apexF = this.tR + vloc[1] / GF;
		// bounce on the button: two small hops
		const vImp = -(vloc[1] - GF * Tf);
		const e = 0.28;
		let vb = vImp * e;
		let ft = fButton;
		for (let hop = 0; hop < 3; hop++) {
			const air = (2 * vb) / GF;
			this.bounce.push({f: ft, y: vb});
			ft += air;
			vb *= e;
		}
		// events
		const vslam = topple.vLast;
		this.events.push({f: this.f0, kind: 'slam', v: Math.abs(vslam)});
		this.events.push({f: this.tR, kind: 'launch', v});
		const speeds: number[] = [];
		for (let i = 0; i <= Tf; i++) speeds.push(Math.abs(vloc[1] - GF * i));
		this.events.push({f: this.tR, kind: 'flight', frames: Math.round(Tf), speed: speeds});
		this.events.push({f: this.apexF, kind: 'apex'});
		this.events.push({f: fButton, kind: 'button', v: Math.abs(vImp)});
		for (let i = 1; i < this.bounce.length; i++) this.events.push({f: this.bounce[i].f, kind: 'hop', v: this.bounce[i - 1].y * e});
		topple.lastPhi = (f) => Math.acos(clamp(this.strikerY(f) / topple.hLast, 0.05, 1));
	}

	/** launch end angle of the plank at frame f */
	phiP(f: number) {
		const tau = f - this.f0;
		if (tau <= 0) return this.phi0;
		const delta = this.phiR - this.phi0;
		const x = tau / this.tauR;
		const Vm = 1 / (1 - 0.125);
		if (x < 1) {
			const g = x < 0.25 ? (Vm * x * x) / 0.5 : Vm * (x - 0.125);
			return this.phi0 + delta * g;
		}
		// stopped by the bar: a small damped rebound
		const t2 = tau - this.tauR;
		return this.phiR - 0.012 * Math.exp(-t2 / 5) * Math.cos(t2 * 0.9) + 0.0;
	}

	strikerY(f: number) {
		return this.Hf + this.L * Math.abs(Math.sin(this.phiP(f))) + THICK * 0.9;
	}

	ballCentreLocal(phi: number): [number, number] {
		const d: [number, number] = [Math.cos(phi), Math.sin(phi)];
		const n: [number, number] = [-Math.sin(phi), Math.cos(phi)];
		const lift = THICK / 2 + RBALL;
		return [this.aP + d[0] * this.sB + n[0] * lift, this.Hf + d[1] * this.sB + n[1] * lift];
	}

	world(a: number, b: number, y: number): V3 {
		return [this.B[0] + this.F[0] * a + this.Lt[0] * b, y, this.B[2] + this.F[2] * a + this.Lt[2] * b];
	}

	ballAt(f: number): V3 {
		if (f < this.tR) {
			const c = this.ballCentreLocal(this.phiP(f));
			return this.world(c[0], 0, c[1]);
		}
		const t = f - this.tR;
		const Tf = this.fButton - this.tR;
		if (f <= this.fButton) {
			return [this.p0[0] + this.vel[0] * t, this.p0[1] + this.vel[1] * t - 0.5 * GF * t * t, this.p0[2] + this.vel[2] * t];
		}
		// hops on the button
		let y = 0;
		for (let i = 0; i < this.bounce.length; i++) {
			const b = this.bounce[i];
			const tt = f - b.f;
			const air = (2 * b.y) / GF;
			if (tt >= 0 && tt <= air) {
				y = b.y * tt - 0.5 * GF * tt * tt;
				break;
			}
		}
		void Tf;
		const c = this.buttonPos;
		return [c[0], this.capTop(f) + RBALL + y, c[2]];
	}

	capTop(f: number) {
		const tau = f - this.fButton;
		if (tau < 0) return 1.4;
		const down = 0.32 * eout(tau / 3.5);
		const settle = tau > 3.5 ? 0.08 * (1 - Math.exp(-(tau - 3.5) / 10)) : 0;
		const osc = tau > 3.5 ? 0.035 * Math.exp(-(tau - 3.5) / 9) * Math.cos((tau - 3.5) * 0.7) : 0;
		return 1.4 - down + settle + osc;
	}

	build(scene: THREE.Scene) {
		const g = new THREE.Group();
		g.position.set(...this.B);
		g.rotation.y = this.yaw;
		// fulcrum: a wedge
		const tri = new THREE.Shape();
		tri.moveTo(-2.6, 0);
		tri.lineTo(2.6, 0);
		tri.lineTo(0.35, this.Hf - 0.3);
		tri.lineTo(-0.35, this.Hf - 0.3);
		tri.closePath();
		const wedge = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, {depth: 3.2, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2}), M.matte(PAL.ink, 0.45));
		wedge.geometry.translate(0, 0, -1.6);
		shadowed(wedge);
		wedge.position.set(this.aP, 0, 0);
		g.add(wedge);
		// plank on its pivot
		const pg = (this.plankG = new THREE.Group());
		pg.position.set(this.aP, this.Hf, 0);
		const plank = rbox(this.L * 2, THICK, 3.4, 0.1, M.matte(PAL.yellow, 0.5));
		pg.add(plank);
		const lip = rbox(0.3, 1.5, 3.4, 0.08, M.matte(PAL.yellow, 0.5));
		lip.position.set(this.L - 0.15, 0.55, 0);
		pg.add(lip);
		const pad = rbox(1.6, 0.32, 3.0, 0.08, M.matte(PAL.paper, 0.7));
		pad.position.set(-this.L + 1.0, THICK / 2 + 0.16, 0);
		pg.add(pad);
		pg.rotation.z = this.phi0;
		g.add(pg);
		// stop bar: two posts and a bar above the launch end, at the height where the plank stops
		const stopA = this.L * 0.78;
		const barY = this.Hf + stopA * Math.sin(this.phiR) + THICK / 2 + 0.12;
		const barX = this.aP + stopA * Math.cos(this.phiR);
		for (const s of [-1, 1]) {
			const post = box(0.32, barY + 0.3, 0.32, M.matte(PAL.ink, 0.45));
			post.position.set(barX, (barY + 0.3) / 2, s * 2.3);
			g.add(post);
			const foot = box(1.1, 0.18, 1.1, M.matte(PAL.ink, 0.45));
			foot.position.set(barX, 0.09, s * 2.3);
			g.add(foot);
		}
		const bar = cyl(0.14, 0.14, 4.9, M.metal('#b8bcc6', 0.3), 16);
		bar.rotation.x = Math.PI / 2;
		bar.position.set(barX, barY + 0.13, 0);
		g.add(bar);
		// a block under the launch end at rest
		scene.add(g);
		// ball
		this.ballM = sphere(RBALL, beadMat(PAL.blue, PAL.paper), 48);
		scene.add(this.ballM);
		// button
		const bg = new THREE.Group();
		bg.position.set(this.buttonPos[0], 0, this.buttonPos[2]);
		const base = cyl(2.7, 2.85, 1.0, M.matte(PAL.ink, 0.4), 48);
		base.position.y = 0.5;
		bg.add(base);
		const ring = cyl(2.45, 2.45, 0.12, M.metal('#b8bcc6', 0.28), 48);
		ring.position.y = 1.03;
		bg.add(ring);
		const cap = cyl(2.15, 2.25, 0.9, M.gloss(PAL.coral, 0.3, 0.6), 48);
		cap.position.y = 0.95;
		this.capM = cap;
		bg.add(cap);
		scene.add(bg);
	}

	pose(f: number) {
		this.plankG.rotation.z = this.phiP(f);
		const b = this.ballAt(f);
		this.ballM.position.set(b[0], b[1], b[2]);
		const spin = Math.max(0, f - this.tR);
		this.ballM.rotation.set(spin * 0.05, spin * 0.03, spin * 0.07);
		this.capM.position.y = this.capTop(f) - 0.45;
	}

	focus(f: number): V3 {
		return this.ballAt(f);
	}
}
