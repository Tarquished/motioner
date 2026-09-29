/* Numbers for the 2D layer and post effects, as a function of the frame. */
import {reg} from './reg';

export const overlayAt = (f: number) => {
	const t = f - reg.fFlood;
	const flash = t >= 0 ? Math.exp(-t / 9) * (t < 3 ? t / 3 : 1) : 0;
	return {flash};
};
