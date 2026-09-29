import {BLUE, CORAL, INK, PAPER, World} from './common';
import {cityPortal, drawCity} from './worlds/city';
import {drawFlow, CORE} from './worlds/flow';
import {drawInk, dropPortal} from './worlds/ink';
import {drawRidge, SUN} from './worlds/ridge';
import {drawTiles, DISC} from './worlds/tiles';
import {drawWord, wordPortal} from './worlds/word';

/** Six worlds, each with a window (its portal) that opens onto the next; the sixth opens onto the first again (index 6). */
export const WORLDS: World[] = [
	{name: 'WORD', bg: INK, hudDark: true, accent: CORAL, next: '01 RIDGE', portal: (f) => wordPortal(f), draw: (a) => drawWord(a)},
	{name: 'RIDGE', bg: CORAL, hudDark: false, accent: PAPER, next: '02 TILES',  portal: () => SUN, draw: drawRidge},
	{name: 'TILES', bg: PAPER, hudDark: false, accent: INK, next: '03 FLOW',  portal: () => DISC, draw: drawTiles},
	{name: 'FLOW', bg: BLUE, hudDark: true, accent: PAPER, next: '04 CITY',  portal: () => CORE, draw: drawFlow},
	{name: 'CITY', bg: INK, hudDark: true, accent: CORAL, next: '05 INK',  portal: cityPortal, draw: drawCity},
	{name: 'INK', bg: PAPER, hudDark: false, accent: CORAL, next: '00 WORD',  portal: dropPortal, draw: drawInk},
	{name: 'WORD', bg: INK, hudDark: true, accent: CORAL, next: '', portal: () => null, draw: (a) => drawWord({...a, end: true})},
];
export const NW = WORLDS.length - 1; // number of dives
