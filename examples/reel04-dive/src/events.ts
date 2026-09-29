/* Numbers the score script needs from the picture: the zoom rate of every dive (so the sound of the zoom follows the camera exactly). */
import {zoomRate} from './camera';
import TL from './timeline.json';

export const buildEvents = () => {
	const dives = TL.S.map((S, i) => {
		const start = S - 8;
		const end = TL.A[i + 1] + 12;
		const rate: number[] = [];
		for (let f = start; f <= end; f++) rate.push(Math.round(zoomRate(f) * 1e5) / 1e5);
		return {i, start, end, rate};
	});
	return {dives, A: TL.A, S: TL.S};
};
