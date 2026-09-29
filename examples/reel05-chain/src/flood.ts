/* The wave of light that runs out of the button: radius in world units as a function of the frame. */
export const ringR = (f: number, fFlood: number) => {
	const t = Math.max(0, f - fFlood);
	if (t <= 250) return 1.1 * t - 0.0022 * t * t;
	return 137.5 + 9 * (t - 250);
};
export const RING_DONE = 285; // frames after the press at which the ring has passed everything
/** first frame at which the ring has reached distance d */
export const ringArrival = (d: number, fFlood: number) => {
	let lo = 0, hi = 300;
	for (let i = 0; i < 40; i++) {
		const m = (lo + hi) / 2;
		if (ringR(fFlood + m, fFlood) < d) lo = m; else hi = m;
	}
	return fFlood + hi;
};
