"""Rewrites the back half of the film (17 s to the end): after the plate builds, the film rewinds and every chapter, one after the other, shrinks
out of the full frame into one letter of the name, so the name is made of the eight worlds; it lives, then it sets."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
tlp = root / "src" / "timeline.json"
tl = json.loads(tlp.read_text())
tl["recap"] = {
    "from": 1080,
    "S": [1110, 1155, 1185, 1215, 1245, 1267.5, 1290, 1305],
    "shrink": 16,
    "living": [1321, 1440],
    "notes": [1326, 1341, 1356, 1371, 1386, 1401, 1416, 1431],
    "lock": 1440,
    "drop": [1301, 1321],
    "resolve": [1620, 1690],
}
tl["finale"]["lock"] = 1440
tl["finale"]["tagline"] = [1500, 1560]
for k in ("collapse", "sand"):
    tl.pop(k, None)
tlp.write_text(json.dumps(tl, indent="\t"))

p = root / "src" / "scenes.ts"
s = p.read_text(encoding="utf-8").replace("\r\n", "\n")
Path(root / "out" / "scenes_before_recap.ts").write_text(s, encoding="utf-8")

a = s.index("// the eight-then-eight cuts of the montage")
b = s.index("// ------------------------------------------------------------------ everything together")
c = s.index("// ------------------------------------------------------------------ what is under a point of the screen")

block = r'''// ------------------------------------------------------------------ the recap: every chapter shrinks out of the frame into a letter of the name
const RC = TL.recap;
const RING_R = (word: string, scale: number, R: number, theta0: number) => {
	const w = (ATL.words as any)[word];
	return w.items.map((it: any) => {
		const rad = R + it.y * scale;
		const phi = theta0 + (it.x * scale) / R;
		return {x: rad * Math.sin(phi), y: rad * Math.cos(phi), s: scale, r: -phi, idx: it.idx} as Glyph;
	});
};
const SWM = 1.0;
const WM = wordBox('motioner', SWM);
const WM_BASE = -80;
const WM_GL: Glyph[] = wordGlyphs('motioner', SWM, WM.cx, WM_BASE);
const WM_PERIOD: [number, number] = [WM.period[0], WM_BASE + WM.r];
const CHARS = ATL.chars as any;
const LETTERS = 'motioner';
const beatT = (t: number) => RC.from + BEAT * Math.floor(Math.max(0, t - RC.from) / BEAT);

// the eight worlds, each an iconic view of one chapter, drawn at its native scale (place() shrinks it into its letter)
const humW = (L: Layer, t: number) => {
	L.bg(PAL.ink).ink(PAL.paper, PAL.coral, 1, 3).transform(1);
	const age = t - RC.from;
	const r = 18 + 2 * Math.sin((2 * Math.PI * t) / 60) + 34 * Math.exp(-Math.max(0, age) / 8);
	L.slot(0, {type: 1, w: 1, group: 0, a: r, fillAmt: 0});
	L.slot(1, {type: 1, w: 1, group: 1, a: r, fill: PAL.coral, fillAmt: 1});
	L.glow(PAL.coral, 0.7, 80, 1);
	L.fieldLines({spacing: 60, phase: t * 0.5, w: 2.6, a: 0.4, fall: 340, group: 0});
	const p = clamp01(age / 46);
	if (age >= 0) L.pulse(0, {g: 0, R: 900 * ease.out(p), w: 5, a: 1 - p, mix: 1});
};
const pingW = (L: Layer, t: number) => dotWorld(L, t, beatT(t), P_PAPER, 28);
const soundW = (L: Layer, t: number) => wordOnly(L, t, beatT(t), P_PAPER, 'SOUND', 1.0);
const motionW = (L: Layer, t: number) => wordOnly(L, t, beatT(t), P_BLUE, 'MOTION', 1.0);
const frameW = (L: Layer, t: number) => scopeWorld(L, t, 1.0, [0, 0], P_INK, {eOut: 1, eB: 1});
const plateW = (L: Layer, t: number) => roseWorld(L, t, 1.0, P_CORAL, [9 + 2 * (Math.floor((t - RC.from) / 30) % 4), 0.05], 0.02 * (t - RC.from));
const togetherW = (L: Layer, t: number) => {
	const sp = 0.0135 * (t - RC.from) * 1.4;
	L.bg(PAL.yellow).ink(PAL.ink, PAL.blue, 1, 3).transform(1);
	L.slot(0, {type: 2, w: 1, group: 0, a: 0, fill: PAL.ink, fillAmt: 1});
	L.slot(1, {type: 2, w: 1, group: 1, a: 1, fill: PAL.blue, fillAmt: 1});
	L.word(0, RING_R('MOTION', 0.7, 470, sp));
	L.word(1, RING_R('SOUND', 0.7, 690, -sp));
	L.fieldLines({spacing: 44, phase: beatPhase(t, RC.from), w: 2.4, a: 0.6, fall: 300, group: 0});
};
const sandW = (L: Layer, t: number) => roseWorld(L, t, 1.0, P_INK, [12 + 3 * (Math.floor((t - RC.from) / 30) % 4), 0.066], -0.02 * (t - RC.from));
const WORLDS = [humW, pingW, soundW, motionW, frameW, plateW, togetherW, sandW];
const WORLD_ZOOM = [0.55, 0.45, 0.24, 0.3, 0.34, 0.42, 0.3, 0.42]; // how much of the world one letter shows
const WORLD_OL: RGB[] = [PAL.paper, PAL.ink, PAL.ink, PAL.paper, PAL.paper, PAL.ink, PAL.ink, PAL.paper];

const recapCam = (t: number) => {
	const push = 0.05 * ease.inOutSoft(clamp01((t - RC.living[0]) / (RC.lock - RC.living[0])));
	const punch = t >= RC.lock ? 0.045 * Math.exp(-(t - RC.lock) / 7) : 0;
	return 1 + push + punch - (t >= RC.lock ? 0.05 * ease.out(clamp01((t - RC.lock) / 40)) : 0);
};
const notePulse = (k: number, t: number) => {
	const age = t - RC.notes[k];
	return age < 0 ? 0 : Math.exp(-age / 9);
};
// the letter i with its beat pulse and, at the lock, its spring
const recapGlyph = (i: number, t: number): Glyph => {
	const g = {...WM_GL[i]};
	const pu = notePulse(i, t);
	const age = t - RC.lock - i * 4;
	const env = age < 0 ? 0 : Math.exp(-age / 11);
	g.s *= 1 + 0.07 * pu + 0.07 * env * Math.sin((Math.max(0, age) / 9) * Math.PI);
	g.y += 34 * env * Math.sin((Math.min(Math.max(0, age), 40) / 9) * Math.PI) * 0.9;
	g.r = 0.03 * env * Math.sin((Math.max(0, age) / 8) * Math.PI) * (i % 2 ? 1 : -1);
	return g;
};

const recapLayer = (fr: Frame, t: number, k: number, Zc: number) => {
	const h = Math.round(t);
	const V = k === 0 ? RC.from : RC.S[k - 1];
	if (h < V) return;
	const L = fr.layers[8 - k]; // the newest world is the lowest layer: the letters made earlier stay on top of it
	const e = ease.snap(clamp01((t - RC.S[k]) / RC.shrink));
	const g = recapGlyph(k, t);
	const info = CHARS[LETTERS[k]];
	WORLDS[k](L, t);
	const fullHW = W / 2 / Zc + 60;
	const fullHH = H / 2 / Zc + 60;
	const lhw = (info.w / 2) * g.s * 1.02 + 4;
	const lhh = (info.h / 2) * g.s * 1.02 + 4;
	const morph = smooth(0.2, 1, e);
	L.window({cx: lerp(0, g.x, e), cy: lerp(0, g.y, e), hw: lerp(fullHW, lhw, e), hh: lerp(fullHH, lhh, e), corner: lerp(0, 22, e)}, morph, g, 1.3, WORLD_OL[k], 0.95 * smooth(0.3, 1, e));
	const S: [number, number] = [lerp(W / 2, W / 2 + g.x * Zc, e), lerp(H / 2, H / 2 + g.y * Zc, e)];
	L.place(S, lerp(1, WORLD_ZOOM[k], e), W, H);
};

const recapFrame = (fr: Frame, t: number) => {
	const Zc = recapCam(t);
	const base = fr.layers[0].on();
	base.bg(PAL.ink).ink(PAL.paper, PAL.coral, 1, 3).transform(Zc);
	const glyphs = WM_GL.map((_, i) => recapGlyph(i, t));
	base.slot(0, {type: 2, w: 1, group: 0, a: 0, fill: PAL.paper, fillAmt: smooth(RC.resolve[0], RC.resolve[1], t)});
	base.word(0, glyphs);
	// the full stop falls in when the last letter has locked and pings
	const dp = clamp01((t - RC.drop[0]) / (RC.drop[1] - RC.drop[0]));
	const dy = lerp(900, 0, 1 - Math.pow(1 - dp, 2)) * (t < RC.drop[1] ? 1 : 0);
	const land = t >= RC.drop[1] ? Math.exp(-(t - RC.drop[1]) / 7) : 0;
	const rd = WM.r * (1 - 0.18 * land + 0.1 * Math.sin(Math.PI * dp) * (dp < 1 ? 1 : 0) + 0.22 * Math.exp(-(t - FN.lastPing) / 8) * (t >= FN.lastPing ? 1 : 0));
	if (t >= RC.drop[0]) base.slot(1, {type: 1, w: 1, group: 1, x: WM_PERIOD[0], y: WM_PERIOD[1] + dy, a: rd, fill: PAL.coral, fillAmt: 1});
	base.glow(PAL.coral, t >= RC.drop[1] ? 0.35 : 0, 44, 1);
	// contours echo around the name once it is whole; a ring of light leaves it on the lock and on the beats after
	const whole = smooth(RC.drop[1], RC.drop[1] + 24, t);
	base.fieldLines({spacing: SP, phase: beatPhase(t, RC.drop[1]) * 0.6, w: 2.6, a: 0.55 * whole, fall: 760, group: 0, emph: 6});
	[RC.drop[1], RC.lock, 1470, 1500, 1530, 1560, FN.lastPing].forEach((t0, j) => {
		const age = t - t0;
		if (age < 0) return;
		const p = clamp01(age / 100);
		base.pulse(j, {g: 0, R: 900 * ease.out(p), w: lerp(2, 4.5, 1 - p), a: Math.pow(1 - p, 1.1) * (j === 1 || j === 6 ? 1 : 0.7), mix: clamp01(1 - age / 10)});
	});
	for (let k = 0; k < 8; k++) recapLayer(fr, t, k, Zc);
	// the windows dust away, left to right, and the name is clean
	if (t >= RC.resolve[0]) {
		for (let k = 0; k < 8; k++) {
			const L = fr.layers[8 - k];
			const d = smooth(RC.resolve[0] + 6 * k, RC.resolve[0] + 6 * k + 34, t);
			L.swirl(0, 600, d, 900, 0.5, 2, Math.floor(t));
		}
	}
	if (Math.round(t) >= RC.lock && t - RC.lock < 60) {
		const age = Math.max(0, t - RC.lock);
		const q = 1 - age / 60;
		fr.ring(W / 2, H / 2, (2600 * (1 - Math.pow(2, -5 * (age / 45)))) / (1 - Math.pow(2, -5)), 150, 30 * q, 8 * q, 0.35 * q, PAL.paper);
	}
};

'''

head = s[:a]
tail = s[c:]
s = head + block + tail

# frameAt branches
i0 = s.index("	} else if (h >= CL.iris[1]) {")
i1 = s.index("	} else if (t >= RG.portal[1] && h < MT.from) {")
s = s[:i0] + "	} else if (h >= RC.from) {\n		recapFrame(fr, t);\n" + s[i1:]
s = s.replace("	} else if (t >= RG.portal[1] && h < MT.from) {", "	} else if (t >= RG.portal[1] && h < RC.from) {")

# header destructure
s = s.replace("montage: MT, collapse: CL, finale: FN, plate: PL} = TL;", "recap: RCX, finale: FN, plate: PL} = TL;")
s = s.replace("const RC = TL.recap;\n", "const RC = RCX;\n")

# hudDark
h0 = s.index("const CUT_DARK")
h1 = s.index("// the plate: coral, then a flood to blue")
hud = '''export const hudDark = (t: number, px: number, py: number): boolean => {
	// px, py: screen position, origin top-left (DOM)
	const sx = px;
	const sy = H - py;
	const dist = (ox: number, oy: number) => Math.hypot(sx - ox, sy - oy);
	if (t < ping.hit + 1) return true;
	if (t < motion.flood[0]) return !(1700 * easeOutExpo((t - ping.hit) / 22) > dist(W / 2, H / 2));
	if (t < motion.flood[0] + 40) {
		const p = clamp01((t - motion.flood[0]) / (motion.flood[1] - motion.flood[0]));
		const R = (2700 * (1 - Math.pow(2, -6 * p))) / (1 - Math.pow(2, -6));
		const [qx, qy] = seedPos(motion.flood[0]);
		const z = cam(motion.flood[0]);
		return R > dist(W / 2 + qx * z, H / 2 + qy * z);
	}
	if (t < RG.portal[0]) return true;
	if (t < RG.portal[1]) {
		const age = t - RG.portal[0];
		const p = clamp01(age / (RG.portal[1] - RG.portal[0]));
		const Rm = Math.max(26 + (1500 / Math.PI - 26) * easeOutExpo(age / 9), (1500 / Math.PI) * lerp(1, 4.2, ease.inOut(p)));
		return !(Rm > dist(W / 2, H / 2));
	}
	if (t < PL.flood1[0]) return false;
	if (t < PL.flood1[1]) return floodR(t, PL.flood1[0], PL.flood1[1]) > dist(W / 2, H / 2); // coral (light) becomes blue (dark) inside the ring
	return true; // blue, ink, and the name on ink (the chrome is hidden while the recap runs)
};

'''
s = s[:h0] + hud + s[h1:]
# flash table
old = s[s.index("	for (const [ht, amt] of [[sound.lock"):s.index("] as [number, number][]) {") + len("] as [number, number][]) {")]
s = s.replace(old, "	for (const [ht, amt] of [[sound.lock, 0.16], [RG.portal[0], 0.28], [RC.from, 0.3], [RC.lock, 0.3]] as [number, number][]) {")
p.write_text(s, encoding="utf-8")
print("ok")
