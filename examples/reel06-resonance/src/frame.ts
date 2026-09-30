/* Builders for the data texture the shader reads: one Layer per row (128 texels of 4 floats) and one global row. */
export const DW = 128;
const OW = 72; // words
const OP = 48; // pulses
export const NL = 10;
export type RGB = [number, number, number];

export const hex = (h: string): RGB => {
	const n = parseInt(h.replace('#', ''), 16);
	return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
export const PAL = {
	ink: hex('#0F0E11'),
	paper: hex('#EFEBE4'),
	coral: hex('#FF5436'),
	blue: hex('#2F3BF4'),
	yellow: hex('#F6C445'),
};
export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export type Slot = {
	type: number; // 1 dot, 2 word, 3 box, 5 waveform
	w: number; // blend weight inside its group (0 = off)
	group: number; // 0..2
	fill?: RGB;
	fillAmt?: number;
	x?: number;
	y?: number;
	a?: number; // dot: radius; word: word index; box: half width; wave: half length
	b?: number; // box: half height; wave: amplitude
	c0?: number; // box: corner radius
	shell?: number; // outline half width (px)
	t0?: number;
	t1?: number; // wave window (seconds)
	env?: number; // wave: 0 line, 1 filled envelope
};
export type Pulse = {g: number; R: number; w: number; a: number; mix?: number; soft?: number};
export type Glyph = {x: number; y: number; s: number; r: number; idx: number};

export class Layer {
	d = new Float32Array(DW * 4);
	private nSlot = 0;
	private nPulse = 0;
	private nGl = [0, 0];
	private counts() {
		this.s(15, this.nSlot, this.nPulse, this.nGl[0], this.nGl[1]);
	}
	private s(i: number, a = 0, b = 0, c = 0, e = 0) {
		this.d[i * 4] = a;
		this.d[i * 4 + 1] = b;
		this.d[i * 4 + 2] = c;
		this.d[i * 4 + 3] = e;
	}
	constructor() {
				this.words();
		this.transform(1, 0, 0, 0);
	}
	private words() {
		for (let w = 0; w < 2; w++) for (let i = 0; i < 8; i++) this.s(OW + w * 16 + i * 2 + 1, -1, 0, 0, 0);
	}
	on(mask = 0, gi = 0, word = 0) {
		this.s(0, 1, mask, gi, word);
		return this;
	}
	bg(c: RGB, a = 1) {
		this.s(2, c[0], c[1], c[2], a);
		return this;
	}
	ink(c1: RGB, c2: RGB = c1, lineAlpha = 1, lineW = 3) {
		this.s(3, c1[0], c1[1], c1[2], lineAlpha);
		this.s(4, c2[0], c2[1], c2[2], lineW);
		return this;
	}
	private xfv = [1, 0, 0, 0];
	transform(zoom: number, px = 0, py = 0, rot = 0) {
		this.xfv = [zoom, px, py, rot];
		this.s(5, zoom, px, py, rot);
		return this;
	}
	/** put the world's origin at screen position S (pixels, y up) and multiply its zoom (used to shrink a world into a window) */
	place(S: [number, number], zoomMul: number, W: number, H: number) {
		const z = this.xfv[0] * zoomMul;
		const rot = this.xfv[3];
		const qx = (S[0] - W / 2) / z;
		const qy = (S[1] - H / 2) / z;
		const cr = Math.cos(rot);
		const sr = Math.sin(rot);
		this.transform(z, -(cr * qx - sr * qy), -(sr * qx + cr * qy), rot);
		return this;
	}
	/** layer shown through a window (mask mode 3): a rectangle that morphs into a glyph; outline in ol */
	window(rect: {cx: number; cy: number; hw: number; hh: number; corner: number}, morph: number, g: {x: number; y: number; s: number; r: number; idx: number}, feather: number, ol: RGB, olA: number) {
		this.s(0, 1, 3, 0, 0);
		this.s(107, rect.cx, rect.cy, rect.hw, rect.hh);
		this.s(108, rect.corner, morph, g.idx, g.s);
		this.s(109, g.x, g.y, g.r, feather);
		this.s(110, ol[0], ol[1], ol[2], olA);
		return this;
	}
	swirl(amount: number, radius: number, dissolve = 0, dissolveR = 900, spread = 0.7, grain = 2, seed = 0) {
		this.s(104, amount, radius, dissolve, dissolveR);
		this.s(105, spread, grain, seed, 0);
		return this;
	}
	roseWord(mix: number, scale = 0.02) {
		this.s(106, mix, scale, 0, 0);
		return this;
	}
	additive() {
		this.d[1 * 4 + 3] = 1;
		return this;
	}
	wipe(x: number, soft: number) {
		this.s(1, x, soft, 1, this.d[1 * 4 + 3]);
		return this;
	}
	bend(k: number) {
		this.d[6 * 4] = k;
		return this;
	}
	glow(c: RGB, amt: number, len: number, group = 1) {
		this.s(7, c[0], c[1], c[2], amt);
		this.s(8, len, group, 0, 0);
		return this;
	}
	rosette(o: {amt: number; m1: number; k1: number; ph1?: number; m2?: number; k2?: number; mix?: number; rot?: number; radius: number; lineW: number; edge: number; col: RGB; sand: number}) {
		this.s(9, o.amt, o.m1, o.k1, o.ph1 ?? 0);
		this.s(10, o.m2 ?? o.m1, o.k2 ?? o.k1, o.mix ?? 0, o.rot ?? 0);
		this.s(11, o.radius, o.lineW, o.edge, 0);
		this.s(12, o.col[0], o.col[1], o.col[2], o.sand);
		return this;
	}
	fieldLines(o: {spacing: number; phase: number; w: number; a: number; fall: number; group: number; mix?: number; emph?: number}) {
		this.s(13, o.spacing, o.phase, o.w, o.a);
		this.s(14, o.fall, o.group, o.mix ?? 0, o.emph ?? 0);
		return this;
	}
	slot(k: number, o: Slot) {
		const i = 16 + k * 4;
		this.nSlot = Math.max(this.nSlot, k + 1);
		this.d[6 * 4 + 1] = Math.max(this.d[6 * 4 + 1], o.group + 1);
		this.counts();
		this.s(i, o.type, o.w, 0, o.group);
		const f = o.fill ?? PAL.paper;
		this.s(i + 3, f[0], f[1], f[2], o.fillAmt ?? 1);
		if (o.type === 1) this.s(i + 1, o.x ?? 0, o.y ?? 0, o.a ?? 10, 0);
		else if (o.type === 2 || o.type === 6) this.s(i + 1, o.a ?? 0, 0, 0, 0);
		else if (o.type === 3) this.s(i + 1, o.x ?? 0, o.y ?? 0, o.a ?? 10, o.b ?? 10);
		else if (o.type === 5) this.s(i + 1, o.x ?? 0, o.y ?? 0, o.a ?? 800, o.b ?? 100);
		this.s(i + 2, o.shell ?? (o.type === 5 ? 2 : 0), o.type === 5 ? o.t0 ?? 0 : o.c0 ?? 0, o.t1 ?? 0, o.env ?? 0);
		return this;
	}
	pulse(j: number, p: Pulse) {
		if (j >= 12) return this;
		this.nPulse = Math.max(this.nPulse, j + 1);
		this.counts();
		this.s(OP + j * 2, p.g, p.R, p.w, p.a);
		this.s(OP + j * 2 + 1, p.mix ?? 0, p.soft ?? 0, 0, 0);
		return this;
	}
	word(w: number, gl: Glyph[]) {
		this.nGl[w] = Math.min(8, gl.length);
		this.counts();
		for (let i = 0; i < 8; i++) {
			const g = gl[i];
			if (!g) {
				this.s(OW + w * 16 + i * 2, 0, 0, 0, 0);
				this.s(OW + w * 16 + i * 2 + 1, -1, 0, 0, 0);
			} else {
				this.s(OW + w * 16 + i * 2, g.x, g.y, g.s, g.r);
				this.s(OW + w * 16 + i * 2 + 1, g.idx, 1, 0, 0);
			}
		}
		return this;
	}
}

export class Frame {
	layers: Layer[] = [];
	g = new Float32Array(DW * 4);
	constructor() {
		for (let i = 0; i < NL; i++) this.layers.push(new Layer());
	}
	private s(i: number, a = 0, b = 0, c = 0, e = 0) {
		this.g[i * 4] = a;
		this.g[i * 4 + 1] = b;
		this.g[i * 4 + 2] = c;
		this.g[i * 4 + 3] = e;
	}
	ring(ox: number, oy: number, R: number, w: number, refract = 0, chroma = 0, rim = 0, rimCol: RGB = [1, 1, 1]) {
		this.s(0, ox, oy, R, w);
		this.s(1, refract, chroma, rim, 0);
		this.s(2, rimCol[0], rimCol[1], rimCol[2], this.g[2 * 4 + 3]);
		return this;
	}
	seed(v: number) {
		this.g[2 * 4 + 3] = v;
		return this;
	}
	flash(c: RGB, a: number) {
		if (a > this.g[3 * 4 + 3]) this.s(3, c[0], c[1], c[2], a); // the strongest flash of the frame wins
		return this;
	}
	glitch(shift: number, band: number, split: number) {
		this.s(4, shift, band, split, 0);
		return this;
	}
	pack(): Float32Array {
		let nOn = 0;
		this.layers.forEach((l, i) => {
			if (l.d[0] > 0.5) nOn = i + 1;
		});
		this.s(5, nOn);
		const out = new Float32Array(DW * 4 * (NL + 1));
		for (let i = 0; i < NL; i++) out.set(this.layers[i].d, i * DW * 4);
		out.set(this.g, NL * DW * 4);
		return out;
	}
}
