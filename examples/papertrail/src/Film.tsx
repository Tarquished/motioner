import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import TL from './timeline.json';
import {arc, clamp01, ease, lerp, mixColor, poseTrack, prog, rand, Rect, springAt} from './motioner/motion';
import {handoff, LetterMorph, MorphCarrier, PathMorph} from './motioner/Morph';
import {FloodReveal} from './motioner/transitions';
import {C, Chip, DISPLAY, NoteFace, Ring, Row, ROW_H, ROW_W, Touch, UI} from './ui';

const W = TL.width;
const H = TL.height;
const NOTE = 250;
const CARD: Rect = {x: 140, y: 700, w: 800, h: 620, r: 40};
const FULL: Rect = {x: 0, y: 0, w: W, h: H, r: 0};
const CENTER = {x: 540, y: 1010};
const LABELS = ['Draft the brief', 'Book the studio', 'Send the invite'];
const DETAIL_ROW = (k: number): Rect => ({x: 100, y: 1110 + k * 112, w: ROW_W * 1.15, h: ROW_H * 1.15});
const CARD_ROW = (k: number): Rect => ({x: CARD.x + 56, y: CARD.y + 230 + k * 110, w: ROW_W, h: ROW_H});
const TITLE_CARD: Rect = {x: CARD.x + 56, y: CARD.y + 50, w: 440, h: 84};
const TITLE_DETAIL: Rect = {x: 100, y: 240, w: 440 * 1.5, h: 84 * 1.5};

const NOTES = [
	{cx: 420, cy: 930, rot: -7},
	{cx: 770, cy: 690, rot: 9},
	{cx: 290, cy: 1290, rot: 6},
	{cx: 810, cy: 1150, rot: -11},
	{cx: 560, cy: 1530, rot: 4},
	{cx: 250, cy: 640, rot: 12},
	{cx: 760, cy: 1450, rot: -5},
];

/* ── Notes: drop in, idle, shuffle, anticipate ─────────────────────────────── */
const notePose = (i: number, f: number) => {
	const n = NOTES[i];
	const land = TL.notes.land[i];
	const drop = 1 - prog(f, land - 12, land, ease.out);
	const idle = clamp01((f - land) / 20);
	const wob = Math.sin(f / 38 + i * 1.9) * 1.3 * idle;
	const fl = Math.sin(f / 33 + i * 1.3) * 5 * idle;
	// shuffle: two clear nudges (notes get pushed around, as if new ones keep arriving)
	const bump = (k: number) => Math.sin(Math.PI * clamp01((f - TL.notes.shuffle[k] - i * 3) / 26));
	const sh = TL.notes.shuffle.map((_, k) => bump(k) * (k % 2 ? -1 : 1) * (i % 2 ? 44 : -36)).reduce((a, b) => a + b, 0);
	const shY = TL.notes.shuffle.map((_, k) => bump(k) * (i % 3 === 0 ? -22 : 14)).reduce((a, b) => a + b, 0);
	const shR = TL.notes.shuffle.map((_, k) => bump(k) * (i % 2 ? 7 : -6)).reduce((a, b) => a + b, 0);
	const lift = TL.notes.shuffle.map((_, k) => bump(k)).reduce((a, b) => Math.max(a, b), 0);
	// anticipation: breathe out from the centre before converging
	const an = prog(f, TL.notes.anticip[0], TL.notes.anticip[1], ease.inOut);
	const dx = (n.cx - CENTER.x) * 0.06 * an;
	const dy = (n.cy - CENTER.y) * 0.06 * an;
	return {
		cx: n.cx + sh + dx,
		cy: n.cy - 70 * drop + fl + dy + shY,
		rot: n.rot + wob + shR + 4 * an * Math.sign(n.rot) + drop * 6,
		scale: 1 + 0.12 * drop + 0.03 * an + 0.05 * lift,
		opacity: clamp01((f - (land - 12)) / 5),
		squash: f >= land && f < land + 8 ? Math.sin((Math.PI * (f - land)) / 8) : 0,
	};
};

const noteRect = (p: ReturnType<typeof notePose>): Rect => ({x: p.cx - (NOTE * p.scale) / 2, y: p.cy - (NOTE * p.scale) / 2, w: NOTE * p.scale, h: NOTE * p.scale, r: 10});

