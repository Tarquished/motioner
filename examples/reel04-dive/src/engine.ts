import {CORAL, CX, CY, DrawArgs, ease, H, INK, MONO, PAPER, prog, RD, TAU, W} from './common';
import {Cam, cameraAt, zoomRate} from './camera';
import TL from './timeline.json';
import {NW, WORLDS} from './worlds';

type Box = {x0: number; y0: number; x1: number; y1: number};

const drawTree = (g: CanvasRenderingContext2D, i: number, f: number, s: number, tx: number, ty: number, bbox: Box) => {
	const w = WORLDS[i];
	const P = w.portal(f);
	let child: {cx: number; cy: number; R: number; covers: boolean} | null = null;
	if (P) {
		const cx = s * P.x + tx;
		const cy = s * P.y + ty;
		const R = s * P.r * (P.open ?? 1);
		const inter = cx + R > bbox.x0 && cx - R < bbox.x1 && cy + R > bbox.y0 && cy - R < bbox.y1;
		if (inter && R > 1 && (P.open ?? 1) > 0.02) {
			const far = Math.max(Math.hypot(cx - bbox.x0, cy - bbox.y0), Math.hypot(cx - bbox.x1, cy - bbox.y0), Math.hypot(cx - bbox.x0, cy - bbox.y1), Math.hypot(cx - bbox.x1, cy - bbox.y1));
			child = {cx, cy, R, covers: R >= far};
		}
	}
	if (!child || !child.covers) {
		g.save();
		g.setTransform(s, 0, 0, s, tx, ty);
		g.fillStyle = w.bg;
		g.fillRect(-5000, -5000, 11920, 11080);
		const a: DrawArgs = {g, f, s, bbox, nested: i > 0, end: i === NW, lod: Math.min(1, Math.max(0.1, s / 0.25)), tx, ty};
		w.draw(a);
		if (P) drawWindowFx(g, i, f, P);
		g.restore();
	}
	if (child && P) {
		const k = P.r / RD;
		const nb: Box = {x0: Math.max(bbox.x0, child.cx - child.R), y0: Math.max(bbox.y0, child.cy - child.R), x1: Math.min(bbox.x1, child.cx + child.R), y1: Math.min(bbox.y1, child.cy + child.R)};
		g.save();
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.beginPath();
		g.arc(child.cx, child.cy, child.R, 0, TAU);
		g.clip();
		drawTree(g, i + 1, f, s * k, s * (P.x - CX * k) + tx, s * (P.y - CY * k) + ty, nb);
		g.restore();
	}
};

/* the telegraph before a dive (rings from the window) and the callout that names what is behind it */
const CALL = [
	{ang: Math.PI / 2, dir: -1},
	{ang: -Math.PI / 2, dir: 1},
	{ang: -Math.PI / 4, dir: 1},
	{ang: -Math.PI / 4, dir: 1},
	{ang: -Math.PI / 4, dir: 1},
	{ang: -Math.PI / 4, dir: 1},
];
const drawWindowFx = (g: CanvasRenderingContext2D, i: number, f: number, P: {x: number; y: number; r: number; open?: number}) => {
	if (i >= NW) return;
	const w = WORLDS[i];
	const S = TL.S[i];
	for (let k = 0; k < 2; k++) {
		const t = (f - (S - 16 + k * 9)) / 36;
		if (t < 0 || t > 1) continue;
		g.strokeStyle = w.accent;
		g.globalAlpha = 0.9 * (1 - t);
		g.lineWidth = 3.2;
		g.beginPath();
		g.arc(P.x, P.y, P.r + 34 + 300 * ease.out(t), 0, TAU);
		g.stroke();
	}
	g.globalAlpha = 1;
	const from = i === 0 ? TL.word.dot + 14 : TL.A[i] + 8;
	const a = prog(f, from, from + 22, ease.out) * (1 - prog(f, S - 6, S + 8));
	if (a <= 0.01) return;
	const c = CALL[i];
	const dx = Math.cos(c.ang);
	const dy = Math.sin(c.ang);
	const x0 = P.x + dx * (P.r + 12);
	const y0 = P.y + dy * (P.r + 12);
	const x1 = P.x + dx * (P.r + 12 + 90 * a);
	const y1 = P.y + dy * (P.r + 12 + 90 * a);
	g.save();
	g.globalAlpha = a;
	g.strokeStyle = w.accent;
	g.lineWidth = 2;
	g.beginPath();
	g.moveTo(x0, y0);
	g.lineTo(x1, y1);
	g.lineTo(x1 + c.dir * 40 * a, y1);
	g.stroke();
	g.font = `500 17px ${MONO}`;
	g.letterSpacing = '2px';
	g.textAlign = 'left';
	const label = `→ ${w.next}   ×${Math.round(RD / P.r)}`;
	const tw = g.measureText(label).width;
	const bx = c.dir > 0 ? x1 + 40 * a + 12 : x1 - 40 * a - 12 - tw;
	g.fillStyle = w.hudDark ? PAPER : INK;
	g.fillRect(bx - 8, y1 - 21, tw + 16, 30);
	g.fillStyle = w.hudDark ? INK : PAPER;
	g.fillText(label, bx, y1);
	g.restore();
};

