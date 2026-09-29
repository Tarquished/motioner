/* World 3: a swirl of light around a black core. Every particle's position is a function of time only. */
import {BLUE, CORAL, DrawArgs, hash, hit, INK, PAPER, Portal, TAU, YEL} from '../common';
import TL from '../timeline.json';

export const CORE: Portal = {x: 960, y: 540, r: 52};
const N = 2600;
type P = {r0: number; arm: number; eps: number; th0: number; w: number; ph: number; col: number; per: number; haze: boolean};
const PS: P[] = [];
for (let i = 0; i < N; i++) {
	const a = hash(i * 1.31);
	const b = hash(i * 2.17);
	const c = hash(i * 3.7);
	const r0 = 95 + 1060 * Math.pow(b, 0.8);
	PS.push({
		r0,
		arm: Math.floor(a * 3),
		eps: (c - 0.5) * (0.3 + 0.35 * (r0 / 1100)),
		th0: TAU * hash(i * 4.4),
		w: 0.055 / Math.pow(0.15 + r0 / 200, 0.8),
		ph: hash(i * 5.3),
		col: hash(i * 7.9) < 0.6 ? 0 : hash(i * 7.9) < 0.86 ? 1 : 2,
		per: 200 + 200 * hash(i * 9.1),
		haze: hash(i * 8.3) < 0.24,
	});
}
const COLS = [PAPER, CORAL, YEL];
const OMEGA = 0.012;

const pos = (p: P, t: number) => {
	const fr = (p.ph + t / p.per) % 1;
	const r = p.r0 * (1 - 0.55 * fr);
	const th = p.haze ? p.th0 + p.w * t : (p.arm * TAU) / 3 + 1.55 * Math.log(r / 90) + OMEGA * t + p.eps;
	return {x: CORE.x + Math.cos(th) * r, y: CORE.y + Math.sin(th) * r, fr};
};

export function drawFlow({g, f, lod}: DrawArgs) {
	// guide circles and the shock rings that leave the core on the beat
	g.strokeStyle = PAPER;
	g.lineWidth = 1.5;
	g.globalAlpha = 0.14;
	for (let r = 200; r <= 1100; r += 180) {
		g.beginPath();
		g.arc(CORE.x, CORE.y, r, 0, TAU);
		g.stroke();
	}
	for (const b of TL.flow.beats) {
		const age = f - b;
		if (age < 0 || age > 90) continue;
		const t = age / 90;
		g.globalAlpha = 0.55 * (1 - t);
		g.lineWidth = 3;
		g.beginPath();
		g.arc(CORE.x, CORE.y, CORE.r + 20 + 900 * (1 - (1 - t) * (1 - t)), 0, TAU);
		g.stroke();
	}
	g.lineCap = 'round';
	const n = Math.max(120, Math.floor(N * lod));
	for (let ci = 0; ci < 3; ci++) {
		for (let bucket = 0; bucket < 2; bucket++) {
			g.beginPath();
			for (let i = 0; i < n; i++) {
				const p = PS[i];
				if (p.col !== ci) continue;
				const q = pos(p, f);
				const fadeIn = Math.min(q.fr / 0.08, (1 - q.fr) / 0.08, 1);
				if (fadeIn < 0.5 === (bucket === 0)) continue;
				const q0 = pos(p, f - 6);
				if (q0.fr > q.fr) continue; // wrapped: this particle was reborn at the rim within the last frames
				g.moveTo(q0.x, q0.y);
				g.lineTo(q.x, q.y);
			}
			g.globalAlpha = bucket === 0 ? 0.9 : 0.35;
			g.strokeStyle = COLS[ci];
			g.lineWidth = ci === 0 ? 2.4 : 3;
			g.stroke();
		}
	}
	g.globalAlpha = 1;
	// four comets on their own orbits, each with a long fading tail
	if (lod > 0.4) {
		const COM = [
			{R: 330, w: 0.011, ph: 0.4, col: YEL},
			{R: 520, w: -0.008, ph: 2.6, col: PAPER},
			{R: 700, w: 0.0065, ph: 4.4, col: CORAL},
			{R: 880, w: -0.005, ph: 1.3, col: YEL},
		];
		for (const c of COM) {
			const ang = c.ph + c.w * f;
			const sgn = Math.sign(c.w);
			g.lineCap = 'round';
			g.strokeStyle = c.col;
			for (let j = 0; j < 40; j++) {
				const a0 = ang - sgn * j * 0.011;
				const a1 = ang - sgn * (j + 1) * 0.011;
				g.globalAlpha = 0.9 * (1 - j / 40) ** 1.5;
				g.lineWidth = 7 * (1 - j / 46);
				g.beginPath();
				g.moveTo(CORE.x + Math.cos(a0) * c.R, CORE.y + Math.sin(a0) * c.R);
				g.lineTo(CORE.x + Math.cos(a1) * c.R, CORE.y + Math.sin(a1) * c.R);
				g.stroke();
			}
			g.globalAlpha = 1;
			const hx = CORE.x + Math.cos(ang) * c.R;
			const hy = CORE.y + Math.sin(ang) * c.R;
			const gg = g.createRadialGradient(hx, hy, 2, hx, hy, 46);
			gg.addColorStop(0, 'rgba(255,255,255,0.9)');
			gg.addColorStop(1, 'rgba(255,255,255,0)');
			g.fillStyle = gg;
			g.beginPath();
			g.arc(hx, hy, 46, 0, TAU);
			g.fill();
			g.fillStyle = PAPER;
			g.beginPath();
			g.arc(hx, hy, 8, 0, TAU);
			g.fill();
		}
	}
	// the core: a glow, a ring on the beat and the black disc that is the window
	const pulse = hit(((f % 30) + 30) % 30, 8);
	const gr = g.createRadialGradient(CORE.x, CORE.y, CORE.r, CORE.x, CORE.y, CORE.r + 150);
	gr.addColorStop(0, 'rgba(255,84,54,0.85)');
	gr.addColorStop(1, 'rgba(255,84,54,0)');
	g.fillStyle = gr;
	g.beginPath();
	g.arc(CORE.x, CORE.y, CORE.r + 150, 0, TAU);
	g.fill();
	g.strokeStyle = CORAL;
	g.lineWidth = 4 + 3 * pulse;
	g.beginPath();
	g.arc(CORE.x, CORE.y, CORE.r + 8 + 6 * pulse, 0, TAU);
	g.stroke();
	g.fillStyle = INK;
	g.beginPath();
	g.arc(CORE.x, CORE.y, CORE.r, 0, TAU);
	g.fill();
	void BLUE;
}
