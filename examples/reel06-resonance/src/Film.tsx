import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {continueRender, delayRender, getInputProps, useCurrentFrame} from 'remotion';
import {Assets, Engine, H, W, loadAssets} from './engine';
import {frameAt, grade, hudDark, roseState, scopeState} from './scenes';
import {ease, clamp01} from './motion';
import {PAL, RGB} from './frame';
import TL from './timeline.json';

let engine: Engine | null = null;
const MONO = "'JetBrains Mono', monospace";
const SERIF = "'Instrument Serif', serif";
const css = (c: RGB) => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
const PAPER = css(PAL.paper);
const INK = css(PAL.ink);
const CHAPTERS: [number, string][] = [[0, 'HUM'], [120, 'PING'], [240, 'SOUND'], [360, 'MOTION'], [450, 'FRAME'], [720, 'PLATE'], [1080, 'TOGETHER'], [1440, 'MOTIONER.']];
const NOTE_HZ = [164.8, 196.0, 246.9, 329.6, 392.0, 493.9, 659.3, 784.0];
const NOTE_NAME = ['E3', 'G3', 'B3', 'E4', 'G4', 'B4', 'E5', 'G5'];
const TAG = ['sound,', 'on the', 'frame.'];
const tc = (f: number) => {
	const s = Math.floor(f / 60);
	return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}:${String(f % 60).padStart(2, '0')}`;
};
const sm = (a: number, b: number, x: number) => {
	const t = clamp01((x - a) / (b - a));
	return t * t * (3 - 2 * t);
};

export const Film: React.FC = () => {
	const f = useCurrentFrame();
	const ref = useRef<HTMLCanvasElement>(null);
	const [handle] = useState(() => delayRender('assets'));
	const [assets, setAssets] = useState<Assets | null>(null);
	useEffect(() => {
		loadAssets().then((a) => {
			setAssets(a);
			continueRender(handle);
		});
	}, [handle]);
	useLayoutEffect(() => {
		if (!assets || !ref.current) return;
		if (!engine) engine = new Engine(ref.current, assets);
		const props = getInputProps() as {sub?: number; shutter?: number};
		engine.draw(f, props.sub ?? 12, props.shutter ?? 0.5, frameAt, grade(f));
	}, [f, assets]);

	// chrome: fades in, hides during the push-through, follows the colour under it
	const chromeA = sm(6, 26, f) * (1 - sm(452, 466, f)) + sm(510, 526, f) * sm(452, 466, f);
	const opacity = f < 452 ? sm(6, 26, f) : f < 510 ? 1 - sm(452, 466, f) : sm(510, 526, f);
	void chromeA;
	const col = (x: number, y: number) => (hudDark(f, x, y) ? PAPER : INK);
	const txt = (x: number, y: number, extra: React.CSSProperties = {}): React.CSSProperties => ({
		position: 'absolute', fontFamily: MONO, fontSize: 24, letterSpacing: 3.2, textTransform: 'uppercase', whiteSpace: 'nowrap', color: col(x, y), ...extra,
	});
	const mark = (x: number, y: number, style: React.CSSProperties) => (
		<div style={{position: 'absolute', width: 34, height: 34, borderColor: col(x, y), borderStyle: 'solid', borderWidth: 0, ...style}} />
	);
	const cur = CHAPTERS.reduce((a, c, i) => (f >= c[0] ? i : a), 0);
	const bar = Math.floor(f / 120) + 1;
	const S = scopeState(f);
	const showScope = f >= 516 && f < 720;
	const scopeA = sm(516, 530, f) * (1 - sm(664, 692, f));
	const R = roseState(f);
	const noteI = TL.ring.notes.reduce((a, t, i) => (f >= t ? i : a), -1);
	const showPlate = f >= 744 && f < 1080;
	const tagT = (f - TL.finale.tagline[0]) / 26;
	const fadeOut = 1 - sm(TL.finale.fade[0], TL.finale.fade[1], f);
	return (
		<div style={{position: 'absolute', inset: 0, background: '#000', overflow: 'hidden'}}>
			<canvas ref={ref} width={W} height={H} style={{position: 'absolute', width: W, height: H}} />
			<div style={{position: 'absolute', inset: 0, opacity: opacity * fadeOut}}>
				{mark(56, 56, {left: 56, top: 56, borderLeftWidth: 3, borderTopWidth: 3})}
				{mark(W - 56, 56, {right: 56, top: 56, borderRightWidth: 3, borderTopWidth: 3})}
				{mark(56, H - 56, {left: 56, bottom: 56, borderLeftWidth: 3, borderBottomWidth: 3})}
				{mark(W - 56, H - 56, {right: 56, bottom: 56, borderRightWidth: 3, borderBottomWidth: 3})}
				<div style={txt(104, 86, {left: 104, top: 84})}>motioner. <span style={{opacity: 0.55}}>reel 06 / resonance</span></div>
				<div style={txt(W - 104, 86, {right: 104, top: 84, textAlign: 'right'})}>{tc(f)} <span style={{opacity: 0.55}}>/ 120 bpm / bar {bar}</span></div>
				<div style={txt(104, H - 86, {left: 104, bottom: 84, display: 'flex', gap: 34})}>
					{CHAPTERS.map(([, name], k) => (
						<span key={name} style={{opacity: k === cur ? 1 : 0.38}}>
							{String(k + 1).padStart(2, '0')} {name}
						</span>
					))}
				</div>
				<div style={txt(W - 104, H - 86, {right: 104, bottom: 84, width: 460, height: 4, background: col(W - 104, H - 86), opacity: 0.35})} />
				<div style={txt(W - 104, H - 86, {right: 104 + 460 * (1 - f / TL.durationInFrames), bottom: 84, width: 4, height: 16, background: col(W - 104, H - 86), transform: 'translateY(-6px)'})} />
			</div>
			{showScope && (
				<div style={{position: 'absolute', inset: 0, opacity: scopeA}}>
					<div style={{...txt(0, 0, {color: PAPER}), left: W / 2 - 1140 + 34, top: H / 2 - 480 + 28}}>sound on the frame</div>
					<div style={{...txt(0, 0, {color: PAPER}), right: W / 2 - 1140 + 34, top: H / 2 - 480 + 28}}>f {String(f).padStart(4, '0')} <span style={{opacity: 0.55}}>/ {(f / 60).toFixed(2)} s</span></div>
					<div style={{...txt(0, 0, {color: PAPER}), left: W / 2 - 1140 + 34, bottom: H / 2 - 480 + 28}}>
						{S.eOut < 0.5 ? 'this film’s own soundtrack' : 'the whole film / 30.00 s / 48 khz'}
					</div>
					<div style={{...txt(0, 0, {color: PAPER}), right: W / 2 - 1140 + 34, bottom: H / 2 - 480 + 28}}>
						<span style={{color: css(PAL.coral)}}>{'●'}</span> playhead
					</div>
				</div>
			)}
			{showPlate && (
				<div style={{...txt(W / 2, 90, {left: 0, right: 0, textAlign: 'center', top: 84}), opacity: opacity * sm(744, 760, f)}}>
					plate / mode {String(R.m2).padStart(2, '0')}
					{noteI >= 0 && f < 960 ? ` / ${NOTE_NAME[noteI]} ${NOTE_HZ[noteI].toFixed(1)} hz` : ' / accelerando'}
				</div>
			)}
			{f >= TL.finale.tagline[0] - 4 && (
				<div style={{position: 'absolute', left: 0, right: 0, top: H / 2 + 230, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: 108, color: PAPER, display: 'flex', justifyContent: 'center', gap: 30, opacity: fadeOut}}>
					{TAG.map((w, k) => {
						const t = clamp01(tagT - k * 0.46);
						const e = ease.out(t);
						return (
							<span key={k} style={{opacity: e, transform: `translateY(${(1 - e) * 34}px)`, filter: `blur(${(1 - e) * 7}px)`}}>
								{w}
							</span>
						);
					})}
				</div>
			)}
		</div>
	);
};
