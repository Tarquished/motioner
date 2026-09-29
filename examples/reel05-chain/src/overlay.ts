/* Numbers for the 2D layer and post effects, as a function of the frame. */
import {reg} from './reg';

export const overlayAt = (f: number) => {
	const t = f - reg.fFlood;
	const flash = t >= 0 ? Math.exp(-t / 9) * (t < 3 ? t / 3 : 1) : 0;
	const h = f - reg.fHit;
	const flash2 = h >= 0 ? 0.32 * Math.exp(-h / 7) * (h < 2 ? h / 2 : 1) : 0;
	return {flash: flash + flash2};
};