/** which world is under a screen point (walks the chain of windows) */
export const worldAt = (cam: Cam, f: number, px: number, py: number) => {
	let i = cam.i;
	let s = cam.s;
	let tx = cam.q.x * (1 - s);
	let ty = cam.q.y * (1 - s);
	for (;;) {
		const P = WORLDS[i].portal(f);
		if (!P) return i;
		const cx = s * P.x + tx;
		const cy = s * P.y + ty;
		if (Math.hypot(px - cx, py - cy) > s * P.r) return i;
		const k = P.r / RD;
		tx = s * (P.x - CX * k) + tx;
		ty = s * (P.y - CY * k) + ty;
		s *= k;
		i++;
	}
};

/** the camera lands with a small shake on every arrival (in step with the impact in the score) */
const shake = (f: number) => {
	let dx = 0;
	let dy = 0;
	for (const a of TL.A.slice(1)) {
		const t = f - a;
		if (t < 0 || t > 26) continue;
		const e = Math.exp(-t / 5) * Math.min(1, t + 0.5);
		dx += 9 * e * Math.cos(t * 2.1);
		dy += 7 * e * Math.sin(t * 2.7 + 1);
	}
	return {dx, dy};
};

export const drawScene = (g: CanvasRenderingContext2D, f: number) => {
	const cam = cameraAt(f);
	const sh = shake(f);
	g.setTransform(1, 0, 0, 1, 0, 0);
	g.globalAlpha = 1;
	g.globalCompositeOperation = 'source-over';
	drawTree(g, cam.i, f, cam.s, cam.q.x * (1 - cam.s) + sh.dx, cam.q.y * (1 - cam.s) + sh.dy, {x0: 0, y0: 0, x1: W, y1: H});
};

