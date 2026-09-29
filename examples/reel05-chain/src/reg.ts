/* Late-bound hooks so that camera.ts and look.ts can ask the chain where the action is without importing it. */
import type {V3} from './base';

export const reg: {focus: (f: number) => V3; linkAt: (f: number) => number; fFlood: number; fHit: number; button: V3} = {
	focus: () => [0, 0, 0],
	linkAt: () => 0,
	fFlood: 600,
	fHit: 210,
	button: [0, 0, 0],
};
