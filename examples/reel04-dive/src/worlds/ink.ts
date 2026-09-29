/* World 5: big drops of ink drift across the paper, string together, and are drawn into one black drop (the last window). */
import {CORAL, DrawArgs, ease, hash, INK, MONO, PAPER, Portal, TAU, clamp01, lerp, prog} from '../common';
import TL from '../timeline.json';

const RAD = [96, 80, 70, 62, 54, 48, 42, 38, 34, 30, 26, 24, 22, 20, 18, 16, 14, 13, 12, 11]; // sum of r^2 = 195^2
const MERGED = (f: number) => Math.sqrt(RAD.reduce((a, r, k) => a + r * r * ease.inOut(clamp01((f - TL.ink.merge[k]) / TL.ink.mergeDur)), 0));
/** the window is the merged drop: it opens as the drops are drawn in */
export const dropPortal = (f: number): Portal => ({x: 960, y: 540, r: 195, open: Math.min(1, MERGED(f) / 195)});
const NBALL = RAD.length;
type Orb = {ax: number; ay: number; wx: number; wy: number; px: number; py: number};
const ORBS: Orb[] = RAD.map((_, k) => ({
	ax: 360 + 460 * hash(k * 1.7 + 0.3),
	ay: 190 + 230 * hash(k * 2.3 + 0.9),
	wx: 0.0055 + 0.009 * hash(k * 3.1 + 0.2),
	wy: 0.0065 + 0.008 * hash(k * 4.9 + 0.6),
	px: TAU * hash(k * 5.3 + 0.1),
	py: TAU * hash(k * 6.7 + 0.4),
}));

export const ballPos = (k: number, f: number) => {
	const o = ORBS[k];
	const x = 960 + o.ax * Math.sin(o.wx * f + o.px);
	const y = 540 + o.ay * Math.sin(o.wy * f + o.py);
	const c = ease.inOut(clamp01((f - TL.ink.merge[k]) / TL.ink.mergeDur));
	const wob = 1 + 0.05 * Math.sin(f * 0.07 + k * 2);
	return {x: lerp(x, 960, c), y: lerp(y, 540, c), r: RAD[k] * wob};
};

let FIELD: HTMLCanvasElement | null = null;

export function drawInk({g, f, s, tx, ty, bbox, lod}: DrawArgs) {
	// a fine dot grid like graph paper
	g.fillStyle = INK;
	g.globalAlpha = 0.13;
	if (lod > 0.3) for (let y = -300; y <= 1400; y += 60) for (let x = -400; x <= 2400; x += 60) g.fillRect(x - 1.5, y - 1.5, 3, 3);
	g.globalAlpha = 1;
	const pts = Array.from({length: NBALL}, (_, k) => ballPos(k, f));
	// tension threads between drops that are close, and readouts on the big ones
	g.lineWidth = 1.6;
	g.strokeStyle = INK;
	for (let a = 0; a < NBALL; a++)
		for (let b = a + 1; b < NBALL; b++) {
			const d = Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y);
			const lim = 300 + pts[a].r + pts[b].r;
			if (d < lim) {
				g.globalAlpha = 0.42 * (1 - d / lim);
				g.beginPath();
				g.moveTo(pts[a].x, pts[a].y);
				g.lineTo(pts[b].x, pts[b].y);
				g.stroke();
			}
		}
	g.globalAlpha = 1;
	// ripples that leave the centre every time a drop arrives
	for (let k = 0; k < NBALL; k += 3) {
		const t = (f - TL.ink.merge[k] - TL.ink.mergeDur) / 50;
		if (t < 0 || t > 1) continue;
		g.strokeStyle = CORAL;
		g.globalAlpha = 0.9 * (1 - t);
		g.lineWidth = 3.5;
		g.beginPath();
		g.arc(960, 540, 235 + 520 * ease.out(t), 0, TAU);
		g.stroke();
	}
	g.globalAlpha = 1;
	// the ink itself: a metaball field rendered in screen space at half resolution, edge from the field gradient
	const x0 = Math.max(0, Math.floor(bbox.x0 / 2));
	const y0 = Math.max(0, Math.floor(bbox.y0 / 2));
	const x1 = Math.min(960, Math.ceil(bbox.x1 / 2));
	const y1 = Math.min(540, Math.ceil(bbox.y1 / 2));
	const w = x1 - x0;
	const h = y1 - y0;
	if (w < 1 || h < 1) return;
	if (!FIELD) {
		FIELD = document.createElement('canvas');
		FIELD.width = 960;
		FIELD.height = 540;
	}
	const fc = FIELD.getContext('2d')!;
	const img = fc.createImageData(w, h);
	const d = img.data;
	const bx = pts.map((p) => p.x * s + tx);
	const by = pts.map((p) => p.y * s + ty);
	const br2 = pts.map((p) => p.r * s * (p.r * s));
	for (let y = 0; y < h; y++) {
		const py = (y0 + y) * 2 + 1;
		for (let x = 0; x < w; x++) {
			const px = (x0 + x) * 2 + 1;
			let v = 0;
			let gx = 0;
			let gy = 0;
			for (let k = 0; k < NBALL; k++) {
				const dx = px - bx[k];
				const dy = py - by[k];
				const d2 = dx * dx + dy * dy + 1;
				v += br2[k] / d2;
				const q = (-2 * br2[k]) / (d2 * d2);
				gx += q * dx;
				gy += q * dy;
			}
			const sd = (v - 1) / (Math.hypot(gx, gy) + 1e-9) / 2; // distance to the edge in raster pixels (+ inside)
			const a = clamp01(0.5 + sd);
			const o = (y * w + x) * 4;
			d[o] = 15;
			d[o + 1] = 14;
			d[o + 2] = 17;
			d[o + 3] = a * 255;
		}
	}
	fc.putImageData(img, 0, 0);
	g.save();
	g.setTransform(1, 0, 0, 1, 0, 0);
	g.imageSmoothingEnabled = true;
	g.drawImage(FIELD, 0, 0, w, h, x0 * 2, y0 * 2, w * 2, h * 2);
	g.restore();
	// coral centres and coordinate readouts on the biggest drops
	g.fillStyle = CORAL;
	for (let k = 0; k < NBALL; k++) {
		g.beginPath();
		g.arc(pts[k].x, pts[k].y, 5, 0, TAU);
		g.fill();
	}
	if (lod > 0.5) {
		g.font = `500 15px ${MONO}`;
		g.letterSpacing = '1.5px';
		g.textAlign = 'left';
		g.fillStyle = INK;
		g.globalAlpha = 0.7 * (1 - prog(f, TL.ink.merge[0], TL.ink.merge[0] + 60));
		for (let k = 0; k < 4; k++) g.fillText(`${(pts[k].x / 1920).toFixed(2)} ${(pts[k].y / 1080).toFixed(2)}`, pts[k].x + pts[k].r + 14, pts[k].y - pts[k].r * 0.6);
		g.globalAlpha = 1;
		g.letterSpacing = '0px';
	}
	void PAPER;
}