/* ── film chrome, grain, vignette ─────────────────────────────────────────── */
const fmtMag = (z: number) => Math.round(Math.exp(z)).toLocaleString('en-US');
const drawHud = (g: CanvasRenderingContext2D, f: number) => {
	const cam = cameraAt(f);
	const tone = (x: number, y: number, ex = 0) => {
		const pts = [x, x + ex / 2, x + ex];
		const dark = pts.filter((px) => WORLDS[worldAt(cam, f, px, y)].hudDark).length;
		return dark >= 2 ? PAPER : INK;
	};
	g.save();
	g.setTransform(1, 0, 0, 1, 0, 0);
	g.textBaseline = 'alphabetic';
	g.font = `500 13px ${MONO}`;
	g.letterSpacing = '1.9px';
	g.lineWidth = 1.4;
	const inset = 44;
	const L = 18;
	const marks: [number, number, number, number][] = [
		[inset, inset, 1, 1],
		[W - inset, inset, -1, 1],
		[inset, H - inset, 1, -1],
		[W - inset, H - inset, -1, -1],
	];
	const on = prog(f, 4, 30, ease.out);
	g.globalAlpha = 0.7 * on;
	for (const [x, y, sx, sy] of marks) {
		g.strokeStyle = tone(x + sx * 40, y + sy * 40);
		g.beginPath();
		g.moveTo(x, y + sy * L);
		g.lineTo(x, y);
		g.lineTo(x + sx * L, y);
		g.stroke();
	}
	g.globalAlpha = 0.78 * on;
	g.textAlign = 'left';
	g.fillStyle = tone(inset + 28, inset, 240);
	g.fillText('MOTIONER / REEL 04', inset + 28, inset + 6);
	const sec = f / TL.fps;
	const tc = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}:${String(f % TL.fps).padStart(2, '0')}`;
	g.textAlign = 'right';
	g.fillStyle = tone(W - inset - 440, inset, 400);
	g.fillText(`${tc}  ·  ${TL.bpm} BPM  ·  BAR ${Math.floor(f / 60) + 1}`, W - inset - 28, inset + 6);
	const lv = Math.min(NW, Math.round(cam.u));
	g.textAlign = 'left';
	g.fillStyle = tone(inset + 28, H - inset, 300);
	g.fillText(`LEVEL ${String(lv % NW).padStart(2, '0')} / 0${NW - 1}   ${WORLDS[lv].name}`, inset + 28, H - inset + 2);
	g.textAlign = 'center';
	g.fillStyle = tone(780, H - inset, 360);
	g.fillText(`MAGNIFICATION  ×${fmtMag(cam.z)}`, 960, H - inset + 2);
	const px1 = W - inset - 28;
	const pw = 260;
	g.strokeStyle = tone(px1 - 100, H - inset - 8);
	g.globalAlpha = 0.35 * on;
	g.beginPath();
	g.moveTo(px1 - pw, H - inset - 8);
	g.lineTo(px1, H - inset - 8);
	g.stroke();
	g.globalAlpha = on;
	g.strokeStyle = CORAL;
	g.lineWidth = 2;
	g.beginPath();
	g.moveTo(px1 - pw, H - inset - 8);
	g.lineTo(px1 - pw + pw * Math.min(1, f / TL.durationInFrames), H - inset - 8);
	g.stroke();
	g.restore();
};

let GRAIN: HTMLCanvasElement | null = null;
const drawFinish = (g: CanvasRenderingContext2D, f: number) => {
	if (!GRAIN) {
		GRAIN = document.createElement('canvas');
		GRAIN.width = 256;
		GRAIN.height = 256;
		const gc = GRAIN.getContext('2d')!;
		const img = gc.createImageData(256, 256);
		for (let p = 0; p < 256 * 256; p++) {
			const r = Math.sin(p * 12.9898) * 43758.5453;
			const v = 128 + (r - Math.floor(r) - 0.5) * 180;
			img.data[p * 4] = v;
			img.data[p * 4 + 1] = v;
			img.data[p * 4 + 2] = v;
			img.data[p * 4 + 3] = 255;
		}
		gc.putImageData(img, 0, 0);
	}
	g.save();
	g.setTransform(1, 0, 0, 1, 0, 0);
	g.globalCompositeOperation = 'overlay';
	g.globalAlpha = 0.11;
	const pat = g.createPattern(GRAIN, 'repeat')!;
	g.translate((f * 53) % 256, (f * 97) % 256);
	g.fillStyle = pat;
	g.fillRect(-256, -256, W + 512, H + 512);
	g.restore();
	g.save();
	g.setTransform(1, 0, 0, 1, 0, 0);
	const v = g.createRadialGradient(960, 540, 420, 960, 540, 1180);
	v.addColorStop(0, 'rgba(0,0,0,0)');
	v.addColorStop(1, 'rgba(0,0,0,0.2)');
	g.fillStyle = v;
	g.fillRect(0, 0, W, H);
	g.restore();
};

let ACC: HTMLCanvasElement | null = null;
let TMP: HTMLCanvasElement | null = null;
const mk = () => {
	const c = document.createElement('canvas');
	c.width = W;
	c.height = H;
	return c;
};

export const renderFrame = (main: CanvasRenderingContext2D, f: number) => {
	const rate = zoomRate(f);
	const n = Math.max(1, Math.min(9, 1 + Math.round(rate * 140)));
	if (n === 1) {
		drawScene(main, f);
	} else {
		ACC = ACC ?? mk();
		TMP = TMP ?? mk();
		const ag = ACC.getContext('2d')!;
		const tg = TMP.getContext('2d')!;
		for (let k = 0; k < n; k++) {
			const fk = f + (k / (n - 1) - 0.5) * 0.55;
			drawScene(tg, fk);
			ag.setTransform(1, 0, 0, 1, 0, 0);
			ag.globalAlpha = 1 / (k + 1);
			ag.drawImage(TMP, 0, 0);
		}
		main.setTransform(1, 0, 0, 1, 0, 0);
		main.globalAlpha = 1;
		main.drawImage(ACC, 0, 0);
	}
	drawFinish(main, f);
	drawHud(main, f);
};
