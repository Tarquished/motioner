/* World 4: an isometric city of columns whose heights are pushed by rings that leave the centre on every beat. */
import {BLUE, CORAL, DrawArgs, INK, PAPER, Portal, TAU, clamp01, mixColor} from '../common';
import TL from '../timeline.json';

export const cityPortal = (f: number): Portal => ({x: 960, y: 330 - 14 * Math.sin(f * 0.03) ** 2, r: 70});
const NG = 15; // columns from -NG..NG
const HX = 36;
const HY = 18;
const CY0 = 640;
const RAMP = ['#151847', BLUE, CORAL, PAPER];
const ramp = (t: number) => {
	const x = clamp01(t) * (RAMP.length - 1);
	const i = Math.min(RAMP.length - 2, Math.floor(x));
	return mixColor(RAMP[i], RAMP[i + 1], x - i);
};
const CACHE: {top: string; l: string; r: string}[] = [];
const shade = (q: number) => {
	if (!CACHE[q]) {
		const c = ramp(q / 47);
		CACHE[q] = {top: c, l: mixColor(INK, c, 0.52), r: mixColor(INK, c, 0.74)};
	}
	return CACHE[q];
};

export function drawCity({g, f, lod}: DrawArgs) {
	// a soft blue floor glow
	const glow = g.createRadialGradient(960, CY0, 40, 960, CY0, 900);
	glow.addColorStop(0, 'rgba(47,59,244,0.30)');
	glow.addColorStop(1, 'rgba(47,59,244,0)');
	g.fillStyle = glow;
	g.fillRect(-400, -400, 2720, 1900);
	const beats = TL.city.beats.filter((b) => f - b >= 0 && f - b < 150);
	const step = lod < 0.25 ? 2 : 1;
	for (let i = -NG; i <= NG; i += step)
		for (let j = -NG; j <= NG; j += step) {
			const d = Math.hypot(i, j);
			let h = 16 + 30 * (0.5 + 0.5 * Math.sin(i * 0.5 + f * 0.02) * Math.cos(j * 0.43 - f * 0.017));
			for (const b of beats) {
				const age = f - b;
				const R = age * 0.16;
				h += 105 * Math.min(1, age / 4) * Math.exp(-(((d - R) / 1.7) ** 2)) * Math.exp(-age / 62);
			}
			const x = 960 + (i - j) * HX;
			const y = CY0 + (i + j) * HY;
			const yt = y - h;
			const q = shade(Math.min(47, Math.max(0, Math.round(((h - 12) / 120) * 47))));
			const a = HX * 0.94 * step;
			const b = HY * 0.94 * step;
			g.fillStyle = q.top;
			g.beginPath();
			g.moveTo(x, yt - b);
			g.lineTo(x + a, yt);
			g.lineTo(x, yt + b);
			g.lineTo(x - a, yt);
			g.fill();
			g.fillStyle = q.l;
			g.beginPath();
			g.moveTo(x - a, yt);
			g.lineTo(x, yt + b);
			g.lineTo(x, y + b);
			g.lineTo(x - a, y);
			g.fill();
			g.fillStyle = q.r;
			g.beginPath();
			g.moveTo(x, yt + b);
			g.lineTo(x + a, yt);
			g.lineTo(x + a, y);
			g.lineTo(x, y + b);
			g.fill();
		}
	// the sphere that is the window, hovering over the city with its shadow
	const P = cityPortal(f);
	g.fillStyle = 'rgba(0,0,0,0.38)';
	g.beginPath();
	g.ellipse(960, CY0 + 20, 92 - (330 - P.y) * 0.8, 30, 0, 0, TAU);
	g.fill();
	g.strokeStyle = PAPER;
	g.globalAlpha = 0.22;
	g.lineWidth = 2;
	g.setLineDash([3, 9]);
	g.beginPath();
	g.moveTo(960, P.y + P.r);
	g.lineTo(960, CY0 + 6);
	g.stroke();
	g.setLineDash([]);
	g.globalAlpha = 1;
	g.fillStyle = PAPER;
	g.beginPath();
	g.arc(P.x, P.y, P.r, 0, TAU);
	g.fill();
}
