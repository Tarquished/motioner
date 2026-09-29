/* World 1: a ridgeline of sound (every row is the spectrum a moment ago) under a sun that is a window. */
import {CORAL, DrawArgs, hash, INK, PAPER, TAU, Portal, beatPulse} from '../common';

export const SUN: Portal = {x: 960, y: 330, r: 70};
const ROWS = 62;
const Y0 = 372;
const DY = 17;
const X0 = -440;
const X1 = 2360;
const STEP = 8;
const NB = 9;

const spec = (x: number, tau: number) => {
	let v = 0;
	for (let k = 0; k < NB; k++) {
		const c = 960 + (k - 4) * 118 + 46 * Math.sin(tau * 0.013 + k * 1.7);
		const w = 30 + 12 * (k % 3);
		const h = 0.32 + 0.68 * Math.abs(Math.sin(tau * (0.021 + 0.004 * k) + k * 2.3));
		const d = (x - c) / w;
		v += h * Math.exp(-d * d);
	}
	return v;
};

export function drawRidge({g, f, lod}: DrawArgs) {
	const rows = lod < 0.3 ? 30 : ROWS;
	const dy = lod < 0.3 ? DY * 2 : DY;
	g.lineJoin = 'round';
	g.lineWidth = 3.2;
	g.strokeStyle = INK;
	for (let row = 0; row < rows; row++) {
		const y0 = Y0 + row * dy;
		const tau = f - row * 2.4;
		const pump = 1 + 0.8 * beatPulse(tau, 9);
		const gain = 0.55 + 0.6 * (row / rows);
		const top = new Path2D();
		for (let x = X0; x <= X1; x += STEP) {
			const env = Math.exp(-(((x - 960) / 470) ** 2));
			const jit = (hash(Math.floor(x / 9) * 0.73 + Math.floor(tau / 1.5) * 1.31) - 0.5) * 0.24 * env;
			const y = y0 - 215 * env * (spec(x, tau) * 0.8 + jit) * pump * gain;
			if (x === X0) top.moveTo(x, y);
			else top.lineTo(x, y);
		}
		const poly = new Path2D(top);
		poly.lineTo(X1, y0 + 2600);
		poly.lineTo(X0, y0 + 2600);
		poly.closePath();
		g.fillStyle = CORAL;
		g.fill(poly);
		g.stroke(top);
	}
	// the sun: two halo rings on every 2nd beat, a dial of ticks, and the paper disc that is the window
	for (let k = 0; k < 2; k++) {
		const p = (((f + k * 30) % 60) + 60) % 60 / 60;
		g.globalAlpha = 0.7 * (1 - p);
		g.strokeStyle = PAPER;
		g.lineWidth = 3;
		g.beginPath();
		g.arc(SUN.x, SUN.y, SUN.r + 12 + 240 * (1 - (1 - p) * (1 - p)), 0, TAU);
		g.stroke();
	}
	g.globalAlpha = 1;
	g.strokeStyle = INK;
	g.lineWidth = 2.4;
	for (let k = 0; k < 48; k++) {
		const a = (k / 48) * TAU + f * 0.004;
		const l = k % 4 === 0 ? 20 : 10;
		g.beginPath();
		g.moveTo(SUN.x + Math.cos(a) * (SUN.r + 20), SUN.y + Math.sin(a) * (SUN.r + 20));
		g.lineTo(SUN.x + Math.cos(a) * (SUN.r + 20 + l), SUN.y + Math.sin(a) * (SUN.r + 20 + l));
		g.stroke();
	}
	g.fillStyle = PAPER;
	g.beginPath();
	g.arc(SUN.x, SUN.y, SUN.r, 0, TAU);
	g.fill();
}