const StickyNote: React.FC<{i: number; rect: Rect; rot: number; opacity?: number; squash?: number; z?: number}> = ({i, rect, rot, opacity = 1, squash = 0, z = 1}) => (
	<div
		style={{
			position: 'absolute',
			left: rect.x,
			top: rect.y,
			width: rect.w,
			height: rect.h,
			borderRadius: rect.r,
			background: C.notes[i],
			boxShadow: '0 10px 26px rgba(40,34,20,0.16), 0 2px 4px rgba(40,34,20,0.10)',
			transform: `rotate(${rot}deg) scale(${1 + 0.03 * squash}, ${1 - 0.04 * squash})`,
			opacity,
			zIndex: z,
			overflow: 'hidden',
		}}
	>
		<div style={{position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `scale(${rect.w / NOTE})`, width: NOTE, height: NOTE}}>
			<NoteFace i={i} size={NOTE} />
		</div>
	</div>
);

/* ── Card content (laid out at card size) ───────────────────────────────────── */
const CardTitle: React.FC = () => (
	<div style={{fontFamily: DISPLAY, fontWeight: 720, fontSize: 64, letterSpacing: -1.5, color: C.ink, lineHeight: '84px', whiteSpace: 'nowrap'}}>Launch plan</div>
);
/* the title travels on its own carrier during the expand, so the container carries only this */
const CardSubtitle: React.FC = () => (
	<div style={{position: 'absolute', left: 58, top: 142, fontFamily: UI, fontSize: 30, fontWeight: 500, color: C.muted}}>3 tasks for today</div>
);
const CardHeader: React.FC<{subtitle?: boolean}> = ({subtitle = true}) => (
	<div style={{position: 'absolute', inset: 0}}>
		<div style={{position: 'absolute', left: 56, top: 50}}>
			<CardTitle />
		</div>
		{subtitle ? <div style={{position: 'absolute', left: 58, top: 142, fontFamily: UI, fontSize: 30, fontWeight: 500, color: C.muted}}>3 tasks for today</div> : null}
	</div>
);

const checkedAt = (k: number): number | null => [TL.card.taps[0], TL.card.taps[1], TL.detail.tap3][k] ?? null;

/* ── Captions drawn with LetterMorph so the morph starts from the exact same glyphs ─ */
const Caption1: React.FC<{f: number}> = ({f}) => {
	const inT = prog(f, TL.caption1.in, TL.caption1.in + 26, ease.out);
	const out = prog(f, TL.expand.start, TL.expand.start + 16, ease.in);
	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				top: 0,
				width: W,
				height: 400,
				clipPath: `inset(0 ${(1 - inT) * 100}% 0 0)`,
				transform: `translateY(${(1 - inT) * 24 - out * 30}px)`,
				opacity: 1 - out,
			}}
		>
			<LetterMorph
				frame={f}
				start={TL.caption1.morph[0]}
				end={TL.caption1.morph[1]}
				from="Notes everywhere?"
				to="All in one place."
				x={W / 2}
				y={250}
				font={{fontFamily: DISPLAY, fontWeight: 760, fontSize: 92, letterSpacing: -2.5}}
				color={C.ink}
			/>
		</div>
	);
};

