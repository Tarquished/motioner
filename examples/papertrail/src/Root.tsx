import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/inter-tight';
import React, {useEffect, useState} from 'react';
import {Audio, Composition, continueRender, delayRender, staticFile} from 'remotion';
import {Film} from './Film';
import TL from './timeline.json';

/** Hold rendering until both families are really loaded, so no frame is drawn with a fallback font. */
const FontGate: React.FC<{children: React.ReactNode}> = ({children}) => {
	const [handle] = useState(() => delayRender('fonts'));
	const [ready, setReady] = useState(false);
	useEffect(() => {
		Promise.all([
			document.fonts.load("760 92px 'Bricolage Grotesque Variable'"),
			document.fonts.load("560 40px 'Inter Tight Variable'"),
		]).then(() => {
			setReady(true);
			continueRender(handle);
		});
	}, [handle]);
	return ready ? <>{children}</> : null;
};

const WithAudio: React.FC<{audio: boolean}> = ({audio}) => (
	<FontGate>
		<Film />
		{audio ? <Audio src={staticFile('audio/mix.wav')} /> : null}
	</FontGate>
);

export const RemotionRoot: React.FC = () => (
	<>
		<Composition id="Papertrail" component={WithAudio} durationInFrames={TL.durationInFrames} fps={TL.fps} width={TL.width} height={TL.height} defaultProps={{audio: true}} />
		<Composition id="PapertrailSilent" component={WithAudio} durationInFrames={TL.durationInFrames} fps={TL.fps} width={TL.width} height={TL.height} defaultProps={{audio: false}} />
	</>
);
