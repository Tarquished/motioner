declare module 'flubber' {
	export function interpolate(from: string, to: string, options?: {maxSegmentLength?: number; string?: boolean}): (t: number) => string;
	export function toCircle(from: string, x: number, y: number, r: number, options?: {maxSegmentLength?: number}): (t: number) => string;
	export function fromCircle(x: number, y: number, r: number, to: string, options?: {maxSegmentLength?: number}): (t: number) => string;
	export function separate(from: string, to: string[], options?: {maxSegmentLength?: number; single?: boolean}): (t: number) => string;
	export function combine(from: string[], to: string, options?: {maxSegmentLength?: number; single?: boolean}): (t: number) => string;
}
