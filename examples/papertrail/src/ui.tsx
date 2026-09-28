import React from 'react';
import {clamp01, ease, lerp, mixColor, prog, springAt} from './motioner/motion';

export const C = {
	paper: '#F2EEE4',
	dot: '#DDD6C6',
	ink: '#1B1D24',
	muted: '#8A8F9C',
	card: '#FFFFFF',
	brand: '#3355FF',
	brandDeep: '#2438C9',
	green: '#1FAF6E',
	notes: ['#FFD85C', '#FF9FB2', '#8FE3C2', '#9CCBFF', '#FFC08A', '#C6B5FF', '#FFE89A'],
};

export const DISPLAY = "'Bricolage Grotesque Variable', 'Bricolage Grotesque', sans-serif";
export const UI = "'Inter Tight Variable', 'Inter Tight', sans-serif";

/** Handwritten-looking scribble lines for a sticky note (deterministic per index). */
export const NoteFace: React.FC<{i: number; size: number}> = ({i, size}) => {
	const lines = [0.62, 0.48, 0.7, 0.4].slice(0, 2 + (i % 3));
	return (
		<svg width={size} height={size} viewBox="0 0 100 100" style={{position: 'absolute', inset: 0}}>
			{lines.map((w, k) => (
				<path
					key={k}
					d={`M 14 ${24 + k * 16} q ${w * 20} ${-3 + ((i + k) % 3) * 2} ${w * 36} 0 t ${w * 36} ${1 - ((i + k) % 2) * 2}`}
					stroke="rgba(27,29,36,0.55)"
					strokeWidth={3.2}
					strokeLinecap="round"
					fill="none"
				/>
			))}
		</svg>
	);
};

export const Checkbox: React.FC<{frame: number; at: number | null; size: number}> = ({frame, at, size}) => {
	const on = at !== null && frame >= at;
	const pop = on ? springAt(frame, 60, at!, {damping: 11, stiffness: 260}) : 0;
	const draw = on ? prog(frame, at! + 1, at! + 11, ease.out) : 0;
	const s = on ? 0.82 + 0.18 * pop + 0.08 * Math.sin(Math.PI * clamp01((frame - at!) / 10)) : 1;
	return (
		<div
			style={{
				width: size,
				height: size,
				borderRadius: size * 0.28,
				border: `${Math.max(3, size * 0.07)}px solid ${on ? mixColor(C.muted, C.green, clamp01(pop * 1.5)) : '#C9CCD4'}`,
				background: on ? mixColor('#FFFFFF', C.green, clamp01(pop * 1.4)) : '#FFFFFF',
				transform: `scale(${s})`,
				boxSizing: 'border-box',
				position: 'relative',
				flex: 'none',
			}}
		>
			<svg viewBox="0 0 24 24" width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
				<path d="M6 12.5 L10.2 16.5 L18 8" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={20} strokeDashoffset={20 * (1 - draw)} />
			</svg>
		</div>
	);
};

export const ROW_W = 688;
export const ROW_H = 70;

/** One checklist row, laid out at card size (688 x 70). Scale it for other sizes. */
export const Row: React.FC<{frame: number; label: string; checkedAt: number | null}> = ({frame, label, checkedAt}) => {
	const strike = checkedAt !== null ? prog(frame, checkedAt + 4, checkedAt + 18, ease.inOut) : 0;
	return (
		<div style={{width: ROW_W, height: ROW_H, display: 'flex', alignItems: 'center', gap: 28, fontFamily: UI}}>
			<Checkbox frame={frame} at={checkedAt} size={54} />
			<div style={{position: 'relative', fontSize: 40, fontWeight: 560, color: mixColor(C.ink, C.muted, strike), letterSpacing: -0.4, whiteSpace: 'nowrap'}}>
				{label}
				<div style={{position: 'absolute', left: -4, top: '54%', height: 4, borderRadius: 2, background: C.muted, width: `calc(${strike * 100}% + ${8 * strike}px)`}} />
			</div>
		</div>
	);
};

