import {clamp01, ease, lerp, mixColor, prog} from './motioner/motion';

export {clamp01, ease, lerp, mixColor, prog};
export const W = 1920;
export const H = 1080;
export const CX = 960;
export const CY = 540;
export const TAU = Math.PI * 2;
/** the radius (in a world's own coordinates) of the disc a child world fills once its scale is 1: half the frame diagonal plus a margin */
export const RD = 1110;
export const INK = '#0F0E11';
export const PAPER = '#EFEBE4';
export const CORAL = '#FF5436';
export const BLUE = '#2F3BF4';
export const YEL = '#F6C445';
export const DISPLAY = "'Archivo Variable', sans-serif";
export const SERIF = "'Instrument Serif', serif";
export const MONO = "'JetBrains Mono', monospace";
export const displayFont = (size: number) => `800 expanded ${size}px ${DISPLAY}`;

/** deterministic hash in [0,1) */
export const hash = (n: number) => {
	const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
	return x - Math.floor(x);
};
export const smooth = (a: number, b: number, x: number) => {
	const t = clamp01((x - a) / (b - a));
	return t * t * (3 - 2 * t);
};
/** hits on a beat grid: 0 before, a 2-frame attack, then an exponential decay */
export const hit = (d: number, dec: number) => (d < 0 ? 0 : d < 2 ? d / 2 : Math.exp(-(d - 2) / dec));
export const beatPulse = (f: number, dec = 10, beat = 30) => hit(((f % beat) + beat) % beat, dec);

export type Portal = {x: number; y: number; r: number; open?: number};
export type DrawArgs = {
	g: CanvasRenderingContext2D;
	f: number;
	/** screen scale of this world (1 = one local px per screen px) */
	s: number;
	/** screen-space bounding box of what can be seen of this world */
	bbox: {x0: number; y0: number; x1: number; y1: number};
	/** true when this world is drawn as the nested copy of the word (already assembled) */
	nested: boolean;
	/** true for the end card (the word again, with its tagline) */
	end: boolean;
	/** level of detail 0..1 for heavy worlds inside a small disc */
	lod: number;
	/** the world's current transform on screen: screen = s * local + (tx, ty) */
	tx: number;
	ty: number;
};
export type World = {
	name: string;
	bg: string;
	hudDark: boolean; // true when the background is dark (HUD text is paper)
	accent: string; // colour of the rings and callouts drawn over this world
	next: string; // label of the world behind the window
	portal: (f: number) => Portal | null;
	draw: (a: DrawArgs) => void;
};
