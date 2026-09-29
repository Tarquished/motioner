/* Small helpers to build meshes and materials in the film's palette. */
import * as THREE from 'three';
import {PAL, V3} from './base';

export const col = (hex: string) => new THREE.Color(hex);

const cache: Record<string, THREE.Material> = {};
export const M = {
	matte(hex: string, rough = 0.6) {
		const k = `m${hex}${rough}`;
		return (cache[k] ??= new THREE.MeshStandardMaterial({color: hex, roughness: rough, metalness: 0}));
	},
	gloss(hex: string, rough = 0.16, coat = 0.8) {
		const k = `g${hex}${rough}${coat}`;
		return (cache[k] ??= new THREE.MeshPhysicalMaterial({color: hex, roughness: rough, metalness: 0, clearcoat: coat, clearcoatRoughness: 0.08}));
	},
	metal(hex: string, rough = 0.3) {
		const k = `x${hex}${rough}`;
		return (cache[k] ??= new THREE.MeshStandardMaterial({color: hex, roughness: rough, metalness: 1}));
	},
};

export const shadowed = <T extends THREE.Object3D>(o: T, cast = true, receive = true): T => {
	o.traverse((c) => {
		if ((c as THREE.Mesh).isMesh) {
			c.castShadow = cast;
			c.receiveShadow = receive;
		}
	});
	return o;
};

export const box = (w: number, h: number, d: number, mat: THREE.Material, pivotY = 0.5) => {
	const g = new THREE.BoxGeometry(w, h, d);
	g.translate(0, (pivotY === 0.5 ? 0 : (0.5 - pivotY) * h), 0);
	return shadowed(new THREE.Mesh(g, mat));
};

export const rbox = (w: number, h: number, d: number, r: number, mat: THREE.Material) => {
	// rounded box from an extruded rounded rectangle
	const s = new THREE.Shape();
	const x = -w / 2, y = -h / 2;
	r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3);
	s.moveTo(x + r, y);
	s.lineTo(x + w - r, y);
	s.quadraticCurveTo(x + w, y, x + w, y + r);
	s.lineTo(x + w, y + h - r);
	s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	s.lineTo(x + r, y + h);
	s.quadraticCurveTo(x, y + h, x, y + h - r);
	s.lineTo(x, y + r);
	s.quadraticCurveTo(x, y, x + r, y);
	const g = new THREE.ExtrudeGeometry(s, {depth: d - 2 * r * 0.5, bevelEnabled: true, bevelThickness: r * 0.5, bevelSize: r * 0.5, bevelSegments: 3, curveSegments: 6});
	g.translate(0, 0, -(d - 2 * r * 0.5) / 2);
	return shadowed(new THREE.Mesh(g, mat));
};

export const sphere = (r: number, mat: THREE.Material, seg = 48) => shadowed(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.floor(seg * 0.75)), mat));

export const cyl = (rTop: number, rBot: number, h: number, mat: THREE.Material, seg = 32) => shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat));

/** a cylinder between two points */
export const rod = (a: V3, b: V3, r: number, mat: THREE.Material, seg = 12) => {
	const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
	const d = B.clone().sub(A);
	const m = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat));
	m.position.copy(A.clone().add(B).multiplyScalar(0.5));
	m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
	return m;
};

/** a canvas texture for a bead: solid colour with a stripe so that its rolling reads */
export const beadTexture = (hex: string, stripe: string) => {
	const c = document.createElement('canvas');
	c.width = 512;
	c.height = 256;
	const g = c.getContext('2d')!;
	g.fillStyle = hex;
	g.fillRect(0, 0, 512, 256);
	g.fillStyle = stripe;
	g.fillRect(0, 118, 512, 20);
	g.fillRect(250, 0, 12, 256);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 8;
	return t;
};

export const beadMat = (hex: string, stripe: string) =>
	new THREE.MeshPhysicalMaterial({map: beadTexture(hex, stripe), roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06});

/** an arc-length parametrised 3D path: P(u), u in [0,1] */
export class Path3 {
	pts: V3[] = [];
	cum: number[] = [];
	len = 0;
	constructor(public P: (u: number) => V3, n = 600) {
		let prev: V3 | null = null;
		let acc = 0;
		for (let i = 0; i <= n; i++) {
			const p = P(i / n);
			if (prev) acc += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
			this.pts.push(p);
			this.cum.push(acc);
			prev = p;
		}
		this.len = acc;
	}
	/** point at arclength s */
	at(s: number): V3 {
		s = Math.max(0, Math.min(this.len, s));
		let lo = 0, hi = this.cum.length - 1;
		while (hi - lo > 1) {
			const m = (lo + hi) >> 1;
			if (this.cum[m] <= s) lo = m; else hi = m;
		}
		const t = (s - this.cum[lo]) / Math.max(1e-9, this.cum[hi] - this.cum[lo]);
		const a = this.pts[lo], b = this.pts[hi];
		return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
	}
	tangent(s: number): V3 {
		const e = 0.05;
		const a = this.at(s - e), b = this.at(s + e);
		const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
		const l = Math.hypot(...d) || 1;
		return [d[0] / l, d[1] / l, d[2] / l];
	}
}

export const P = PAL;

/** a thin cylinder that can be re-aimed every frame */
export const unitRod = (r: number, mat: THREE.Material, seg = 8) => shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, seg), mat), true, false);
const _up = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
export const setRod = (m: THREE.Mesh, a: V3, b: V3) => {
	_a.set(...a);
	_b.set(...b);
	const d = _b.clone().sub(_a);
	const len = d.length();
	m.position.copy(_a).add(_b).multiplyScalar(0.5);
	m.scale.set(1, len, 1);
	m.quaternion.setFromUnitVectors(_up, d.multiplyScalar(1 / (len || 1)));
};
