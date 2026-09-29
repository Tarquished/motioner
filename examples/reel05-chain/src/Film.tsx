import React, {useLayoutEffect, useRef} from 'react';
import {getInputProps, useCurrentFrame} from 'remotion';
import {W, H} from './gfx';
import {World} from './world';
import {links, events} from './chain';
import {project} from './camera';
import {lookLit} from './look';
import {reg} from './reg';
import {PAL, BEAT} from './base';
import TL from './timeline.json';

let world: World | null = null;

const MONO = "'JetBrains Mono', monospace";
const NOTE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const noteName = (m: number) => `${NOTE[m % 12]}${Math.floor(m / 12) - 1}`;
const tc = (f: number) => {
	const s = Math.floor(f / 60);
	return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(f % 60).padStart(2, '0')}`;
};
const TAG = ['every move', 'starts where', 'the last one ends.'];
const FTAG = 1612;

const callout = (f: number) => {
	const i = reg.linkAt(f);
	const l = links[i];
	const fo = l.focus(f);
	const fo2 = l.focus(f + 1);
	const v = Math.hypot(fo2[0] - fo[0], fo2[1] - fo[1], fo2[2] - fo[2]) * 60;
	let label = l.label;
	let value = `${v.toFixed(1)} u/s`;
	const mb: any = links[6];
	if (l.name === 'musicbox') {
		let cur: any = null;
		for (const n of mb.notes) if (n.f <= f + 2) cur = n;
		if (cur) value = noteName(cur.midi);
	}
	if (l.name === 'letters') {
		const lt: any = links[7];
		const n = lt.trig.filter((t: number) => f >= t).length;
		value = n > 0 ? `${'motioner'.slice(0, n)}` : 'ready';
	}
	if (l.name === 'topple') {
		const t: any = l;
		value = `${Math.min(t.sim.N, Math.floor(t.head(f)))} / ${t.sim.N}`;
	}
	if (l.name === 'gears') {
		const g: any = l;
		value = `${(Math.abs(g.angle(3, f + 1) - g.angle(3, f)) * 60 / (2 * Math.PI) * 60).toFixed(0)} rpm`;
	}
	return {i, label, value, p: project(f, fo)};
};

export const Film: React.FC = () => {
	const f = useCurrentFrame();
	const ref = useRef<HTMLCanvasElement>(null);
	useLayoutEffect(() => {
		if (!world) world = new World(ref.current!, links);
		const props = getInputProps() as {sub?: number; cam?: number[]};
		const n = props.sub ?? 24;
		if (props.cam) {
			const c = props.cam;
			world.debugCam = {pos: [c[0], c[1], c[2]], look: [c[3], c[4], c[5]], fov: c[6] ?? 30, shadowR: c[7] ?? 40, aperture: 0};
		}
		world.draw(f, n);
	}, [f]);
	const fade = lookLit(f).fade;
	const wl = Math.max(0, Math.min(1, (f - reg.fFlood) / 40)) * (1 - Math.max(0, Math.min(1, (f - 1300) / 100)));
	const ink = Math.round(255 * (1 - wl) + 15 * wl);
	const hc = `rgb(${ink},${ink},${ink})`;
	const co = callout(f);
	const cur = co.i;
	const tagT = (f - FTAG) / 22;
	const showCall = f > 30 && f < 1600 && co.p.z > 0 && co.p.x > 200 && co.p.x < 1720 && co.p.y > 160 && co.p.y < 900;
	const txt: React.CSSProperties = {position: 'absolute', fontFamily: MONO, fontSize: 19, letterSpacing: 2.4, color: hc, textTransform: 'uppercase'};
	const mark = (style: React.CSSProperties) => <div style={{position: 'absolute', width: 26, height: 26, borderColor: hc, borderStyle: 'solid', borderWidth: 0, ...style}} />;
	const cpop = Math.min(1, Math.max(0, (f - links[cur].f0) / 14));
	return (
		<div style={{position: 'absolute', inset: 0, background: '#000', overflow: 'hidden'}}>
			<canvas ref={ref} width={W} height={H} style={{position: 'absolute', width: W, height: H}} />
			<div style={{position: 'absolute', inset: 0, opacity: fade}}>
				{mark({left: 40, top: 40, borderLeftWidth: 2, borderTopWidth: 2})}
				{mark({right: 40, top: 40, borderRightWidth: 2, borderTopWidth: 2})}
				{mark({left: 40, bottom: 40, borderLeftWidth: 2, borderBottomWidth: 2})}
				{mark({right: 40, bottom: 40, borderRightWidth: 2, borderBottomWidth: 2})}
				<div style={{...txt, left: 76, top: 62}}>motioner. <span style={{opacity: 0.55}}>reel 05 / chain reaction</span></div>
				<div style={{...txt, right: 76, top: 62, textAlign: 'right'}}>{tc(f)} <span style={{opacity: 0.55}}>/ 120 bpm / bar {Math.floor(f / (BEAT * 4)) + 1}</span></div>
				<div style={{...txt, left: 76, bottom: 62, display: 'flex', gap: 26}}>
					{links.map((l, k) => (
						<span key={l.name} style={{opacity: k === cur ? 1 : 0.38}}>
							{String(k + 1).padStart(2, '0')} {l.label}
						</span>
					))}
				</div>
				<div style={{...txt, right: 76, bottom: 62, width: 340, height: 3, background: hc, opacity: 0.35}} />
				<div style={{...txt, right: 76 + 340 * (1 - f / TL.durationInFrames), bottom: 62, width: 3, height: 13, marginTop: -5, background: hc, transform: 'translateY(-5px)'}} />
				{showCall && (
					<div style={{position: 'absolute', left: co.p.x, top: co.p.y, opacity: cpop}}>
						<div style={{position: 'absolute', left: -14, top: -14, width: 28, height: 28, border: `2px solid ${hc}`, borderRadius: 14}} />
						<div style={{position: 'absolute', left: 14, top: -14, width: 46 * cpop, height: 2, background: hc}} />
						<div style={{...txt, left: 66, top: -27, whiteSpace: 'nowrap', fontSize: 16}}>
							{String(cur + 1).padStart(2, '0')} {co.label} <span style={{opacity: 0.7}}>{co.value}</span>
						</div>
					</div>
				)}
				{f >= FTAG - 4 && (
					<div style={{position: 'absolute', left: 0, right: 0, bottom: 112, textAlign: 'center', fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 80, color: PAL.paper, display: 'flex', justifyContent: 'center', gap: 22}}>
						{TAG.map((w, k) => {
							const t = Math.min(1, Math.max(0, tagT - k * 0.42));
							const e = 1 - Math.pow(1 - t, 3);
							return (
								<span key={k} style={{opacity: e, transform: `translateY(${(1 - e) * 26}px)`, filter: `blur(${(1 - e) * 5}px)`}}>
									{w}
								</span>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
};
void events;
