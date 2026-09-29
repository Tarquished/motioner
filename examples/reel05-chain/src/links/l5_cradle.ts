/* Link 5, PASS: the wave of light from the button reaches a small photocell; a pulse runs along a cable to a pawl that lets go of
 * the first ball of a Newton's cradle. The impulse runs through the balls and the last one leaves with the first one's speed,
 * strikes the paddle of the first gear on the way out: the velocity is handed over. */
import * as THREE from 'three';
import {Ev, PAL, V3, clamp, smooth} from '../base';
import {ringArrival} from '../flood';
import {M, box, cyl, setRod, sphere, unitRod, shadowed} from '../mk';
import {CradleSim, simulateCradle, thAt} from '../sim/cradle';
import type {Link} from './types';
import type {Launch} from './l4_launch';

export const CR = {L: 6.5, r: 1.4, Hb: 14, zb: 2.3, th0: -0.7, thPaddle: 0.2, keep: 0.6};

export class Cradle implements Link {
	name = 'cradle';
	label = 'PASS';
	f0: number;
	f1: number;
	events: Ev[] = [];
	O: V3; // centre of the cradle on the floor
	PC: V3; // photocell
	pawlBase: V3;
	fW: number;
	fPulse: number;
	fPawl: number;
	fRelease: number;
	sim: CradleSim;
	paddlePoint: V3; // where ball 4 meets the paddle
	private balls: THREE.Mesh[] = [];
	private strings: THREE.Mesh[][] = [];
	private pawl!: THREE.Mesh;
	private led!: THREE.Mesh;
	private ledMat!: THREE.MeshStandardMaterial;
	private beads: THREE.Mesh[] = [];
	private beadMats: THREE.MeshStandardMaterial[] = [];
	private cablePts: V3[] = [];

	constructor(launch: Launch) {
		const bp = launch.buttonPos;
		this.f0 = launch.fButton;
		this.O = [bp[0] + 62, 0, bp[2] + 1];
		this.PC = [bp[0] + 44, 0, bp[2] + 8];
		this.pawlBase = [this.O[0] - 7.6, 0, this.O[2]];
		const d = Math.hypot(this.PC[0] - bp[0], this.PC[2] - bp[2]);
		this.fW = ringArrival(d, launch.fButton);
		this.fPulse = this.fW + 2;
		this.fPawl = this.fW + 9;
		this.fRelease = this.fPawl + 2;
		this.sim = simulateCradle({L: CR.L, r: CR.r, th0: CR.th0, fRelease: this.fRelease, thPaddle: CR.thPaddle, paddleKeep: CR.keep, frames: 420});
		this.f1 = this.sim.paddle.f;
		this.paddlePoint = [this.O[0] + 4 * 2 * CR.r - 2 * 2 * CR.r + CR.L * Math.sin(CR.thPaddle), CR.Hb - CR.L * Math.cos(CR.thPaddle), this.O[2]];
		// cable path on the floor from the photocell to the pawl
		const a = this.PC, b = this.pawlBase;
		const mid1: V3 = [a[0] + (b[0] - a[0]) * 0.3, 0.15, a[2] - 3.5];
		const mid2: V3 = [a[0] + (b[0] - a[0]) * 0.7, 0.15, b[2] + 4];
		this.cablePts = [[a[0], 0.15, a[2]], mid1, mid2, [b[0], 0.15, b[2]]];
		// events
		this.events.push({f: this.fW, kind: 'led'});
		this.events.push({f: this.fPulse, kind: 'pulse', frames: 6});
		this.events.push({f: this.fPawl, kind: 'pawl'});
		// merge the collisions of one exchange into a single event
		const cs = this.sim.collisions;
		let i = 0;
		while (i < cs.length) {
			let j = i;
			while (j + 1 < cs.length && cs[j + 1].f - cs[i].f < 1.2) j++;
			this.events.push({f: cs[i].f, kind: 'cradle', v: cs[i].v, n: j - i + 1});
			i = j + 1;
		}
		this.events.push({f: this.sim.paddle.f, kind: 'paddle', v: Math.abs(this.sim.paddle.v)});
	}

	private ballX(i: number) {
		return this.O[0] + (i - 2) * 2 * CR.r;
	}

