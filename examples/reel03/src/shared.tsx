import React from 'react';
import {measureWidths} from './motioner/creative';
import {Pt} from './motioner/motion';
import TLjson from './timeline.json';

export const TL = TLjson;
export const W = 1920;
export const H = 1080;
export const C = {
	ink: '#0F0E11',
	paper: '#EFEBE4',
	coral: '#FF5436',
	blue: '#2F3BF4',
	dark2: '#1B1A1F',
	grey: '#8A857D',
};
export const DISPLAY = "'Archivo Variable', sans-serif";
export const SERIF = "'Instrument Serif', serif";
export const MONO = "'JetBrains Mono', monospace";

/** Display type: extended black grotesk. Canvas and DOM use the same font so measured letter
 *  positions match what is drawn. */
export const displayStyle = (size: number, color: string): React.CSSProperties => ({
	fontFamily: DISPLAY,
	fontWeight: 800,
	fontStretch: '125%',
	fontSize: size,
	lineHeight: 1,
	color,
	letterSpacing: `${-0.02 * size}px`,
});
export const displayFont = (size: number) => `800 expanded ${size}px 'Archivo Variable'`;

const cache = new Map<string, number[]>();
/** letter left offsets + total advance (last entry) for display text */
export const layout = (text: string, size: number) => {
	const k = text + size;
	if (!cache.has(k)) cache.set(k, measureWidths(text, displayFont(size), -0.02 * size));
	return cache.get(k)!;
};

/** A filled circle positioned by its centre. `tr` is an extra transform (squash/stretch). */
export const Dot: React.FC<{p: Pt; r: number; color: string; tr?: string; opacity?: number; ring?: string}> = ({p, r, color, tr = '', opacity = 1, ring}) => (
	<div
		style={{
			position: 'absolute',
			left: p.x - r,
			top: p.y - r,
			width: 2 * r,
			height: 2 * r,
			borderRadius: '50%',
			background: ring ? 'transparent' : color,
			border: ring ? `1.5px solid ${ring}` : undefined,
			boxSizing: 'border-box',
			transform: tr || undefined,
			opacity,
		}}
	/>
);

export const Caption: React.FC<{text: string; frame: number; start: number; color: string; out?: number}> = ({text, frame, start, color, out}) => {
	const t = Math.min(1, Math.max(0, (frame - start) / 18));
	const u = 1 - Math.pow(1 - t, 3);
	const o = out !== undefined ? Math.min(1, Math.max(0, 1 - (frame - out) / 10)) : 1;
	return (
		<div style={{position: 'absolute', left: 160, top: 132, height: 116, overflow: 'hidden', opacity: o}}>
			<div style={{fontFamily: SERIF, fontStyle: 'italic', fontSize: 100, lineHeight: '116px', color, transform: `translateY(${(1 - u) * 100}%)`, whiteSpace: 'nowrap'}}>{text}</div>
		</div>
	);
};
