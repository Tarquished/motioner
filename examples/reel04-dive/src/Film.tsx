import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {renderFrame} from './engine';
import {H, W} from './common';

export const Film: React.FC = () => {
	const f = useCurrentFrame();
	const ref = useRef<HTMLCanvasElement>(null);
	useLayoutEffect(() => {
		const g = ref.current!.getContext('2d')!;
		renderFrame(g, f);
	});
	return (
		<AbsoluteFill style={{background: '#0F0E11'}}>
			<canvas ref={ref} width={W} height={H} style={{width: W, height: H, display: 'block'}} />
		</AbsoluteFill>
	);
};
