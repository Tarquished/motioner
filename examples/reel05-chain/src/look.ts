/* Lighting and exposure as a function of the frame.
 * DARK: a black studio with one spot that follows the action (frames 0 to the button, and everything the light wave has not reached yet).
 * LIT: the room lights, revealed by the ring of light that runs out of the button (rendered as a second pass and mixed by the ring).
 * FINALE: the room dims again to a single pool of light on the word. */
import {V3, lerp, smooth, clamp} from './base';
import {reg} from './reg';
import TL from './timeline.json';

export type Look = {
	bgLevel: number;
	fog: number;
	hemi: number;
	env: number;
	key: number;
	sky: number;
	spot: number;
	spotAngle: number;
	spotPen: number;
	spotOff: V3;
	spotAt: V3;
	exposure: number;
	bloom: number;
	fade: number;
};

const DARK: Omit<Look, 'spotAt' | 'fade'> = {
	bgLevel: 0.012, fog: 0.004, hemi: 0.05, env: 0.06, key: 0, sky: 0,
	spot: 9, spotAngle: 0.42, spotPen: 0.75, spotOff: [-6, 26, 12], exposure: 1, bloom: 0.06,
};
const LIT: Omit<Look, 'spotAt' | 'fade'> = {
	bgLevel: 0.34, fog: 0.0042, hemi: 0.3, env: 0.26, key: 1.9, sky: 0.8,
	spot: 0, spotAngle: 0.5, spotPen: 0.8, spotOff: [-6, 26, 12], exposure: 0.96, bloom: 0.05,
};

const mixV = (a: number[], b: number[], t: number) => a.map((x, i) => lerp(x, b[i], t));
const mixLook = (a: Omit<Look, 'spotAt' | 'fade'>, b: Omit<Look, 'spotAt' | 'fade'>, t: number) => {
	const o: any = {};
	for (const k of Object.keys(a) as (keyof typeof a)[]) {
		const x = a[k] as any, y = b[k] as any;
		o[k] = Array.isArray(x) ? mixV(x, y, t) : lerp(x, y, t);
	}
	return o as Omit<Look, 'spotAt' | 'fade'>;
};

/** where the finale spot sits: the middle of the word */
export const finale: {at: V3; fFrom: number; fTo: number} = {at: [0, 0, 0], fFrom: 1300, fTo: 1440};

const endFade = (f: number) => smooth(f / 14) * (1 - smooth((f - (TL.durationInFrames - 20)) / 20));

export const lookDark = (f: number): Look => {
	const L = mixLook(DARK, DARK, 0) as Look;
	L.spotAt = reg.focus(f);
	L.fade = endFade(f);
	return L;
};

export const lookLit = (f: number): Look => {
	const w = smooth((f - finale.fFrom) / (finale.fTo - finale.fFrom));
	const FIN = {...DARK, spot: 11, spotAngle: 0.7, spotPen: 1, spotOff: [-10, 52, 24] as V3, bgLevel: 0.012, exposure: 1.05, bloom: 0.08};
	const L = mixLook(LIT, FIN, w) as Look;
	const fo = reg.focus(f);
	L.spotAt = [lerp(fo[0], finale.at[0], w), lerp(fo[1], finale.at[1], w), lerp(fo[2], finale.at[2], w)];
	L.fade = endFade(f);
	return L;
};

export const lookAt = lookLit;
void clamp;
