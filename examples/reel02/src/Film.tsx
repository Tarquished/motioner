import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {BandWipe, Grain, HudFrame, KineticWord, RgbSplit} from './motioner/creative';
import {ease, mixColor, prog} from './motioner/motion';
import {FloodReveal, ZoomThrough} from './motioner/transitions';
import {ideaCarrier, Idea, Logo, MERGE, MotionCh, Prompt, rhythmCarrier, Rhythm, Seed, SEED_END, SEED_R, ShapeCh} from './chapters';
import {C, displayStyle, Dot, H, TL, W} from './shared';

/* montage: half-beat cuts through the film's fields */
const M = TL.montage;
const Word: React.FC<{f: number; start: number; text: string; bg: string; color: string}> = ({f, start, text, bg, color}) => (
	<AbsoluteFill style={{background: bg, alignItems: 'center', justifyContent: 'center'}}>
		<KineticWord text={text} frame={f} start={start} mode="smear" dur={11} stagger={1} amount={1.2} style={displayStyle(300, color)} id={`mw${start}`} />
	</AbsoluteFill>
);
const shots: {bg: string; draw: (f: number, s: number) => React.ReactNode}[] = [
	{bg: C.coral, draw: (f, s) => <Word f={f} start={s} text="IDEA" bg={C.coral} color={C.ink} />},
	{bg: C.paper, draw: (f, s) => <MotionCh f={296 + (f - s) * 2} caption={false} />},
	{bg: C.blue, draw: (f, s) => <ShapeCh f={424 + (f - s)} caption={false} />},
	{bg: C.ink, draw: (f, s) => <Word f={f} start={s} text="MOTION" bg={C.ink} color={C.paper} />},
	{bg: C.paper, draw: (f, s) => <Rhythm f={546 + (f - s)} caption={false} drawDot={false} />},
	{bg: C.ink, draw: (f, s) => <Prompt f={636 + (f - s) * 2} caption={false} />},
	{bg: C.blue, draw: (f, s) => <Word f={f} start={s} text="SOUND" bg={C.blue} color={C.paper} />},
	{bg: C.coral, draw: (f, s) => <Word f={f} start={s} text="YOURS" bg={C.coral} color={C.ink} />},
];
const montageShot = (f: number) => {
	const k = Math.min(M.count - 1, Math.floor((f - M.start) / M.step));
	const s = M.start + k * M.step;
	return {k, s, node: shots[k].draw(f, s), bg: shots[k].bg};
};

const picture = (f: number): React.ReactNode => {
	const T = TL;
	if (f < T.seed.flood[0]) return <Seed f={f} />;
	if (f < T.motion.flood[0]) {
		return (
			<>
				{f < T.seed.flood[1] ? <Seed f={f} /> : null}
				<FloodReveal frame={f} start={T.seed.flood[0]} end={T.seed.flood[1]} origin={SEED_END} r0={SEED_R} width={W} height={H}>
					<Idea f={f} />
				</FloodReveal>
				{f >= T.idea.travel[0] ? (() => {
					const c = ideaCarrier(f);
					return <Dot p={c.p} r={c.r} color={C.ink} tr={c.tr} />;
				})() : null}
			</>
		);
	}
	if (f < T.shape.flood[0]) {
		return (
			<>
				{f < T.motion.flood[1] ? <Idea f={f} drawDot={false} /> : null}
				<FloodReveal frame={f} start={T.motion.flood[0]} end={T.motion.flood[1]} origin={{x: 960, y: 540}} r0={SEED_R} width={W} height={H}>
					<MotionCh f={f} />
				</FloodReveal>
				{f < T.motion.split[0] ? <Dot p={{x: 960, y: 540}} r={SEED_R} color={C.ink} /> : null}
			</>
		);
	}
	if (f < T.shape.zoom[0]) {
		return (
			<>
				{f < T.shape.flood[1] ? <MotionCh f={f} /> : null}
				<FloodReveal frame={f} start={T.shape.flood[0]} end={T.shape.flood[1]} origin={MERGE} r0={SEED_R} width={W} height={H}>
					<ShapeCh f={f} />
				</FloodReveal>
			</>
		);
	}
	if (f < T.rhythm.wipe[0]) {
		return (
			<ZoomThrough
				frame={f}
				start={T.shape.zoom[0]}
				end={T.shape.zoom[1]}
				focus={MERGE}
				maxScale={9}
				swapAt={0.62}
				inFrom={1.25}
				e={ease.inOut}
				incomingFocus={{x: 960, y: 540}}
				blur={4}
				outgoing={<ShapeCh f={f} />}
				incoming={<Rhythm f={f} />}
			/>
		);
	}
	if (f < T.montage.start) {
		const wp = prog(f, T.rhythm.wipe[0], T.rhythm.wipe[1], ease.inOut);
		return (
			<>
				{wp < 1 ? <Rhythm f={f} drawDot={false} /> : null}
				{wp < 1 ? <BandWipe progress={wp} angle={-18} color={C.ink} width={W} height={H} band={0.22} incoming={<Prompt f={f} />} /> : <Prompt f={f} />}
				{f < T.rhythm.travel[1] ? (() => {
					const c = rhythmCarrier(f);
					return <Dot p={c.p} r={c.r} color={C.coral} tr={c.tr} />;
				})() : null}
			</>
		);
	}
	if (f < T.logo.close[0]) {
		const {s, node, k} = montageShot(f);
		const amt = 18 * Math.max(0, 1 - (f - s) / 6);
		return (
			<RgbSplit amount={amt} id={`rgb${k}`}>
				{node}
			</RgbSplit>
		);
	}
	const last = M.start + (M.count - 1) * M.step;
	return <Logo f={f} closing={<Word f={f} start={last} text="YOURS" bg="transparent" color={C.ink} />} />;
};

