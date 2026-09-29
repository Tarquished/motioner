/* Everything the score needs, exported from the same code that draws the picture. */
import {links, events} from './chain';
import {reg} from './reg';
import TL from './timeline.json';

const lt: any = links[7];
const mb: any = links[6];
const dom: any = links[2];
export const events_out = {
	fps: TL.fps,
	frames: TL.durationInFrames,
	fFlood: reg.fFlood,
	links: links.map((l) => ({name: l.name, f0: l.f0, f1: l.f1})),
	events,
	dominoH: dom.sim.h,
	notes: mb.notes,
	letters: {trig: lt.trig, up: lt.up, tStop: lt.tStop, fStart: lt.fStart, fGate: lt.fGate},
};
