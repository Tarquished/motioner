/* World 2: a Bauhaus tile field whose tiles turn in waves that leave the centre on every beat. */
import {BLUE, CORAL, DrawArgs, ease, hash, INK, mixColor, PAPER, Portal, TAU, YEL, clamp01} from '../common';
import TL from '../timeline.json';

export const DISC: Portal = {x: 960, y: 540, r: 84};
const T = 180;
const R = 8;
const SHAPES = [INK, BLUE, CORAL, YEL];
const SOLID = [INK, BLUE, CORAL];

type Tile = {kind: number; shape: number; c0: number; bg: string; sign: number};
const TILES: Tile[] = [];
for (let r = -R; r <= R; r++)
	for (let c = -R; c <= R; c++) {
		const h = hash(c * 12.9898 + r * 78.233);
		const kind = Math.floor(hash(c * 3.1 + r * 5.7) * 7);
		TILES.push({kind, shape: Math.floor(h * 4), c0: Math.floor(hash(c * 9.3 - r * 2.1) * 4), bg: h < 0.6 ? PAPER : SOLID[Math.floor(hash(c + r * 17.7) * 3)], sign: (c + r) & 1 ? 1 : -1});
	}

const waves = TL.tiles.waves;
const shapeAt = (g: CanvasRenderingContext2D, kind: number, col: string) => {
	const h = T / 2;
	g.fillStyle = col;
	g.beginPath();
	switch (kind) {
		case 0:
			g.moveTo(-h, -h);
			g.arc(-h, -h, T, 0, Math.PI / 2);
			break;
		case 1:
			g.arc(0, -h, h, 0, Math.PI);
			break;
		case 2:
			g.arc(0, 0, h * 0.86, 0, TAU);
			break;
		case 3:
			g.arc(0, 0, h * 0.86, 0, TAU);
			g.moveTo(h * 0.42, 0);
			g.arc(0, 0, h * 0.42, 0, TAU, true);
			break;
		case 4:
			g.moveTo(-h, -h);
			g.arc(-h, -h, h, 0, Math.PI / 2);
			g.moveTo(h, h);
			g.arc(h, h, h, Math.PI, Math.PI * 1.5);
			break;
		case 5:
			g.moveTo(0, -h * 0.95);
			g.lineTo(h * 0.95, 0);
			g.lineTo(0, h * 0.95);
			g.lineTo(-h * 0.95, 0);
			break;
		default:
			g.rect(-h * 0.9, -h * 0.9, h * 0.34, h * 1.8);
			g.rect(-h * 0.17, -h * 0.9, h * 0.34, h * 1.8);
			g.rect(h * 0.56, -h * 0.9, h * 0.34, h * 1.8);
	}
	g.closePath();
	g.fill('evenodd');
};

export function drawTiles({g, f, bbox, s, tx, ty}: DrawArgs) {
	// only tiles that can be seen
	const lx0 = (bbox.x0 - tx) / s - T;
	const lx1 = (bbox.x1 - tx) / s + T;
	const ly0 = (bbox.y0 - ty) / s - T;
	const ly1 = (bbox.y1 - ty) / s + T;
	let idx = 0;
	for (let r = -R; r <= R; r++)
		for (let c = -R; c <= R; c++, idx++) {
			const cx = 960 + c * T;
			const cy = 540 + r * T;
			if (cx < lx0 || cx > lx1 || cy < ly0 || cy > ly1) continue;
			const tile = TILES[idx];
			const d = Math.hypot(c, r);
			let n = 0;
			for (const F of waves) n += ease.snap(clamp01((f - (F + 2.4 * d)) / 22));
			g.save();
			g.translate(cx, cy);
			g.fillStyle = tile.bg;
			g.fillRect(-T / 2 - 0.5, -T / 2 - 0.5, T + 1, T + 1);
			g.beginPath();
			g.rect(-T / 2, -T / 2, T, T);
			g.clip();
			g.rotate((tile.sign * n * Math.PI) / 2);
			if (tile.bg === PAPER) {
				const k = Math.floor(n);
				const a = SHAPES[(tile.c0 + k) % 4];
				const b = SHAPES[(tile.c0 + k + 1) % 4];
				shapeAt(g, tile.kind, mixColor(a, b, n - k));
			} else {
				shapeAt(g, tile.kind, PAPER);
			}
			g.restore();
		}
	g.fillStyle = PAPER;
	g.fillRect(960 - T / 2 - 0.5, 540 - T / 2 - 0.5, T + 1, T + 1);
	g.fillStyle = BLUE;
	g.beginPath();
	g.arc(DISC.x, DISC.y, DISC.r, 0, TAU);
	g.fill();
}