/** A touch: approaches on an arc, presses (scale down, ring tightens), releases with a ripple. */
export const Touch: React.FC<{frame: number; path: {f: number; x: number; y: number}[]; taps: number[]}> = ({frame, path, taps}) => {
	if (frame < path[0].f - 1 || frame > path[path.length - 1].f + 22) return null;
	let x = path[0].x;
	let y = path[0].y;
	for (let i = 0; i < path.length - 1; i++) {
		const a = path[i];
		const b = path[i + 1];
		if (frame >= a.f && frame <= b.f) {
			const t = ease.inOut(clamp01((frame - a.f) / (b.f - a.f)));
			// slight arc: humans do not move in straight lines
			x = lerp(a.x, b.x, t) + Math.sin(Math.PI * t) * (b.y - a.y) * 0.08;
			y = lerp(a.y, b.y, t) - Math.sin(Math.PI * t) * 26;
		} else if (frame > b.f) {
			x = b.x;
			y = b.y;
		}
	}
	const fadeIn = clamp01((frame - path[0].f + 1) / 8);
	const fadeOut = 1 - clamp01((frame - path[path.length - 1].f - 6) / 14);
	let press = 0;
	let ripple: number | null = null;
	for (const t of taps) {
		if (frame >= t - 5 && frame <= t + 6) press = Math.max(press, 1 - Math.abs(frame - t) / (frame < t ? 5 : 6));
		if (frame >= t && frame < t + 22) ripple = (frame - t) / 22;
	}
	return (
		<div style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none', opacity: fadeIn * fadeOut}}>
			{ripple !== null ? (
				<div
					style={{
						position: 'absolute',
						left: x - 40 - 50 * ease.out(ripple),
						top: y - 40 - 50 * ease.out(ripple),
						width: 80 + 100 * ease.out(ripple),
						height: 80 + 100 * ease.out(ripple),
						borderRadius: '50%',
						border: `4px solid rgba(51,85,255,${0.5 * (1 - ripple)})`,
					}}
				/>
			) : null}
			<div
				style={{
					position: 'absolute',
					left: x - 38,
					top: y - 38,
					width: 76,
					height: 76,
					borderRadius: '50%',
					background: 'rgba(27,29,36,0.22)',
					border: '4px solid rgba(255,255,255,0.9)',
					boxShadow: '0 8px 24px rgba(27,29,36,0.25)',
					transform: `scale(${1 - 0.22 * press})`,
				}}
			/>
		</div>
	);
};

export const Chip: React.FC<{frame: number; at: number; label: string; color: string}> = ({frame, at, label, color}) => {
	const s = springAt(frame, 60, at, {damping: 12, stiffness: 220});
	return (
		<div
			style={{
				padding: '14px 30px',
				borderRadius: 999,
				background: color,
				fontFamily: UI,
				fontSize: 34,
				fontWeight: 600,
				color: C.ink,
				transform: `translateY(${(1 - s) * 30}px) scale(${0.6 + 0.4 * s})`,
				opacity: clamp01(s * 2),
			}}
		>
			{label}
		</div>
	);
};

/** Progress ring with an odometer count. */
export const Ring: React.FC<{frame: number; at: number; from: number; to: number; changeAt: number; total: number}> = ({frame, at, from, to, changeAt, total}) => {
	const appear = springAt(frame, 60, at, {damping: 14, stiffness: 200});
	const k = prog(frame, changeAt, changeAt + 14, ease.out);
	const value = lerp(from, to, k);
	const R = 130;
	const L = 2 * Math.PI * R;
	const pulse = frame >= changeAt + 12 ? Math.sin(Math.PI * clamp01((frame - changeAt - 12) / 14)) : 0;
	const shown = Math.round(value) as number;
	const roll = value - Math.floor(value);
	return (
		<div style={{width: 320, height: 320, position: 'relative', transform: `scale(${(0.7 + 0.3 * appear) * (1 + 0.05 * pulse)})`, opacity: clamp01(appear * 2)}}>
			<svg viewBox="0 0 320 320" width={320} height={320}>
				<circle cx={160} cy={160} r={R} stroke="#E7E9EF" strokeWidth={26} fill="none" />
				<circle
					cx={160}
					cy={160}
					r={R}
					stroke={value >= total - 0.01 ? C.green : C.brand}
					strokeWidth={26}
					fill="none"
					strokeLinecap="round"
					strokeDasharray={L}
					strokeDashoffset={L * (1 - (value / total) * appear)}
					transform="rotate(-90 160 160)"
				/>
			</svg>
			<div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: DISPLAY, fontWeight: 760, fontSize: 92, color: C.ink}}>
				<div style={{height: 100, overflow: 'hidden', position: 'relative', width: 60}}>
					{[Math.floor(value), Math.floor(value) + 1].map((n, i) => (
						<div key={n} style={{position: 'absolute', left: 0, top: (i - roll) * 100, width: 60, textAlign: 'center', lineHeight: '100px'}}>
							{n}
						</div>
					))}
				</div>
				<span style={{color: C.muted, fontSize: 64}}>/{total}</span>
			</div>
			<span style={{display: 'none'}}>{shown}</span>
		</div>
	);
};
