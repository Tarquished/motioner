import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/jetbrains-mono/500.css';
import React, {useEffect, useState} from 'react';
import {Composition, continueRender, delayRender} from 'remotion';
import {Film} from './Film';
import TL from './timeline.json';

const FontGate: React.FC = () => {
	const [handle] = useState(() => delayRender('fonts'));
	const [ready, setReady] = useState(false);
	useEffect(() => {
		Promise.all([
			document.fonts.load("800 expanded 150px 'Archivo Variable'"),
			document.fonts.load("450 32px 'Archivo Variable'"),
			document.fonts.load("italic 400 76px 'Instrument Serif'"),
			document.fonts.load("500 16px 'JetBrains Mono'"),
		]).then(() => {
			setReady(true);
			continueRender(handle);
		});
	}, [handle]);
	return ready ? <Film /> : null;
};

export const RemotionRoot: React.FC = () => (
	<Composition id="FilmSilent" component={FontGate} durationInFrames={TL.durationInFrames} fps={TL.fps} width={TL.width} height={TL.height} />
);