/* HUD text colour follows the field under it; blends while a flood passes the corners */
const hudColor = (f: number) => {
	const T = TL;
	const steps: [number, number, string][] = [
		[T.seed.flood[0] + 12, T.seed.flood[0] + 20, C.ink],
		[T.motion.flood[0] + 14, T.motion.flood[0] + 22, C.ink],
		[T.shape.flood[0] + 14, T.shape.flood[0] + 22, C.paper],
		[T.shape.zoom[0] + 17, T.shape.zoom[0] + 21, C.ink],
		[T.rhythm.wipe[0] + 12, T.rhythm.wipe[0] + 22, C.paper],
	];
	if (f >= T.montage.start && f < T.logo.close[0]) {
		const bg = montageShot(f).bg;
		return bg === C.paper || bg === C.coral ? C.ink : C.paper;
	}
	if (f >= T.logo.close[0]) return mixColor(C.ink, C.paper, prog(f, T.logo.close[0], T.logo.close[0] + 6));
	let c = C.paper;
	for (const [a, b, to] of steps) {
		if (f >= a) c = f >= b ? to : mixColor(c, to, prog(f, a, b));
	}
	return c;
};

const chapterLabel = (f: number) => {
	const T = TL;
	if (f < T.seed.flood[0]) return '01 / 06   A DOT';
	if (f < T.motion.flood[0]) return '02 / 06   AN IDEA';
	if (f < T.shape.flood[0]) return '03 / 06   MOTION';
	if (f < T.rhythm.drops[0] - 11) return '04 / 06   SHAPE';
	if (f < T.rhythm.wipe[0] + 14) return '05 / 06   RHYTHM';
	if (f < T.montage.start) return '06 / 06   YOU';
	if (f < T.logo.close[0]) return 'ALL TOGETHER';
	return 'MOTIONER';
};

export const Film: React.FC = () => {
	const f = useCurrentFrame();
	const hc = hudColor(f);
	const onCoral = (f >= TL.seed.flood[0] + 16 && f < TL.motion.flood[0] + 18) || (f >= TL.montage.start && f < TL.logo.close[0] && montageShot(f).bg === C.coral);
	return (
		<AbsoluteFill style={{background: C.ink}}>
			{picture(f)}
			<HudFrame frame={f} fps={TL.fps} total={TL.durationInFrames} width={W} height={H} title="MOTIONER / REEL 02" chapter={chapterLabel(f)} bpm={TL.bpm} color={hc} accent={onCoral ? C.ink : C.coral} appear={[4, 30]} />
			<Grain frame={f} opacity={0.07} vignette={0.2} />
		</AbsoluteFill>
	);
};
