/* The 3D world: floor, lights, links, camera, and the per-frame render loop.
 * Every sub-frame is rendered once in the dark look, once in the lit look (only while the wave of light is crossing the room) and the two are
 * mixed by the ring, so the room is lit exactly where the wave has passed, with real shadows on both sides of its edge. */
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {Gfx, H, W, subSample} from './gfx';
import {Link} from './links/types';
import {PAL, V3, smooth, clamp} from './base';
import {Look, lookDark, lookLit, finale} from './look';
import {camAt} from './camera';
import {RING_DONE, ringR} from './flood';
import {reg} from './reg';
import {overlayAt} from './overlay';

const ringU = {
	uRing: {value: new THREE.Vector4(0, 0, 0, 6)},
	uDot: {value: 0.16},
	uFloor: {value: 1},
};

/** every standard material writes the ring mask into its alpha; the floor also gets a dot grid */
const patch = (mat: THREE.Material, floor: boolean) => {
	const m = mat as any;
	if (m.__ringPatched) return;
	m.__ringPatched = true;
	m.onBeforeCompile = (sh: any) => {
		sh.uniforms.uRing = ringU.uRing;
		sh.uniforms.uDot = ringU.uDot;
		sh.uniforms.uFloor = ringU.uFloor;
		sh.vertexShader = sh.vertexShader
			.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
		let fs: string = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; uniform vec4 uRing; uniform float uDot; uniform float uFloor;');
		if (floor) {
			fs = fs.replace(
				'#include <color_fragment>',
				`#include <color_fragment>
				{
					vec2 gp = vWPos.xz / 2.0;
					vec2 cell = gp - floor(gp + 0.5);
					float dd = length(cell) * 2.0;
					float aa = fwidth(dd) * 1.2 + 1e-4;
					float dotv = 1.0 - smoothstep(0.07 - aa, 0.07 + aa, dd);
					vec2 gp2 = vWPos.xz / 12.0;
					vec2 cell2 = gp2 - floor(gp2 + 0.5);
					float dd2 = length(cell2) * 12.0;
					float aa2 = fwidth(dd2) * 1.2 + 1e-4;
					float dot2 = 1.0 - smoothstep(0.22 - aa2, 0.22 + aa2, dd2);
					diffuseColor.rgb *= (1.0 - uDot * dotv - uDot * 1.4 * dot2) * uFloor;
				}`,
			);
		}
		fs = fs.replace(
			'#include <opaque_fragment>',
			`#include <opaque_fragment>
			{
				float rd = length(vWPos.xz - uRing.xy);
				float rm = 1.0 - smoothstep(uRing.z - uRing.w, uRing.z, rd);
				gl_FragColor.a = rm;
			}`,
		);
		sh.fragmentShader = fs;
	};
	m.customProgramCacheKey = () => (floor ? 'ringfloor' : 'ring');
	m.needsUpdate = true;
};

export class World {
	gfx: Gfx;
	scene = new THREE.Scene();
	cam = new THREE.PerspectiveCamera(30, W / H, 0.5, 900);
	key: THREE.DirectionalLight;
	sky: THREE.DirectionalLight;
	spot: THREE.SpotLight;
	hemi: THREE.HemisphereLight;
	links: Link[] = [];
	debugCam: Partial<ReturnType<typeof camAt>> | null = null;
	clear = new THREE.Color();

