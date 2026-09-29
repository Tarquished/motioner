/* One continuous camera: dive i zooms into world i's window until world i+1 fills the frame.
 * Pure functions of the frame (no DOM), so the score script can use the same numbers. */
import {CX, CY, RD} from './common';
import {Easing} from 'remotion';
import {clamp01, ease} from './motioner/motion';
import TL from './timeline.json';
import {NW, WORLDS} from './worlds';

/* Dive timing: fast while the target is still far, then a long, smooth settling into the arrival.
 * The dive is one cubic bezier (soft 12-frame ease-in, peak speed in the first fifth, 3 % of the zoom in the last quarter);
 * between dives the camera keeps drifting a little (0.05 of a world) so it never stops dead. */
const diveCurve = Easing.bezier(0.22, 0, 0.06, 1);
export const uAt = (f: number) => {
	for (let i = 0; i < NW; i++) {
		if (f < TL.S[i]) return i + 0.05 * ease.inOut(clamp01((f - TL.A[i]) / (TL.S[i] - TL.A[i])));
		if (f < TL.A[i + 1]) return i + 0.05 + 0.95 * diveCurve((f - TL.S[i]) / (TL.A[i + 1] - TL.S[i]));
	}
	return NW + 0.05 * ease.inOut(clamp01((f - TL.A[NW]) / (TL.durationInFrames - TL.A[NW])));
};

export type Cam = {i: number; t: number; s: number; q: {x: number; y: number}; lnK: number; z: number; u: number};

const lnKOf = (i: number, f: number) => {
	const p = WORLDS[i].portal(f);
	return p ? Math.log(RD / p.r) : 0;
};
export const cameraAt = (f: number): Cam => {
	const u = uAt(f);
	if (u >= NW) {
		const s = 1 + (u - NW);
		let z = 0;
		for (let j = 0; j < NW; j++) z += lnKOf(j, f);
		return {i: NW, t: 0, s, q: {x: CX, y: CY}, lnK: 0, z: z + Math.log(s), u};
	}
	const i = Math.floor(u);
	const t = u - i;
	const P = WORLDS[i].portal(f)!;
	const lnK = Math.log(RD / P.r);
	const K = RD / P.r;
	const q = {x: (P.x - CX / K) / (1 - 1 / K), y: (P.y - CY / K) / (1 - 1 / K)};
	let z = t * lnK;
	for (let j = 0; j < i; j++) z += lnKOf(j, f);
	return {i, t, s: Math.exp(t * lnK), q, lnK, z, u};
};
/** log-zoom per frame (used for motion blur and for the sound of the zoom) */
export const zoomRate = (f: number) => Math.abs(cameraAt(f + 0.5).z - cameraAt(f - 0.5).z);
