/* One continuous camera: dive i zooms into world i's window until world i+1 fills the frame.
 * Pure functions of the frame (no DOM), so the score script can use the same numbers. */
import {CX, CY, RD} from './common';
import {smoothTrack} from './motioner/motion';
import TL from './timeline.json';
import {NW, WORLDS} from './worlds';

const keys: {f: number; v: number}[] = [{f: 0, v: 0}];
for (let i = 0; i < NW; i++) {
	keys.push({f: TL.S[i], v: i + 0.05});
	keys.push({f: TL.A[i + 1], v: i + 1});
}
keys.push({f: TL.durationInFrames, v: NW + 0.05});
export const uAt = (f: number) => smoothTrack(f, keys);

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