	build(scene: THREE.Scene) {
		const g = new THREE.Group();
		const ink = M.matte(PAL.ink, 0.42);
		const steel = M.metal('#b8bcc6', 0.3);
		// frame
		for (const sx of [-1, 1]) {
			for (const sz of [-1, 1]) {
				const post = box(0.6, CR.Hb + 0.6, 0.6, ink);
				post.position.set(this.O[0] + sx * 8.4, (CR.Hb + 0.6) / 2, this.O[2] + sz * CR.zb);
				g.add(post);
				const foot = box(1.6, 0.25, 1.6, ink);
				foot.position.set(this.O[0] + sx * 8.4, 0.125, this.O[2] + sz * CR.zb);
				g.add(foot);
			}
		}
		for (const sz of [-1, 1]) {
			const bar = cyl(0.24, 0.24, 17.4, steel, 16);
			bar.rotation.z = Math.PI / 2;
			bar.position.set(this.O[0], CR.Hb, this.O[2] + sz * CR.zb);
			g.add(bar);
		}
		// balls and strings, in the four colours plus paper
		const cols = [PAL.ink, PAL.blue, PAL.paper, PAL.yellow, PAL.coral];
		for (let i = 0; i < 5; i++) {
			const b = sphere(CR.r, i === 2 ? M.metal('#d9dbe0', 0.16) : new THREE.MeshPhysicalMaterial({color: cols[i], roughness: 0.2, metalness: 0.75, clearcoat: 1, clearcoatRoughness: 0.05}), 56);
			g.add(b);
			this.balls.push(b);
			const st = [unitRod(0.035, M.matte('#2a2a30', 0.4)), unitRod(0.035, M.matte('#2a2a30', 0.4))];
			st.forEach((s) => g.add(s));
			this.strings.push(st);
		}
		// pawl stand holding ball 0
		const stand = box(0.6, CR.Hb - CR.L * Math.cos(CR.th0) + 1.2, 0.6, ink);
		const sy = CR.Hb - CR.L * Math.cos(CR.th0);
		stand.position.set(this.pawlBase[0], (sy + 1.2) / 2, this.pawlBase[2]);
		g.add(stand);
		const stfoot = box(1.8, 0.25, 1.8, ink);
		stfoot.position.set(this.pawlBase[0], 0.125, this.pawlBase[2]);
		g.add(stfoot);
		const pawl = cyl(0.26, 0.26, 1.4, steel, 14);
		pawl.rotation.z = Math.PI / 2;
		this.pawl = pawl;
		g.add(pawl);
		// photocell
		const pb = cyl(0.9, 1.0, 0.6, ink, 32);
		pb.position.set(this.PC[0], 0.3, this.PC[2]);
		g.add(pb);
		const dome = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.75, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.gloss(PAL.paper, 0.2, 1)));
		dome.position.set(this.PC[0], 0.6, this.PC[2]);
		g.add(dome);
		this.ledMat = new THREE.MeshStandardMaterial({color: '#3a1a14', emissive: new THREE.Color(PAL.coral), emissiveIntensity: 0, roughness: 0.4});
		const led = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), this.ledMat));
		led.position.set(this.PC[0], 1.05, this.PC[2]);
		this.led = led;
		g.add(led);
		// cable with light beads
		const curve = new THREE.CatmullRomCurve3(this.cablePts.map((p) => new THREE.Vector3(...p)));
		const tube = shadowed(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.1, 8, false), M.matte('#2a2a30', 0.5)), false, true);
		g.add(tube);
		const nb = 26;
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
		for (let i = 0; i < 5; i++) {
			const th = thAt(this.sim, i, f);
			const x = this.ballX(i);
			const cx = x + CR.L * Math.sin(th);
			const cy = CR.Hb - CR.L * Math.cos(th);
			this.balls[i].position.set(cx, cy, this.O[2]);
			setRod(this.strings[i][0], [x, CR.Hb, this.O[2] - CR.zb], [cx, cy, this.O[2]]);
			setRod(this.strings[i][1], [x, CR.Hb, this.O[2] + CR.zb], [cx, cy, this.O[2]]);
		}
		// pawl: holds ball 0 until fPawl, then slides back
		const back = smooth((f - this.fPawl) / 3) * 1.8;
		const b0x = this.ballX(0) + CR.L * Math.sin(CR.th0);
		const py = CR.Hb - CR.L * Math.cos(CR.th0);
		this.pawl.position.set(b0x + CR.r + 0.7 + back, py, this.O[2]);
		// LED and the pulse on the cable
		this.ledMat.emissiveIntensity = f >= this.fW ? 6 * (0.55 + 0.45 * Math.exp(-(f - this.fW) / 20)) : 0;
		const n = this.beads.length;
		for (let i = 0; i < n; i++) {
			const t = (f - this.fPulse) / 6; // pulse position 0..1 along the cable
			const d = Math.abs(i / (n - 1) - t);
			const on = t > -0.1 ? Math.exp(-d * d * 90) * 9 : 0;
			const after = f > this.fPulse + 6 ? 0.7 * Math.exp(-(f - this.fPulse - 6) / 30) : 0;
			this.beadMats[i].emissiveIntensity = on + after;
		}
	}

	focus(f: number): V3 {
		// the light wave first, then the balls
		if (f < this.fRelease) return [this.PC[0], 1, this.PC[2]];
		const th4 = thAt(this.sim, 4, f), th0 = thAt(this.sim, 0, f);
		const i = f < this.sim.fFirst ? 0 : 4;
		const th = i === 0 ? th0 : th4;
		return [this.ballX(i) + CR.L * Math.sin(th), CR.Hb - CR.L * Math.cos(th), this.O[2]];
	}
}

void clamp;
