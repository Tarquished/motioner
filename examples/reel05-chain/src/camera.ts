/* One continuous camera. Waypoints (position, look-at, lens, aperture) are written against the moving objects of the machine and joined by
 * monotone cubic (PCHIP) curves, so the path is smooth and never overshoots. */
import {V3, lerp} from './base';
import {links} from './chain';

export type Cam = {pos: V3; look: V3; fov: number; aperture: number; focusDist?: number; shadowR: number; roll?: number};

type W = {f: number; pos: V3; look: V3; fov: number; ap: number; sr?: number};

const [tick, roll, top, lau, cr, gr, mb, lt]: any[] = links;
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

const wps: W[] = [];
// absolute waypoints were authored for an earlier layout: shift them along x by the change of the object they frame
const DXD = lau.buttonPos[0] - 97.0; // launch, button, flood
const DXM = mb.toothX2() - 214.65; // end of the music box
const DXL = lt.xs[0] - 235.7; // the word
const W_ = (f: number, pos: V3, look: V3, fov = 30, ap = 0, sr = 30) => wps.push({f, pos, look, fov, ap, sr});
const Wx = (dx: number, f: number, pos: V3, look: V3, fov = 30, ap = 0, sr = 30) => W_(f, [pos[0] + dx, pos[1], pos[2]], [look[0] + dx, look[1], look[2]], fov, ap, sr);

// A. TICK: low and close, shallow focus on the bead
W_(0, [4.6, 8.4, 11.5], [1.0, 6.9, 0], 25, 0.12, 14);
W_(30, [4.3, 8.3, 11.0], [1.0, 6.9, 0], 25, 0.12, 14);
W_(60, [4.0, 8.2, 10.6], [1.6, 6.85, 0], 25, 0.1, 14);

// B. ROLL: follow the bead, leading it
const B = (f: number): V3 => roll.beadAt(f);
W_(75, add(B(75), [3, 1.8, 11]), add(B(75), [2.2, -0.2, 0]), 26, 0.1, 18);
W_(105, add(B(105), [2.5, 2.4, 12.5]), add(B(105), [3, -0.4, 0]), 27, 0.06, 22);
W_(135, add(B(135), [1, 3.4, 14]), add(B(135), [4, -0.6, 0]), 28, 0.03, 26);
W_(170, add(B(170), [-2, 4.6, 15]), add(B(170), [6, -0.6, 0]), 30, 0, 30);
W_(205, add(B(205), [-4, 5.0, 17]), add(B(205), [9, 0.6, 0]), 32, 0, 32);

// C. TOPPLE: alongside the wave head, rising and receding as the dominoes grow
const H = (f: number): V3 => top.focus(f);
W_(240, add(H(240), [-3, 4.5, 15]), add(H(240), [6, 0.6, 0]), 32, 0, 34);
W_(290, add(H(290), [-7, 7.5, 21]), add(H(290), [7, 1.2, 0]), 32, 0, 40);
W_(345, add(H(345), [-11, 11, 28]), add(H(345), [8, 1.8, 0]), 32, 0, 48);
W_(400, add(H(400), [-15, 15, 37]), add(H(400), [9, 3, 0]), 32, 0, 56);
W_(455, add(H(455), [-18, 18, 46]), add(H(455), [9, 4, 0]), 33, 0, 64);
Wx(DXD, 496, [70, 12, 30], [84, 6, 3], 34, 0, 50);

// D. LAUNCH: up into the dark after the ball, and down to the button
Wx(DXD, 512, [72, 11, 33], [88, 8, 6], 33, 0, 50);
Wx(DXD, 535, [80, 11.5, 34], [92.5, 15, 8.5], 26, 0, 50);
Wx(DXD, 552, [84, 13.5, 30], [93.7, 15.3, 9.3], 21, 0, 50);
Wx(DXD, 572, [87, 11, 32], [95, 8.5, 10.5], 24, 0, 44);
Wx(DXD, 590, [89, 7, 32], [96.6, 3.6, 11.5], 26, 0, 40);
Wx(DXD, 600, [88, 6.4, 33], [97, 2.0, 11.7], 26, 0, 36);

// E. FLOOD: pull up and back to see the whole machine, then run to the cradle
Wx(DXD, 612, [88, 9, 39], [97, 3.2, 11.7], 29, 0, 60);
Wx(DXD, 640, [84, 46, 96], [88, 1, 6], 37, 0, 130);
Wx(DXD, 656, [92, 47, 98], [95, 0, 8], 37, 0, 130);
W_(690, [cr.O[0] - 9, 22, cr.O[2] + 53], [cr.O[0] + 6, 12, cr.O[2]], 32, 0, 60);

// F. TURN: the gears, then down the wire
const G = gr.gears;
const OZ = cr.O[2];
const P4 = G[3].c;
W_(706, [G[0].c[0] - 10, 17, OZ + 42], [G[0].c[0] + 2.5, 14, OZ], 30, 0, 50);
W_(745, [G[1].c[0] - 8, 19, OZ + 34], [(G[1].c[0] + G[2].c[0]) / 2, 17.5, OZ], 28, 0, 40);
W_(800, [G[2].c[0] - 8, 24, OZ + 38], [(G[2].c[0] + P4[0]) / 2 - 1, 22, OZ], 26, 0.05, 36);
W_(830, [P4[0] - 6, P4[1] + 1, OZ + 36], [P4[0] + 1, P4[1] - 2, OZ + 1], 25, 0.1, 36);
W_(861, [gr.leverPivot[0] - 12, 21, OZ + 30], [gr.leverPivot[0] - 5, 21.2, OZ + 1], 24, 0.12, 30);
W_(884, [gr.wireX - 2, 14, mb.zc + 34], [gr.wireX, 8, mb.zc + 3], 26, 0.25, 30);