/* ── Scene 1+2: the desk (notes, merge, card, taps) ────────────────────────── */
const Desk: React.FC<{f: number}> = ({f}) => {
	const cam = poseTrack(f, [
		{f: 0, p: {x: 0, y: 0, s: 1}},
		{f: 250, p: {x: 0, y: -10, s: 1.05}},
		{f: 330, p: {x: 0, y: 0, s: 1}, hold: true},
		{f: 900, p: {x: 0, y: 0, s: 1}},
	]);
	const merge = handoff(f, TL.merge.start, TL.merge.end);
	const expand = handoff(f, TL.expand.start, TL.expand.end);
	const hero = notePose(0, TL.merge.start);
	const pressCard = f >= TL.card.cardTap - 3 && f < TL.expand.start ? Math.sin(Math.PI * clamp01((f - TL.card.cardTap + 3) / 10)) : 0;
	return (
		<AbsoluteFill style={{background: C.paper, overflow: 'hidden'}}>
			<AbsoluteFill style={{backgroundImage: `radial-gradient(${C.dot} 2.2px, transparent 2.4px)`, backgroundSize: '36px 36px', backgroundPosition: `${(f * 0.15) % 36}px 0px`, opacity: 0.9}} />
			<AbsoluteFill style={{background: 'radial-gradient(ellipse 70% 50% at 50% 45%, rgba(255,255,255,0.55), rgba(255,255,255,0) 70%)'}} />
			<AbsoluteFill style={{transformOrigin: `${W / 2}px ${H / 2}px`, transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})`}}>
				{/* notes before the merge; during the merge the six others converge under the carrier */}
				{NOTES.map((_, i) => {
					if (merge === 'after') return null;
					if (i === 0 && merge !== 'before') return null; // hero is the carrier now
					if (merge === 'before') {
						const p = notePose(i, f);
						return <StickyNote key={i} i={i} rect={noteRect(p)} rot={p.rot} opacity={p.opacity} squash={p.squash} z={i === 0 ? 20 : 10 - i} />;
					}
					const start = notePose(i, TL.merge.start);
					const d = i * 1.5;
					const t = ease.snap(clamp01((f - TL.merge.start - d) / (TL.merge.end - TL.merge.start - 12 - d)));
					const c = arc({x: start.cx, y: start.cy}, CENTER, t, i % 2 ? 0.18 : -0.18);
					const s = lerp(start.scale, 0.55, t);
					// fully covered by the growing carrier from ~70 %: stop drawing (no visible fade)
					if (t > 0.97) return null;
					return <StickyNote key={i} i={i} rect={{x: c.x - (NOTE * s) / 2, y: c.y - (NOTE * s) / 2, w: NOTE * s, h: NOTE * s, r: 10}} rot={lerp(start.rot, 0, t)} z={10 - i} />;
				})}
				<MorphCarrier
					frame={f}
					start={TL.merge.start}
					end={TL.merge.end}
					from={{rect: noteRect(hero), fill: C.notes[0], rot: hero.rot, elevation: 0.3, content: <NoteFace i={0} size={NOTE} />}}
					to={{rect: CARD, fill: C.card, rot: 0, elevation: 0.55, content: <CardHeader />}}
					ease={ease.snap}
					bend={0.08}
					contentOut={[0, 0.4]}
					contentIn={[0.5, 0.88]}
					colorWindow={[0.3, 0.8]}
					lift={0.7}
				/>
				{/* the card itself, from the merge's last frame until the expand's first */}
				{merge === 'after' && expand === 'before' ? (
					<div
						style={{
							position: 'absolute',
							left: CARD.x,
							top: CARD.y,
							width: CARD.w,
							height: CARD.h,
							borderRadius: CARD.r,
							background: C.card,
							boxShadow: '0 25px 54px rgba(15,20,30,0.19)',
							transform: `scale(${1 - 0.012 * pressCard})`,
						}}
					>
						<CardHeader />
					</div>
				) : null}
				{merge === 'after' && expand === 'before'
					? LABELS.map((label, k) => {
							const r = CARD_ROW(k);
							const a = TL.card.rowsIn[k];
							const t = prog(f, a, a + 14, ease.out);
							if (t <= 0) return null;
							return (
								<div key={k} style={{position: 'absolute', left: r.x, top: r.y + (1 - t) * 26, opacity: t, transform: `scale(${1 - 0.012 * pressCard})`, transformOrigin: `${CARD.x + CARD.w / 2 - r.x}px ${CARD.y + CARD.h / 2 - r.y}px`}}>
									<Row frame={f} label={label} checkedAt={k < 2 ? checkedAt(k) : null} />
								</div>
							);
						})
					: null}
				<Caption1 f={f} />
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

/* ── Expand: card becomes the detail screen; title and rows travel on their own ─ */
const Expand: React.FC<{f: number}> = ({f}) => {
	if (handoff(f, TL.expand.start, TL.expand.end) !== 'during') return null;
	const common = {frame: f, start: TL.expand.start, end: TL.expand.end, ease: ease.snap};
	return (
		<AbsoluteFill>
			<MorphCarrier
				{...common}
				from={{rect: CARD, fill: C.card, elevation: 0.55, content: <CardSubtitle />}}
				to={{rect: FULL, fill: C.card, elevation: 0}}
				contentOut={[0, 0.25]}
			/>
			<MorphCarrier {...common} from={{rect: TITLE_CARD, fill: C.card, content: <CardTitle />}} to={{rect: TITLE_DETAIL, fill: C.card}} contentOut={[2, 3]} />
			{LABELS.map((label, k) => (
				<MorphCarrier
					key={k}
					{...common}
					delay={k * 2}
					from={{rect: CARD_ROW(k), fill: C.card, content: <Row frame={f} label={label} checkedAt={k < 2 ? checkedAt(k) : null} />}}
					to={{rect: DETAIL_ROW(k), fill: C.card}}
					contentOut={[2, 3]}
					/>
			))}
		</AbsoluteFill>
	);
};

/* ── Scene 3: detail screen ─────────────────────────────────────────────────── */
const Detail: React.FC<{f: number}> = ({f}) => {
	if (f < TL.expand.end || f >= TL.flood.end) return null;
	const back = prog(f, TL.expand.end - 2, TL.expand.end + 14, ease.out);
	const sub = prog(f, TL.expand.end, TL.expand.end + 16, ease.out);
	const btn = springAt(f, 60, TL.detail.button, {damping: 14, stiffness: 190});
	const press = f >= TL.detail.shareTap - 4 && f <= TL.detail.shareTap + 7 ? Math.sin(Math.PI * clamp01((f - TL.detail.shareTap + 4) / 11)) : 0;
	return (
		<AbsoluteFill style={{background: C.card}}>
			<svg width={56} height={56} viewBox="0 0 24 24" style={{position: 'absolute', left: 96, top: 150, opacity: back, transform: `translateX(${(1 - back) * -20}px)`}}>
				<path d="M15 5 L8 12 L15 19" stroke={C.ink} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
			</svg>
			<div style={{position: 'absolute', left: TITLE_DETAIL.x, top: TITLE_DETAIL.y, transformOrigin: '0 0', transform: 'scale(1.5)'}}>
				<CardTitle />
			</div>
			<div style={{position: 'absolute', left: 104, top: 386, fontFamily: UI, fontSize: 38, fontWeight: 500, color: C.muted, opacity: sub, transform: `translateY(${(1 - sub) * 16}px)`}}>Due today, 3 tasks</div>
			<div style={{position: 'absolute', left: 100, top: 468, display: 'flex', gap: 18}}>
				{['Work', 'Q4 launch', 'Team'].map((l, k) => (
					<Chip key={l} frame={f} at={TL.detail.chips[k]} label={l} color={['#FFE7A3', '#DCE4FF', '#CFF3E3'][k]} />
				))}
			</div>
			<div style={{position: 'absolute', left: 380, top: 640}}>
				<Ring frame={f} at={TL.detail.ring} from={2} to={3} changeAt={TL.detail.tap3 + 2} total={3} />
			</div>
			{LABELS.map((label, k) => {
				const r = DETAIL_ROW(k);
				return (
					<div key={k} style={{position: 'absolute', left: r.x, top: r.y, transformOrigin: '0 0', transform: 'scale(1.15)'}}>
						<Row frame={f} label={label} checkedAt={checkedAt(k)} />
					</div>
				);
			})}
			<div
				style={{
					position: 'absolute',
					left: 140,
					top: 1590,
					width: 800,
					height: 130,
					borderRadius: 65,
					background: mixColor(C.brand, C.brandDeep, press),
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					gap: 18,
					fontFamily: UI,
					fontWeight: 650,
					fontSize: 48,
					color: '#fff',
					transform: `translateY(${(1 - btn) * 160}px) scale(${1 - 0.04 * press})`,
					opacity: clamp01(btn * 3),
					boxShadow: `0 ${18 - 10 * press}px 40px rgba(51,85,255,0.35)`,
				}}
			>
				<span style={{opacity: 1 - prog(f, TL.flood.start - 8, TL.flood.start, ease.in), transform: `scale(${1 - 0.2 * prog(f, TL.flood.start - 8, TL.flood.start, ease.in)})`, display: 'inline-flex', alignItems: 'center', gap: 18}}>
					Share
					<svg width={44} height={44} viewBox="0 0 24 24">
						<path d="M4 12 L20 4 L15 20 L12 13 Z" fill="#fff" />
					</svg>
				</span>
			</div>
		</AbsoluteFill>
	);
};

/* ── Scene 4+5: shared, then the logo ───────────────────────────────────────── */
const AV = [
	{x: 300, y: 1000, l: 'A'},
	{x: 540, y: 1000, l: 'M'},
	{x: 780, y: 1000, l: 'J'},
];
const LOGO_C = {x: 540, y: 960};
const circlePath = (r: number, cx: number, cy: number, n = 96) =>
	'M ' + Array.from({length: n}, (_, i) => `${(cx + r * Math.cos((i / n) * Math.PI * 2 - Math.PI / 2)).toFixed(2)} ${(cy + r * Math.sin((i / n) * Math.PI * 2 - Math.PI / 2)).toFixed(2)}`).join(' L ') + ' Z';
const PLANE = 'M 20 112 L 222 26 L 142 214 L 108 150 Z';

const Shared: React.FC<{f: number}> = ({f}) => {
	const [c0, c1] = TL.logo.converge;
	const [s0, s1] = TL.logo.shape;
	const [w0, w1] = TL.logo.word;
	const cam = 1 + 0.035 * prog(f, TL.flood.start, TL.durationInFrames, ease.inOutSoft);
	const capIn = prog(f, TL.shared.caption, TL.shared.caption + 24, ease.out);
	const label = prog(f, TL.shared.label, TL.shared.label + 16, ease.out) * (1 - prog(f, c0, c0 + 12, ease.in));
	const wordT = prog(f, w0, w1, ease.inOut);
	const tag = prog(f, TL.logo.tagline, TL.logo.tagline + 22, ease.out);
	const stamp = f >= TL.logo.stamp ? springAt(f, 60, TL.logo.stamp, {damping: 9, stiffness: 240}) : 0;
	const stampPulse = f >= TL.logo.stamp ? Math.sin(Math.PI * clamp01((f - TL.logo.stamp) / 12)) * (1 - clamp01((f - TL.logo.stamp) / 30)) : 0;
	const fold = prog(f, s1 - 4, s1 + 12, ease.out);
	return (
		<AbsoluteFill style={{background: C.brand, overflow: 'hidden'}}>
			<AbsoluteFill style={{background: 'radial-gradient(ellipse 80% 60% at 50% 42%, rgba(255,255,255,0.14), rgba(255,255,255,0) 70%)'}} />
			<AbsoluteFill style={{transformOrigin: `${W / 2}px ${H / 2}px`, transform: `scale(${cam})`}}>
				{/* avatars: pop in, then converge into one circle */}
				{f < s0
					? AV.map((a, k) => {
							const pop = springAt(f, 60, TL.shared.avatars[k], {damping: 10, stiffness: 230});
							if (pop <= 0.001) return null;
							const t = ease.inOut(clamp01((f - c0 - k * 2) / (s0 - c0 - 4)));
							const p = arc({x: a.x, y: a.y}, LOGO_C, t, k === 0 ? 0.25 : k === 2 ? -0.25 : 0);
							const r = lerp(105, 120, t) * (0.5 + 0.5 * pop);
							const lo = 1 - clamp01((f - c0) / 10);
							return (
								<div
									key={k}
									style={{
										position: 'absolute',
										left: p.x - r,
										top: p.y - r,
										width: 2 * r,
										height: 2 * r,
										borderRadius: '50%',
										background: '#FFFFFF',
										boxShadow: `0 14px 34px rgba(10,20,90,${0.28 * (1 - t)})`,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										fontFamily: DISPLAY,
										fontWeight: 760,
										fontSize: 88 * (r / 105),
										color: C.brand,
										zIndex: 3 - Math.abs(k - 1),
									}}
								>
									<span style={{opacity: lo}}>{a.l}</span>
								</div>
							);
						})
					: null}
				{f >= s0 ? (
					<div style={{position: 'absolute', left: LOGO_C.x - 120, top: LOGO_C.y - 120, width: 240, height: 240, transform: `scale(${1 + 0.07 * stampPulse})`}}>
						<PathMorph frame={f} start={s0} end={s1} from={circlePath(120, 120, 120)} to={PLANE} fillFrom="#FFFFFF" fillTo="#FFFFFF" viewBox="0 0 240 240" width={240} height={240} ease={ease.inOut} />
						<svg viewBox="0 0 240 240" width={240} height={240} style={{position: 'absolute', inset: 0}}>
							<path d="M 222 26 L 108 150" stroke={C.brand} strokeWidth={9} strokeLinecap="round" strokeDasharray={170} strokeDashoffset={170 * (1 - fold)} />
						</svg>
					</div>
				) : null}
				{stamp > 0
					? Array.from({length: 8}, (_, k) => {
							const a = (k / 8) * Math.PI * 2 + 0.3;
							const t = clamp01((f - TL.logo.stamp) / 22);
							const d0 = 150 + 70 * ease.out(t);
							const len = 38 * (1 - t);
							return (
								<div
									key={k}
									style={{
										position: 'absolute',
										left: LOGO_C.x + Math.cos(a) * d0,
										top: LOGO_C.y + Math.sin(a) * d0,
										width: len,
										height: 8,
										borderRadius: 4,
										background: '#FFFFFF',
										opacity: 1 - t,
										transformOrigin: '0 50%',
										transform: `rotate(${a}rad)`,
									}}
								/>
							);
						})
					: null}
				<div style={{position: 'absolute', left: 0, top: 0, width: W, opacity: label, fontFamily: UI, fontSize: 38, fontWeight: 500, color: 'rgba(255,255,255,0.82)', textAlign: 'center', transform: `translateY(${1190 + (1 - label) * 14}px)`}}>
					Ana, Malik and Jo can edit
				</div>
				{/* caption becomes the wordmark */}
				<div
					style={{
						position: 'absolute',
						left: 0,
						top: 0,
						width: W,
						height: H,
						clipPath: `inset(0 ${(1 - capIn) * 100}% 0 0)`,
						transformOrigin: `${W / 2}px 0px`,
						transform: `translateY(${lerp(0, 830, wordT) + (1 - capIn) * 20}px) scale(${lerp(1, 1.45, wordT)})`,
					}}
				>
					<LetterMorph
						frame={f}
						start={w0}
						end={w1}
						from="Share it in one tap."
						to="Papertrail"
						x={W / 2}
						y={330}
						font={{fontFamily: DISPLAY, fontWeight: 760, fontSize: 88, letterSpacing: -2.2}}
						color="#FFFFFF"
					/>
				</div>
				<div style={{position: 'absolute', left: 0, top: 1440, width: W, textAlign: 'center', fontFamily: UI, fontSize: 44, fontWeight: 520, color: 'rgba(255,255,255,0.86)', opacity: tag, transform: `translateY(${(1 - tag) * 22}px)`}}>
					Notes that get done.
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

export const Film: React.FC = () => {
	const f = useCurrentFrame();
	return (
		<AbsoluteFill style={{background: C.paper}}>
			{f < TL.expand.end ? <Desk f={f} /> : null}
			<Detail f={f} />
			<Expand f={f} />
			<Touch
				frame={f}
				path={[
					{f: 492, x: 980, y: 1860},
					{f: TL.detail.tap3, x: 131, y: 1374},
					{f: TL.detail.shareTap, x: 560, y: 1655},
				]}
				taps={[TL.detail.tap3, TL.detail.shareTap]}
			/>
		
			<FloodReveal frame={f} start={TL.flood.start} end={TL.flood.end} origin={{x: 540, y: 1655}} r0={8} width={W} height={H}>
				<Shared f={f} />
			</FloodReveal>
			<Touch
				frame={f}
				path={[
					{f: 350, x: 930, y: 1780},
					{f: TL.card.taps[0], x: 223, y: 965},
					{f: TL.card.taps[1], x: 223, y: 1075},
					{f: TL.card.cardTap, x: 560, y: 790},
				]}
				taps={[TL.card.taps[0], TL.card.taps[1], TL.card.cardTap]}
			/>
</AbsoluteFill>
	);
};

export const _unused = {rand};
