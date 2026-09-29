/* Newton's cradle: five pendulums of equal mass and elastic collisions. Ball 0 is released from a raised position, hits ball 1, and the impulse
 * runs through the row: ball 4 leaves with ball 0's speed. A paddle (the first gear of the next link) is struck by ball 4 on its way out. */
import {GF} from '../base';

export type CradleOpts = {
	L: number;
	r: number;
	th0: number; // release angle of ball 0 (negative: to the left)
	fRelease: number;
	thPaddle: number; // angle at which ball 4 meets the paddle on its way out
	paddleKeep: number; // fraction of the speed that ball 4 keeps after hitting the paddle
	frames: number;
};

export type CradleSim = {
	f0: number;
	step: number;
	th: Float32Array[]; // per ball
	collisions: {f: number; v: number; pair: number}[];
	paddle: {f: number; v: number};
	fFirst: number;
};

export const simulateCradle = (o: CradleOpts): CradleSim => {
	const N = 5;
	const th = new Array(N).fill(0);
	const om = new Array(N).fill(0);
	th[0] = o.th0;
	const dt = 0.05;
	const k = GF / o.L;
	const s = 2 * o.r;
	const xs = (i: number) => i * s + o.L * Math.sin(th[i]);
	const u = (i: number) => o.L * Math.cos(th[i]) * om[i];
	const out: number[][] = Array.from({length: N}, () => []);
	const collisions: {f: number; v: number; pair: number}[] = [];
	const step = 0.25;
	let next = o.fRelease;
	let paddle = {f: 0, v: 0};
	let hitPaddle = false;
	let fFirst = 0;
	let f = o.fRelease;
	const end = o.fRelease + o.frames;
	while (f < end) {
		if (f >= next - 1e-9) {
			for (let i = 0; i < N; i++) out[i].push(th[i]);
			next += step;
		}
		for (let i = 0; i < N; i++) {
			om[i] += -k * Math.sin(th[i]) * dt - 0.0006 * om[i] * dt;
			th[i] += om[i] * dt;
		}
		// collisions: propagate the exchange through the row within this instant
		for (let pass = 0; pass < 8; pass++) {
			let any = false;
			for (let i = 0; i < N - 1; i++) {
				if (xs(i + 1) - xs(i) < s - 1e-6 && u(i) - u(i + 1) > 1e-7) {
					const v = u(i) - u(i + 1);
					const t = om[i];
					om[i] = om[i + 1];
					om[i + 1] = t;
					// separate the overlap
					const ov = s - (xs(i + 1) - xs(i));
					th[i] -= ov / 2 / (o.L * Math.cos(th[i]));
					th[i + 1] += ov / 2 / (o.L * Math.cos(th[i + 1]));
					const last = collisions[collisions.length - 1];
					if (!last || f - last.f > 0.5 || last.pair !== i - 1) collisions.push({f, v, pair: i});
					if (!fFirst) fFirst = f;
					any = true;
				}
			}
			if (!any) break;
		}
		// the paddle is struck by the last ball on its way out
		if (!hitPaddle && th[N - 1] >= o.thPaddle && om[N - 1] > 0) {
			hitPaddle = true;
			const v = u(N - 1);
			paddle = {f, v};
			om[N - 1] *= o.paddleKeep;
		}
		f += dt;
	}
	return {f0: o.fRelease, step, th: out.map((a) => Float32Array.from(a)), collisions, paddle, fFirst};
};

export const thAt = (sim: CradleSim, i: number, f: number) => {
	const x = (f - sim.f0) / sim.step;
	const a = sim.th[i];
	if (x <= 0) return a[0];
	if (x >= a.length - 1) return a[a.length - 1];
	const k = Math.floor(x);
	const t = x - k;
	return a[k] * (1 - t) + a[k + 1] * t;
};