	constructor(canvas: HTMLCanvasElement, links: Link[]) {
		this.gfx = new Gfx(canvas);
		this.links = links;
		const scene = this.scene;
		const pm = new THREE.PMREMGenerator(this.gfx.renderer);
		scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
		scene.environmentIntensity = 0.3;
		scene.fog = new THREE.FogExp2(new THREE.Color(PAL.paper), 0.004);

		this.hemi = new THREE.HemisphereLight('#ffffff', '#d8cfc4', 0.5);
		scene.add(this.hemi);
		this.key = new THREE.DirectionalLight('#fff3e2', 3);
		this.sky = new THREE.DirectionalLight('#eef2ff', 1.2);
		for (const l of [this.key, this.sky]) {
			l.castShadow = true;
			l.shadow.mapSize.set(2048, 2048);
			l.shadow.bias = -0.0003;
			l.shadow.normalBias = 0.03;
			l.shadow.radius = 2;
			scene.add(l, l.target);
		}
		this.spot = new THREE.SpotLight('#fff1dc', 9, 0, 0.42, 0.75, 0);
		this.spot.castShadow = true;
		this.spot.shadow.mapSize.set(2048, 2048);
		this.spot.shadow.bias = -0.0004;
		this.spot.shadow.normalBias = 0.03;
		this.spot.shadow.camera.near = 2;
		this.spot.shadow.camera.far = 140;
		scene.add(this.spot, this.spot.target);

		const floorMat = new THREE.MeshStandardMaterial({color: PAL.paper, roughness: 0.92});
		const floor = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), floorMat);
		floor.rotation.x = -Math.PI / 2;
		floor.receiveShadow = true;
		scene.add(floor);

		for (const l of links) l.build(scene);
		scene.traverse((o) => {
			const mesh = o as THREE.Mesh;
			if (!mesh.isMesh) return;
			const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
			mats.forEach((m) => patch(m, m === floorMat));
		});
	}

	private setLook(L: Look, focus: V3, R: number, sub: ReturnType<typeof subSample>, sky: number) {
		this.gfx.renderer.setClearColor(this.clear.set(PAL.paper).multiplyScalar(L.bgLevel), sky);
		const fog = this.scene.fog as THREE.FogExp2;
		fog.color.copy(this.clear);
		fog.density = L.fog;
		this.hemi.intensity = L.hemi;
		this.scene.environmentIntensity = L.env;
		const kd = new THREE.Vector3(-0.55, 1, 0.45).normalize();
		const soft = 0.09;
		const ku = new THREE.Vector3().crossVectors(kd, new THREE.Vector3(0, 0, 1)).normalize();
		const kw = new THREE.Vector3().crossVectors(kd, ku).normalize();
		const kdir = kd.clone().addScaledVector(ku, sub.lx * soft).addScaledVector(kw, sub.ly * soft).normalize();
		this.key.intensity = L.key;
		this.key.visible = L.key > 0.001;
		this.key.target.position.set(...focus);
		this.key.position.set(focus[0] + kdir.x * 80, focus[1] + kdir.y * 80, focus[2] + kdir.z * 80);
		let sc = this.key.shadow.camera;
		sc.left = -R;
		sc.right = R;
		sc.top = R;
		sc.bottom = -R;
		sc.near = 5;
		sc.far = 180;
		sc.updateProjectionMatrix();
		this.sky.intensity = L.sky;
		this.sky.visible = L.sky > 0.001;
		this.sky.target.position.set(...focus);
		const sd = new THREE.Vector3(sub.sx * 0.9, Math.max(0.25, sub.sy), sub.sz * 0.9).normalize();
		this.sky.position.set(focus[0] + sd.x * 80, focus[1] + sd.y * 80, focus[2] + sd.z * 80);
		sc = this.sky.shadow.camera;
		sc.left = -R;
		sc.right = R;
		sc.top = R;
		sc.bottom = -R;
		sc.near = 5;
		sc.far = 180;
		sc.updateProjectionMatrix();
		const sf = L.spotAt;
		this.spot.intensity = L.spot;
		this.spot.visible = L.spot > 0.001;
		this.spot.angle = L.spotAngle;
		this.spot.penumbra = L.spotPen;
		this.spot.target.position.set(sf[0], sf[1] * 0.6, sf[2]);
		const jl = 0.35 + L.spotAngle * 2;
		this.spot.position.set(sf[0] + L.spotOff[0] + sub.lx * jl, sf[1] + L.spotOff[1], sf[2] + L.spotOff[2] + sub.ly * jl);
		this.spot.updateMatrixWorld();
		this.spot.target.updateMatrixWorld();
	}

	draw(f: number, nSub: number) {
		const g = this.gfx;
		g.begin();
		const fFlood = reg.fFlood;
		const bp = reg.button;
		for (let i = 0; i < nSub; i++) {
			const sub = subSample(i, nSub, 0.5);
			const ft = f + sub.tf;
			for (const l of this.links) l.pose(ft);
			const C = camAt(ft);
			if (this.debugCam) Object.assign(C, this.debugCam);
			// the ring
			ringU.uFloor.value = 1 - 0.93 * smooth((ft - finale.fFrom) / (finale.fTo - finale.fFrom));
			const R = ringR(ft, fFlood);
			const mode: 0 | 1 | 2 = ft < fFlood ? 0 : ft >= fFlood + RING_DONE ? 1 : 2;
			ringU.uRing.value.set(bp[0], bp[2], R, 4.5);
			const skyA = clamp((R - 40) / 160);
			// camera with sub-pixel and aperture jitter
			const cam = this.cam;
			cam.fov = C.fov;
			const pos = new THREE.Vector3(...C.pos);
			const look = new THREE.Vector3(...C.look);
			const fwd = look.clone().sub(pos);
			const dist = C.focusDist ?? fwd.length();
			fwd.normalize();
			const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
			const upv = new THREE.Vector3().crossVectors(right, fwd).normalize();
			const ap = C.aperture;
			cam.position.copy(pos).addScaledVector(right, sub.ax * ap).addScaledVector(upv, sub.ay * ap);
			const focalPt = pos.clone().addScaledVector(fwd, dist);
			cam.up.set(0, 1, 0);
			cam.lookAt(focalPt);
			if (C.roll) cam.rotateZ(C.roll);
			cam.setViewOffset(W, H, sub.jx, sub.jy, W, H);
			cam.updateMatrixWorld();
			cam.updateProjectionMatrix();
			if (mode !== 1) {
				this.setLook(lookDark(ft), C.look, C.shadowR, sub, 1);
				g.renderPass(0, this.scene, cam);
			}
			if (mode !== 0) {
				this.setLook(lookLit(ft), C.look, C.shadowR, sub, skyA);
				g.renderPass(1, this.scene, cam);
			}
			const rim = mode === 2 ? 0.75 * (1 - smooth((ft - fFlood) / 260)) : 0;
			g.addMix(1 / nSub, mode, rim);
		}
		const L = lookLit(f);
		const D = lookDark(f);
		const ov = overlayAt(f);
		g.finish({exposure: f < fFlood ? D.exposure : L.exposure, bloom: (f < fFlood ? D.bloom : L.bloom) + ov.flash * 0.5, grain: 0.028, vig: 0.4, seed: f * 1.618, fade: L.fade, tint: [1, 1, 1]});
	}
}
