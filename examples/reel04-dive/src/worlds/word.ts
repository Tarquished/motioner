/* World 0 and 6: the word "motioner." The dot is the portal. */
import {BLUE, CORAL, DrawArgs, ease, INK, lerp, MONO, PAPER, SERIF, clamp01, mixColor, prog, displayFont, TAU, Portal} from '../common';
import TL from '../timeline.json';

const ADV: Record<string, number> = {m: 1166, o: 781, t: 501, i: 315, n: 755, e: 780, r: 480}; // Archivo 800, 125 % width, per 1000 em
const WORD = 'motioner';
export const SZ = 260;
const TRACK = -0.02 * SZ;
export const BL0 = 610;
export const DOT_R = 28;
const GAP = 22;

export const L0 = (() => {
	const offs: number[] = [];
	let x = 0;
	for (const ch of WORD) {
		offs.push(x);
		x += (ADV[ch] * SZ) / 1000 + TRACK;
	}
	const total = x - TRACK;
	const comp = total + GAP + 2 * DOT_R;
	const x0 = 960 - comp / 2;
	return {offs, total, x0, dot: {x: x0 + total + GAP + DOT_R, y: BL0 - DOT_R}};
})();

export const wordPortal = (f: number): Portal => ({x: L0.dot.x, y: L0.dot.y, r: DOT_R, open: f >= TL.word.dot ? ease.backOut()(prog(f, TL.word.dot, TL.word.dot + 14, (x) => x)) : 0});

const SLICES = 9;
const BAND_TOP = BL0 - 0.8 * SZ;
const BAND_H = Math.round((0.86 * SZ) / SLICES);

export function drawWord({g, f, nested, end}: DrawArgs) {
	const T = TL.word;
	const settled = nested || end;
	g.font = displayFont(SZ);
	g.textBaseline = 'alphabetic';
	g.textAlign = 'left';
	g.letterSpacing = '0px';
	const done = settled || f > T.slices[1] + 8;
	const tre = !settled && f >= T.tremor ? 9 * Math.exp(-(f - T.tremor) / 7) * Math.cos((f - T.tremor) * 0.85) : 0;
	const y = BL0 + tre;
	// a thin baseline rule that draws itself under the word
	const rule = settled ? 1 : prog(f, 40, 100, ease.out);
	g.fillStyle = PAPER;
	g.globalAlpha = 0.18;
	g.fillRect(L0.x0, BL0 + 34, (L0.total + GAP + 2 * DOT_R) * rule, 2);
	g.globalAlpha = 1;
	if (done) {
		g.fillStyle = PAPER;
		for (let i = 0; i < WORD.length; i++) g.fillText(WORD[i], L0.x0 + L0.offs[i], y);
	} else {
		for (let i = 0; i < WORD.length; i++) {
			const gx = L0.x0 + L0.offs[i];
			const w = (ADV[WORD[i]] * SZ) / 1000 + 30;
			// a letter whose slices have all arrived is drawn whole (no seams between slices)
			if (ease.out(clamp01((f - (T.slices[0] + Math.abs(i - 3.5) * 5 + (SLICES - 1) * 1.4)) / 38)) > 0.9995) {
				g.fillStyle = PAPER;
				g.fillText(WORD[i], gx, y);
				continue;
			}
			for (let j = 0; j < SLICES; j++) {
				const t0 = T.slices[0] + Math.abs(i - 3.5) * 5 + j * 1.4;
				const dir = i < 4 ? -1 : 1;
				const drawAt = (ff: number, alpha: number, tint: boolean) => {
					const e = ease.out(clamp01((ff - t0) / 38));
					const off = dir * (1300 + 110 * j) * (1 - e);
					g.save();
					g.beginPath();
					g.rect(gx + off - 12, BAND_TOP + j * BAND_H, w, BAND_H);
					g.clip();
					g.globalAlpha = alpha;
					g.fillStyle = tint ? mixColor(PAPER, CORAL, clamp01((1 - e) * 1.6)) : PAPER;
					g.fillText(WORD[i], gx + off, y);
					g.restore();
					return e;
				};
				const e = drawAt(f, 1, true);
				if (e < 0.995) drawAt(f - 2, 0.28, true);
			}
		}
	}
	g.globalAlpha = 1;
	// the dot: pops with an overshoot and sends a ring out
	const dp = settled ? 1 : ease.backOut()(prog(f, T.dot, T.dot + 14, (x) => x));
	if (settled || f >= T.dot) {
		g.fillStyle = CORAL;
		g.beginPath();
		g.arc(L0.dot.x, L0.dot.y, DOT_R * dp, 0, TAU);
		g.fill();
	}
	if (!settled && f >= T.dot && f < T.dot + 40) {
		const t = (f - T.dot) / 40;
		g.strokeStyle = CORAL;
		g.globalAlpha = 1 - t;
		g.lineWidth = 3;
		g.beginPath();
		g.arc(L0.dot.x, L0.dot.y, DOT_R + 190 * ease.out(t), 0, TAU);
		g.stroke();
		g.globalAlpha = 1;
	}
	if (end) drawEnd(g, f);
}

function drawEnd(g: CanvasRenderingContext2D, f: number) {
	const E = TL.end;
	// pulses from the dot on the beat
	for (const p of E.pulses) {
		const t = (f - p) / 34;
		if (t < 0 || t > 1) continue;
		g.strokeStyle = CORAL;
		g.globalAlpha = 0.8 * (1 - t);
		g.lineWidth = 2.5;
		g.beginPath();
		g.arc(L0.dot.x, L0.dot.y, DOT_R + 90 * ease.out(t), 0, TAU);
		g.stroke();
	}
	g.globalAlpha = 1;
	// the tagline slides up out of a mask
	const t = ease.out(clamp01((f - E.tagline) / 24));
	if (t > 0) {
		g.save();
		g.font = `italic 400 92px ${SERIF}`;
		g.textAlign = 'center';
		g.fillStyle = PAPER;
		g.beginPath();
		g.rect(0, BL0 + 90, 1920, 110);
		g.clip();
		g.fillText('motion, all the way down.', 960, BL0 + 168 + (1 - t) * 120);
		g.restore();
	}
	const t2 = prog(f, E.footer, E.footer + 20, ease.out);
	if (t2 > 0) {
		g.font = `500 17px ${MONO}`;
		g.letterSpacing = '3.4px';
		g.textAlign = 'center';
		g.fillStyle = PAPER;
		g.globalAlpha = 0.6 * t2;
		g.fillText('EVERY FRAME AND EVERY SOUND WRITTEN IN CODE', 960, BL0 + 250 + (1 - t2) * 10);
		g.globalAlpha = 1;
		g.letterSpacing = '0px';
	}
	void BLUE;
	void INK;
	void lerp;
}