// G. PLAY: macro on the comb, following the tooth being played, then a slow pull-back
const toothAvg = (f: number) => {
	let sw = 0, sx = 0;
	for (const n of mb.notes) {
		const d = f + 12 - n.f;
		const w = Math.exp(-(d * d) / (2 * 55 * 55));
		sw += w;
		sx += w * mb.toothX[n.tooth];
	}
	return sw > 1e-6 ? sx / sw : mb.toothX[0];
};
const MB: [number, V3, V3, number, number][] = [
	[906, [-8, 7.6, 27], [1, 5.4, 5], 24, 0.32],
	[975, [-8, 8.4, 25], [1, 5.4, 5], 24, 0.3],
	[1030, [-5, 15, 24], [0, 5.3, 7], 27, 0.2],
	[1085, [-3, 22, 20], [1, 5.2, 9], 29, 0.12],
	[1140, [14, 12, 26], [-2, 5.4, 8], 28, 0.15],
	[1195, [17, 8, 21], [-6, 5.5, 9], 28, 0.08],
	[1250, [16, 9, 30], [-4, 5.3, 9], 29, 0.06],
];
for (const [f, po, lo, fovv, apv] of MB) {
	const x = toothAvg(f);
	W_(f, [x + po[0], po[1], mb.zc + po[2]], [x + lo[0], lo[1], mb.zc + lo[2]], fovv, apv, 40);
}
Wx(DXM, 1300, [196, 20, 58], [206, 5, 13], 32, 0, 50);
Wx(DXM, 1352, [214, 11, 45], [214.5, 5.2, 16], 26, 0.1, 40);
Wx(DXM, 1382, [218, 9, 40], [218.5, 5.5, 16.5], 24, 0.2, 36);
Wx(DXM, 1396, [222, 7.5, 36], [224, 3.5, 17], 26, 0.15, 36);

// H. RISE: with the bead along the letters, then the whole word
const LB = (f: number): V3 => lt.focus(f);
Wx(DXL, 1420, [227, 6.2, 39], [230, 3, 17], 28, 0.05, 40);
Wx(DXL, 1464, [238, 7.5, 47], [243, 4.4, 14], 30, 0, 50);
Wx(DXL, 1520, [256, 9.5, 58], [258, 4.6, 13.5], 31, 0, 60);
Wx(DXL, 1585, [274, 10, 68], [271, 4.8, 13], 32, 0, 80);
Wx(DXL, 1640, [266, 8.4, 98], [265.5, 4.6, 12.7], 31, 0, 100);
Wx(DXL, 1800, [266, 8.0, 92], [265.5, 4.6, 12.7], 31, 0, 100);
void LB;
void lerp;

// PCHIP on each scalar channel
const chan = (get: (w: W) => number) => {
	const n = wps.length;
	const x = wps.map((w) => w.f);
	const y = wps.map(get);
	const h: number[] = [], d: number[] = [];
	for (let i = 0; i < n - 1; i++) {
		h.push(x[i + 1] - x[i]);
		d.push((y[i + 1] - y[i]) / h[i]);
	}
	const m: number[] = new Array(n).fill(0);
	m[0] = d[0];
	m[n - 1] = d[n - 2];
	for (let i = 1; i < n - 1; i++) {
		if (d[i - 1] * d[i] <= 0) m[i] = 0;
		else {
			const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
			m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
		}
	}
	return (f: number) => {
		if (f <= x[0]) return y[0];
		if (f >= x[n - 1]) return y[n - 1];
		let k = 0;
		while (k < n - 2 && f > x[k + 1]) k++;
		const t = (f - x[k]) / h[k];
		const h00 = 2 * t ** 3 - 3 * t ** 2 + 1, h10 = t ** 3 - 2 * t ** 2 + t, h01 = -2 * t ** 3 + 3 * t ** 2, h11 = t ** 3 - t ** 2;
		return h00 * y[k] + h10 * h[k] * m[k] + h01 * y[k + 1] + h11 * h[k] * m[k + 1];
	};
};
const px = chan((w) => w.pos[0]), py = chan((w) => w.pos[1]), pz = chan((w) => w.pos[2]);
const lx = chan((w) => w.look[0]), ly = chan((w) => w.look[1]), lz = chan((w) => w.look[2]);
const fv = chan((w) => w.fov), ap = chan((w) => w.ap), sr = chan((w) => w.sr ?? 40);

export const camAt = (f: number): Cam => ({pos: [px(f), py(f), pz(f)], look: [lx(f), ly(f), lz(f)], fov: fv(f), aperture: Math.max(0, ap(f)), shadowR: sr(f)});

/** project a world point to the 1920x1080 frame at frame f (no lens jitter) */
export const project = (f: number, p: V3): {x: number; y: number; z: number} => {
	const c = camAt(f);
	const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
	const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
	const norm = (a: V3): V3 => {
		const l = Math.hypot(...a) || 1;
		return [a[0] / l, a[1] / l, a[2] / l];
	};
	const fwd = norm(sub(c.look, c.pos));
	const right = norm(cross(fwd, [0, 1, 0]));
	const up = cross(right, fwd);
	const d = sub(p, c.pos);
	const z = dot(d, fwd);
	const t = Math.tan((c.fov * Math.PI) / 360);
	const nx = dot(d, right) / z / (t * (1920 / 1080));
	const ny = dot(d, up) / z / t;
	return {x: ((nx + 1) / 2) * 1920, y: ((1 - ny) / 2) * 1080, z};
};
