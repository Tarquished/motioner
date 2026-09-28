import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Grain, HudFrame} from './motioner/creative';
import {mixColor, prog} from './motioner/motion';
import {Idea, Intro, Outro, SceneWords, Scenes, Sound, Timing, TL} from './scenes';
import {C, H, W} from './shared';

const picture = (f: number): React.ReactNode => {
	if (f < TL.timing.drop[0]) return <Intro f={f} />;
	if (f < TL.sound.sink[0]) return <Timing f={f} />;
	if (f < TL.idea.fall[0]) return <Sound f={f} />;
	if (f < TL.idea.portal[1]) return <Idea f={f} inner={<Scenes f={f} />} />;
	if (f < TL.outro.shrink[0]) {
		return (
			<>
				<Scenes f={f} />
				<SceneWords f={f} />
			</>
		);
	}
	if (f < TL.outro.fly[0]) {
		const k = prog(f, TL.outro.shrink[0], TL.outro.fly[0]);
		return (
			<>
				<Scenes f={f} shrink={k} bg={mixColor(C.blue, C.ink, prog(f, TL.outro.shrink[0], TL.outro.fly[0] + 2))} />
				<SceneWords f={f} />
			</>
		);
	}
	return <Outro f={f} />;
};

/* HUD text follows the field under it */
const hud = (f: number) => {
	const light = C.ink;
	const dark = C.paper;
	if (f < TL.timing.field[0] + 12) return dark;
	if (f < TL.timing.field[1]) return mixColor(dark, light, prog(f, TL.timing.field[0] + 12, TL.timing.field[1]));
	if (f < TL.idea.portal[0] + 16) return light;
	if (f < TL.idea.portal[1]) return mixColor(light, dark, prog(f, TL.idea.portal[0] + 16, TL.idea.portal[1]));
	return dark;
};
const chapter = (f: number) => {
	if (f < TL.timing.drop[0]) return '01 / 05   THE WORD';
	if (f < TL.sound.sink[0]) return '02 / 05   TIMING';
	if (f < TL.idea.fall[0]) return '03 / 05   SOUND';
	if (f < TL.idea.portal[1] - 10) return '04 / 05   MORPH';
	if (f < TL.outro.shrink[0]) return '05 / 05   SCENES';
	return 'MOTIONER';
};

export const Film: React.FC = () => {
	const f = useCurrentFrame();
	const hc = hud(f);
	const onCoral = f >= TL.sound.flood[1] - 10 && f < TL.idea.portal[1];
	return (
		<AbsoluteFill style={{background: C.ink}}>
			{picture(f)}
			<HudFrame frame={f} fps={TL.fps} total={TL.durationInFrames} width={W} height={H} title="MOTIONER / REEL 03" chapter={chapter(f)} bpm={TL.bpm} color={hc} accent={onCoral ? C.ink : C.coral} appear={[20, 60]} />
			<Grain frame={f} opacity={0.07} vignette={0.2} />
		</AbsoluteFill>
	);
};
