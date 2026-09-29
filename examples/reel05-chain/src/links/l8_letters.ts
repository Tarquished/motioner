/* Link 8, RISE: a pulse of light runs from the last tooth to a gate; the coral bead (the seed) rolls down a ramp and along a rail in front of
 * the eight letters of "motioner" that lie flat on the floor. As the bead passes each letter the letter springs up, one every eighth note.
 * The bead rolls on and stops where the full stop of the word belongs: the seed is the period. */
import * as THREE from 'three';
import {BEAT, Ev, GF, PAL, Track, V3, clamp, smooth, solve} from '../base';
import {M, beadMat, box, cyl, rbox, setRod, shadowed, sphere, unitRod} from '../mk';
import GLYPHS from '../glyphs.json';
import type {MusicBox} from './l7_musicbox';
import type {Link} from './types';

const RF = 1.4; // final bead radius
const EM = 11.5;
const S = EM / 1000;
const DEPTH = 2.4;
export const WORD = 'motioner';
const RAIL_HALF = 0.85;
const RAIL_R = 0.16;
const LIFT = Math.sqrt((RF + RAIL_R) ** 2 - RAIL_HALF ** 2);

type Cmd = [string, ...number[][]];

const shapesFor = (ch: string) => {
	const g = (GLYPHS as any).glyphs[ch];
	const sp = new THREE.ShapePath();
	for (const c of g.cmds as Cmd[]) {
		const [op, ...a] = c;
		if (op === 'moveTo') sp.moveTo(a[0][0] * S, a[0][1] * S);
		else if (op === 'lineTo') sp.lineTo(a[0][0] * S, a[0][1] * S);
		else if (op === 'qCurveTo') {
			// TrueType implied on-curve points
			const pts = a.map((p) => [p[0] * S, p[1] * S]);
			let cur = (sp as any).currentPath.currentPoint as THREE.Vector2;
			for (let i = 0; i < pts.length - 1; i++) {
				const ctrl = pts[i];
				const end = i === pts.length - 2 ? pts[i + 1] : [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
				sp.quadraticCurveTo(ctrl[0], ctrl[1], end[0], end[1]);
				cur = new THREE.Vector2(end[0], end[1]);
			}
			void cur;
		} else if (op === 'curveTo') {
			sp.bezierCurveTo(a[0][0] * S, a[0][1] * S, a[1][0] * S, a[1][1] * S, a[2][0] * S, a[2][1] * S);
		}
	}
	return sp.toShapes();
};

export class Letters implements Link {
	name = 'letters';
	label = 'RISE';
	f0: number;
	f1: number;
	events: Ev[] = [];
	xs: number[] = [];
	adv: number[] = [];
	trig: number[] = [];
	up: number[] = []; // frame at which each letter first stands upright
	zc: number;
	zRail: number;
	fGate: number;
	fStart: number;
	tStop = 0;
	xStop = 0;
	xRamp0: number;
	xRail0 = 0;
	private beadM!: THREE.Mesh;
	private trk!: Track<[number, number, number, number, number, number, number, number]>;
	private letters: THREE.Group[] = [];
	private gateM!: THREE.Mesh;
	private beads: THREE.Mesh[] = [];
	private beadMats: THREE.MeshStandardMaterial[] = [];
	private cablePts: V3[] = [];
	private box: MusicBox;
	private speeds: number[] = [];
	fPulse: number;
	fWordDone = 0;
	xWordEnd = 0;

	constructor(box_: MusicBox, tFirst: number) {
		this.box = box_;
		this.f0 = box_.f1;
		this.zc = box_.zc;
		this.zRail = this.zc + 5.6;
		this.fPulse = box_.fPulse;
		this.fGate = box_.fPulse + 6;
		this.xRamp0 = box_.end[0] + 2.5;
		// letter positions
		const tr = 0.5;
		const advs = [...WORD].map((c) => (GLYPHS as any).glyphs[c].adv * S);
		this.adv = advs;
		const rampLen = 5;
		const xL0 = this.xRamp0 + rampLen + 0.3;
		let x = xL0;
		for (let i = 0; i < advs.length; i++) {
			this.xs.push(x + advs[i] / 2);
			x += advs[i] + tr;
		}
		this.xWordEnd = x - tr;
		this.xStop = this.xWordEnd + 1.4 + RF;
		// the bead: ramp physics until the first letter, then a path through the trigger points
		// physical ramp: arrival at xs[0]-1 (slightly before the m's centre) at time trig[0]
		const y0 = 5.4 + RF; // parked height (centre)
		const yRail = 0.16 + LIFT;
		const xa = this.xRamp0, xb = this.xRamp0 + rampLen;
		const path = (x: number): [number, number] => {
			const u = clamp((x - xa) / (xb - xa));
			const yy = y0 + (yRail - y0) * (1 - (1 - u) * (1 - u));
			return [x, yy];
		};
		void path;
		// roll along the ramp (energy) then along the rail at the speed it reached
		const simRamp = (xTrigger: number) => {
			let x = xa;
			let t = 0;
			let v = 0.04;
			const dt = 0.25;
			const rows: [number, number, number][] = []; // t, x, y
			while (x < xTrigger && t < 400) {
				const [, y] = path(x);
				const slopeY = (path(x + 0.05)[1] - path(x - 0.05)[1]) / 0.1;
				const cosT = 1 / Math.sqrt(1 + slopeY * slopeY);
				const sinT = -slopeY * cosT;
				const a = (5 / 7) * GF * sinT; // along the path, per frame squared (rolling sphere)
				rows.push([t, x, y]);
				v += a * dt;
				v = Math.max(0.005, v);
				x += v * cosT * dt;
				t += dt;
			}
			rows.push([t, x, path(x)[1]]);
			return {rows, t, v};
		};
		const x0 = this.xs[0] - 2.4;
		const ramp = simRamp(x0);
		this.xRail0 = x0;
		const tRamp = ramp.t;
		const gapT = (this.xs[0] - x0) / ramp.v;
		const tArr = this.fGate + tRamp + gapT + 3;
		tFirst = Math.max(tFirst, Math.ceil(tArr / (BEAT / 2)) * (BEAT / 2));
		this.trig = this.xs.map((_, i) => tFirst + i * (BEAT / 2));
		this.fStart = tFirst - gapT - tRamp; // when the bead starts to roll
		this.fGate = this.fStart - 4;
		// build the track: ramp rows (time offset fStart), then Hermite through (trig[i], xs[i])
		const rows: [number, number, number, number, number, number, number, number][] = [];
		const q = new THREE.Quaternion();
		const dt = 0.25;
		const pts: {t: number; x: number}[] = [{t: this.fStart + tRamp, x: x0}];
		// bead trigger points are at the letter centres minus the bead radius offset: use the centres directly
		this.xs.forEach((x_, i) => pts.push({t: this.trig[i], x: x_}));
		// after the last letter the bead rolls out and stops at xStop with constant deceleration
		const last = pts[pts.length - 1];
		const prev = pts[pts.length - 2];
		const vEnd = (last.x - prev.x) / (last.t - prev.t);
		const dist = this.xStop - last.x;
		const tStop = (2 * dist) / vEnd;
		this.tStop = last.t + tStop;
		// speeds: v at the start of the rail equals the ramp's final speed; then finite-difference tangents
		const tang: number[] = pts.map((p, i) => {
			if (i === 0) return ramp.v;
			if (i === pts.length - 1) return vEnd;
			return (pts[i + 1].x - pts[i - 1].x) / (pts[i + 1].t - pts[i - 1].t);
		});
		const xAt = (t: number): number => {
			if (t <= pts[0].t) return x0;
			if (t >= last.t) {
				const s = t - last.t;
				if (s >= tStop) return this.xStop;
				return last.x + vEnd * s - (vEnd / (2 * tStop)) * s * s;
			}
			let k = 0;
			while (k < pts.length - 2 && t > pts[k + 1].t) k++;
			const h = pts[k + 1].t - pts[k].t;
			const u = (t - pts[k].t) / h;
			const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
			return h00 * pts[k].x + h10 * h * tang[k] + h01 * pts[k + 1].x + h11 * h * tang[k + 1];
		};
		// rows: ramp part
		const zAt = (x: number) => {
			const xc0 = this.xWordEnd + 0.5;
			const u = clamp((x - xc0) / (this.xStop - xc0));
			return this.zRail + (this.zc - this.zRail) * smooth(u);
		};
		let px = xa, py = y0, pz = this.zRail;
		const tEnd = this.tStop + 40;
		let lastFrame = -1;
		for (let t = this.fStart; t <= tEnd; t += dt) {
			let x: number, y: number;
			if (t < this.fStart + tRamp) {
				// interpolate the ramp rows
				const tt = t - this.fStart;
				let k = 0;
				while (k < ramp.rows.length - 2 && ramp.rows[k + 1][0] < tt) k++;
				const a = ramp.rows[k], b = ramp.rows[k + 1];
				const u = clamp((tt - a[0]) / Math.max(1e-6, b[0] - a[0]));
				x = a[1] + (b[1] - a[1]) * u;
				y = a[2] + (b[2] - a[2]) * u;
			} else {
				x = xAt(t);
				y = yRail - (x > this.xWordEnd + 0.5 ? (0.16 + LIFT - RF) * smooth((x - this.xWordEnd - 0.5) / 3) : 0);
			}
			const z = zAt(x);
			const dx = x - px, dz = z - pz, dy = y - py;
			const ds = Math.hypot(dx, dz);
			if (ds > 1e-6) {
				const T = new THREE.Vector3(dx, dy, dz).normalize();
				const ax = new THREE.Vector3(0, 1, 0).cross(T).normalize();
				q.premultiply(new THREE.Quaternion().setFromAxisAngle(ax, ds / RF));
			}
			rows.push([t, x, y, z, q.x, q.y, q.z, q.w]);
			if (Math.floor(t) !== lastFrame) {
				this.speeds.push(Math.hypot(dx, dz) / dt);
				lastFrame = Math.floor(t);
			}
			px = x;
			py = y;
			pz = z;
		}
		this.trk = new Track(this.fStart, dt, rows);
		this.f1 = this.tStop;
		// letters rise
		const zeta = 0.5, w0 = 0.21;
		const wd = w0 * Math.sqrt(1 - zeta * zeta);
		this.riseX = (tau: number) => {
			if (tau <= 0) return 0;
			return 1 - Math.exp(-zeta * w0 * tau) * (Math.cos(wd * tau) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * tau));
		};
		for (let i = 0; i < this.xs.length; i++) {
			// first frame with x >= 1
			let tau = 0;
			while (this.riseX(tau) < 1 && tau < 200) tau += 0.25;
			this.up.push(this.trig[i] + tau);
			this.events.push({f: this.trig[i], kind: 'letter_go', i});
			this.events.push({f: this.trig[i] + tau, kind: 'letter', i, ch: WORD[i]});
		}
		this.fWordDone = this.up[this.up.length - 1];
		this.events.push({f: this.fGate, kind: 'gate'});
		this.events.push({f: this.fStart, kind: 'roll', frames: Math.round(this.tStop - this.fStart), speed: this.speeds});
		this.events.push({f: this.tStop, kind: 'period'});
		// cable from the special tooth to the gate
		const sx = box_.toothX2();
		this.cablePts = [
			[sx, 2.4, this.zc + 9.5],
			[sx + 2.5, 0.15, this.zc + 11.5],
			[this.xRamp0 - 1.5, 0.15, this.zc + 9.0],
			[this.xRamp0 - 0.6, 0.15, this.zc + 3.0],
		];
	}

	riseX: (tau: number) => number;

	build(scene: THREE.Scene) {
		const g = new THREE.Group();
		const zc = this.zc;
		const ink = M.matte(PAL.ink, 0.42);
		// letters
		const mats = [M.matte(PAL.paper, 0.5), M.matte(PAL.paper, 0.5)];
		[...WORD].forEach((ch, i) => {
			const shapes = shapesFor(ch);
			const geo = new THREE.ExtrudeGeometry(shapes, {depth: DEPTH - 0.5, bevelEnabled: true, bevelSize: 0.16, bevelThickness: 0.25, bevelSegments: 3, curveSegments: 10});
			geo.translate(-this.adv[i] / 2, 0, 0.25);
			const mesh = shadowed(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({color: PAL.paper, roughness: 0.42, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.3})));
			const hinge = new THREE.Group();
			hinge.position.set(this.xs[i], 0, zc - DEPTH / 2);
			hinge.add(mesh);
			hinge.rotation.x = -Math.PI / 2;
			g.add(hinge);
			this.letters.push(hinge);
		});
		void mats;
		// ramp with the parked bead and a gate
		const y0 = 5.4;
		const xa = this.xRamp0, xb = this.xRamp0 + 5;
		const N = 40;
		const pts: THREE.Vector3[] = [];
		for (let k = 0; k <= N; k++) {
			const x = xa - 1.2 + ((xb + 1.5 - (xa - 1.2)) * k) / N;
			const u = clamp((x - xa) / (xb - xa));
			const yy = 0.16 + LIFT + (y0 + RF - 0.16 - LIFT) * ((1 - u) * (1 - u)) - LIFT;
			pts.push(new THREE.Vector3(x, yy, this.zRail));
		}
		for (const side of [-1, 1]) {
			const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, p.y, p.z + side * RAIL_HALF)));
			const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, RAIL_R, 10, false), ink);
			tube.castShadow = true;
			tube.receiveShadow = true;
			g.add(tube);
		}
		// rail along the letters
		const x1 = this.xWordEnd + 0.5;
		for (const side of [-1, 1]) {
			const r = cyl(RAIL_R, RAIL_R, x1 - (xb + 1.5), ink, 10);
			r.rotation.z = Math.PI / 2;
			r.position.set((x1 + xb + 1.5) / 2, 0.16, this.zRail + side * RAIL_HALF);
			g.add(r);
		}
		for (let x = xb + 2; x < x1; x += 1.6) {
			const tie = box(0.3, 0.14, RAIL_HALF * 2 + 0.6, M.matte(PAL.paper, 0.6));
			tie.position.set(x, 0.05, this.zRail);
			g.add(tie);
		}
		// ramp legs
		for (let x = xa + 1; x < xb; x += 3) {
			const u = clamp((x - xa) / (xb - xa));
			const h = (y0 + RF - 0.16 - LIFT) * ((1 - u) * (1 - u)) + 0.16 - 0.3;
			if (h < 0.5) continue;
			const leg = box(0.28, h, 0.28, ink);
			leg.position.set(x, h / 2, this.zRail);
			g.add(leg);
		}
		// the start stand under the parked bead
		const stand = box(1.2, 5.4 - 0.2, 1.2, ink);
		stand.position.set(this.xRamp0 - 1.4, 2.6, this.zRail);
		g.add(stand);
		const gate = box(0.4, 3.0, 2.6, M.matte(PAL.paper, 0.6));
		this.gateM = gate;
		g.add(gate);
		// the bead
		this.beadM = sphere(RF, beadMat(PAL.coral, PAL.paper), 72);
		g.add(this.beadM);
		// cable with light beads
		const curve = new THREE.CatmullRomCurve3(this.cablePts.map((p) => new THREE.Vector3(...p)));
		const tube = shadowed(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.1, 8, false), M.matte('#2a2a30', 0.5)), false, true);
		g.add(tube);
		const nb = 22;
		for (let i = 0; i < nb; i++) {
			const p = curve.getPoint(i / (nb - 1));
			const mat = new THREE.MeshStandardMaterial({color: '#3a1a14', emissive: new THREE.Color(PAL.coral), emissiveIntensity: 0, roughness: 0.4});
			const bead = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mat), false, false);
			bead.position.copy(p).add(new THREE.Vector3(0, 0.12, 0));
			g.add(bead);
			this.beads.push(bead);
			this.beadMats.push(mat);
		}
		scene.add(g);
	}

	pose(f: number) {
		const r = this.trk.at(f);
		this.beadM.position.set(r[1], r[2], r[3]);
		this.beadM.quaternion.set(r[4], r[5], r[6], r[7]);
		// a living detail on the held end card: the full stop breathes
		const br = f > this.tStop ? smooth((f - this.tStop) / 20) : 0;
		this.beadM.scale.setScalar(1 + 0.045 * br * Math.sin(((f - this.tStop) / 60) * Math.PI * 1.4));
		// the parked bead sits on the ramp top until the gate opens
		this.letters.forEach((h, i) => {
			const tau = f - this.trig[i];
			h.rotation.x = -Math.PI / 2 * (1 - this.riseX(tau));
		});
		// gate: lifts when the pulse arrives
		const lift = smooth((f - this.fGate) / 5) * 3.4;
		this.gateM.position.set(this.xRamp0 - 0.55, 5.4 + 0.6 + lift - 0.6, this.zRail);
		const n = this.beads.length;
		for (let i = 0; i < n; i++) {
			const t = (f - this.fPulse) / 6;
			const d = Math.abs(i / (n - 1) - t);
			const on = t > -0.1 ? Math.exp(-d * d * 90) * 9 : 0;
			const after = f > this.fPulse + 6 ? 0.7 * Math.exp(-(f - this.fPulse - 6) / 30) : 0;
			this.beadMats[i].emissiveIntensity = on + after;
		}
	}

	focus(f: number): V3 {
		const r = this.trk.at(f);
		return [r[1], r[2], r[3]];
	}
}
