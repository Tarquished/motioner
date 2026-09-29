import type * as THREE from 'three';
import type {Ev, V3} from '../base';

/** one link of the machine: it is triggered by the previous link, plays its physics, and triggers the next one */
export interface Link {
	name: string;
	label: string;
	/** frame at which this link is triggered (contact with the previous link) */
	f0: number;
	/** frame at which it hands over to the next link (its last contact) */
	f1: number;
	events: Ev[];
	build(scene: THREE.Scene): void;
	pose(f: number): void;
	/** where the action is at frame f (the spot light and the camera follow it) */
	focus(f: number): V3;
}
