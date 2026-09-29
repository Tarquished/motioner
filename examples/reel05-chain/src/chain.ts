/* The whole machine: links triggered one after another. Each link exposes its own events and its own hand-over frame. */
import {Ev, V3, smooth} from './base';
import {Link} from './links/types';
import {Tick} from './links/l1_tick';
import {Roll} from './links/l2_roll';
import {Topple} from './links/l3_topple';
import {Launch} from './links/l4_launch';
import {Cradle} from './links/l5_cradle';
import {Gears} from './links/l6_gears';
import {MusicBox} from './links/l7_musicbox';
import {Letters} from './links/l8_letters';
import {reg} from './reg';
import {finale} from './look';

const tick = new Tick(60);
const roll = new Roll(tick, 210);

const topple = new Topple(roll);

const launch = new Launch(topple, 600);

const cradle = new Cradle(launch);
const gears = new Gears(cradle, 864);
const mbox = new MusicBox(gears);
const letters = new Letters(mbox, 1440);

export const links: Link[] = [tick, roll, topple, launch, cradle, gears, mbox, letters];
export const events: Ev[] = links.flatMap((l) => l.events).sort((a, b) => a.f - b.f);

export const focusAt = (f: number): V3 => {
	// the link that is active at frame f; the focus glides from the previous link to the new one over 18 frames
	let i = 0;
	links.forEach((l, k) => {
		if (f >= l.f0) i = k;
	});
	const cur = links[i].focus(f);
	if (i === 0) return cur;
	const w = smooth((f - links[i].f0) / 18);
	if (w >= 1) return cur;
	const prev = links[i - 1].focus(f);
	return [prev[0] + (cur[0] - prev[0]) * w, prev[1] + (cur[1] - prev[1]) * w, prev[2] + (cur[2] - prev[2]) * w];
};
reg.focus = focusAt;
reg.fFlood = launch.fButton;
reg.button = launch.buttonPos;
finale.at = [(letters.xs[0] + letters.xs[letters.xs.length - 1]) / 2, 3, letters.zc];
reg.linkAt = (f) => {
	let i = 0;
	links.forEach((l, k) => {
		if (f >= l.f0) i = k;
	});
	return i;
};
