/* HDR accumulation renderer: every output frame is the average of N sub-frames rendered in linear half-float.
 * Each sub-frame jitters (Halton) the time inside the shutter, the sub-pixel position (anti-aliasing), the key light on a disc
 * (soft shadows), a sky light over the hemisphere (ambient occlusion) and the camera on an aperture disc (depth of field).
 * Everything is a pure function of the frame number, so renders are deterministic. */
import * as THREE from 'three';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';

export const W = 1920;
export const H = 1080;

export const halton = (i: number, b: number) => {
	let f = 1;
	let r = 0;
	while (i > 0) {
		f /= b;
		r += f * (i % b);
		i = Math.floor(i / b);
	}
	return r;
};

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

const MIX_FS = `
uniform sampler2D tA; uniform sampler2D tB; uniform float weight; uniform int mode; uniform float rim; uniform vec3 rimCol;
varying vec2 vUv;
void main(){
	vec4 a = texture2D(tA, vUv);
	vec3 c = a.rgb;
	if (mode == 1) c = texture2D(tB, vUv).rgb;
	if (mode == 2) {
		vec4 b = texture2D(tB, vUv);
		float m = clamp(b.a, 0., 1.);
		c = mix(a.rgb, b.rgb, m) + rimCol * rim * (m * (1. - m) * 4.);
	}
	gl_FragColor = vec4(c * weight, 1.);
}`;

const DOWN_FS = `
uniform sampler2D tMap; uniform vec2 texel; varying vec2 vUv;
void main(){
	vec3 c = texture2D(tMap, vUv).rgb * 4.;
	c += texture2D(tMap, vUv + texel * vec2(-1., -1.)).rgb;
	c += texture2D(tMap, vUv + texel * vec2( 1., -1.)).rgb;
	c += texture2D(tMap, vUv + texel * vec2(-1.,  1.)).rgb;
	c += texture2D(tMap, vUv + texel * vec2( 1.,  1.)).rgb;
	gl_FragColor = vec4(c / 8., 1.);
}`;

const BLUR_FS = `
uniform sampler2D tMap; uniform vec2 dir; varying vec2 vUv;
void main(){
	vec3 c = texture2D(tMap, vUv).rgb * 0.2270270270;
	c += texture2D(tMap, vUv + dir * 1.3846153846).rgb * 0.3162162162;
	c += texture2D(tMap, vUv - dir * 1.3846153846).rgb * 0.3162162162;
	c += texture2D(tMap, vUv + dir * 3.2307692308).rgb * 0.0702702703;
	c += texture2D(tMap, vUv - dir * 3.2307692308).rgb * 0.0702702703;
	gl_FragColor = vec4(c, 1.);
}`;

const FINAL_FS = `
uniform sampler2D tAcc; uniform sampler2D tB1; uniform sampler2D tB2; uniform sampler2D tB3;
uniform float exposure, bloom, grain, vig, seed, fade;
uniform vec3 tint;
varying vec2 vUv;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec3 neutral(vec3 color){
	const float startCompression = 0.8 - 0.04;
	const float desaturation = 0.15;
	float x = min(color.r, min(color.g, color.b));
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max(color.r, max(color.g, color.b));
	if (peak < startCompression) return color;
	float d = 1. - startCompression;
	float newPeak = 1. - d * d / (peak + d - startCompression);
	color *= newPeak / peak;
	float g = 1. - 1. / (desaturation * (peak - newPeak) + 1.);
	return mix(color, newPeak * vec3(1., 1., 1.), g);
}
vec3 toSrgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, 0.), vec3(1. / 2.4)) - 0.055, step(0.0031308, c)); }
void main(){
	vec3 c = texture2D(tAcc, vUv).rgb;
	vec3 b = texture2D(tB1, vUv).rgb * 0.5 + texture2D(tB2, vUv).rgb * 0.35 + texture2D(tB3, vUv).rgb * 0.25;
	c += b * bloom;
	c *= exposure * tint;
	c = neutral(c);
	vec2 q = vUv - 0.5;
	float v = 1. - vig * dot(q, q) * 1.6;
	c *= v;
	c = toSrgb(c);
	float n = hash(vUv * vec2(1920., 1080.) + seed) - 0.5;
	float n2 = hash(vUv * vec2(1920., 1080.) * 0.71 + seed * 1.7) - 0.5;
	c += (n * grain + n2 * grain * 0.5) * (0.4 + 0.6 * (1. - c));
	c += (hash(vUv * 977. + seed * 3.1) - 0.5) / 255.;
	c *= fade;
	gl_FragColor = vec4(c, 1.);
}`;

export type Sub = {
	i: number;
	n: number;
	tf: number; // time offset in frames, inside the shutter
	jx: number;
	jy: number; // sub-pixel jitter
	lx: number;
	ly: number; // unit-disc sample for the key light
	sx: number;
	sy: number;
	sz: number; // sky direction (unit vector, +y up)
	ax: number;
	ay: number; // unit-disc sample for the aperture
};

export const subSample = (i: number, n: number, shutter: number): Sub => {
	const k = i + 1;
	const ti = (i * 7) % n;
	const disc = (u: number, v: number) => {
		const r = Math.sqrt(u);
		const a = 2 * Math.PI * v;
		return [r * Math.cos(a), r * Math.sin(a)];
	};
	const [lx, ly] = disc(halton(k, 2), halton(k, 3));
	const [ax, ay] = disc(halton(k + 7, 5), halton(k + 7, 7));
	const cu = halton(k, 5);
	const cv = halton(k, 7);
	const rr = Math.sqrt(cu);
	const aa = 2 * Math.PI * cv;
	return {
		i,
		n,
		tf: ((ti + 0.5) / n - 0.5) * shutter,
		jx: halton(k, 11) - 0.5,
		jy: halton(k, 13) - 0.5,
		lx,
		ly,
		sx: rr * Math.cos(aa),
		sy: Math.sqrt(Math.max(0, 1 - cu)),
		sz: rr * Math.sin(aa),
		ax,
		ay,
	};
};

export type Finish = {exposure?: number; bloom?: number; grain?: number; vig?: number; seed?: number; fade?: number; tint?: [number, number, number]};

export class Gfx {
	renderer: THREE.WebGLRenderer;
	private rtScene: THREE.WebGLRenderTarget;
	private rtLit: THREE.WebGLRenderTarget;
	private rtAcc: THREE.WebGLRenderTarget;
	private rtB: THREE.WebGLRenderTarget[] = [];
	private rtT: THREE.WebGLRenderTarget[] = [];
	private qAdd: FullScreenQuad;
	private qDown: FullScreenQuad;
	private qBlur: FullScreenQuad;
	private qFinal: FullScreenQuad;
	private mAdd: THREE.ShaderMaterial;
	private mDown: THREE.ShaderMaterial;
	private mBlur: THREE.ShaderMaterial;
	private mFinal: THREE.ShaderMaterial;

	constructor(canvas: HTMLCanvasElement) {
		this.renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
		this.renderer.setPixelRatio(1);
		this.renderer.setSize(W, H, false);
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;
		this.renderer.toneMapping = THREE.NoToneMapping;
		this.renderer.autoClear = true;
		const rt = (w: number, h: number, type: THREE.TextureDataType, samples = 0, depth = false) =>
			new THREE.WebGLRenderTarget(w, h, {type, samples, depthBuffer: depth, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat});
		this.rtScene = rt(W, H, THREE.HalfFloatType, 4, true);
		this.rtLit = rt(W, H, THREE.HalfFloatType, 4, true);
		this.rtAcc = rt(W, H, THREE.FloatType);
		let w = W;
		let h = H;
		for (let l = 0; l < 3; l++) {
			w = Math.ceil(w / 4);
			h = Math.ceil(h / 4);
			this.rtB.push(rt(w, h, THREE.HalfFloatType));
			this.rtT.push(rt(w, h, THREE.HalfFloatType));
		}
		const mat = (fs: string, uniforms: Record<string, THREE.IUniform>, add = false) =>
			new THREE.ShaderMaterial({
				vertexShader: VS,
				fragmentShader: fs,
				uniforms,
				depthTest: false,
				depthWrite: false,
				blending: add ? THREE.CustomBlending : THREE.NoBlending,
				blendEquation: THREE.AddEquation,
				blendSrc: THREE.OneFactor,
				blendDst: THREE.OneFactor,
			});
		this.mAdd = mat(MIX_FS, {tA: {value: null}, tB: {value: null}, weight: {value: 0}, mode: {value: 0}, rim: {value: 0}, rimCol: {value: new THREE.Vector3(3, 0.9, 0.5)}}, true);
		this.mDown = mat(DOWN_FS, {tMap: {value: null}, texel: {value: new THREE.Vector2()}});
		this.mBlur = mat(BLUR_FS, {tMap: {value: null}, dir: {value: new THREE.Vector2()}});
		this.mFinal = mat(FINAL_FS, {
			tAcc: {value: null},
			tB1: {value: null},
			tB2: {value: null},
			tB3: {value: null},
			exposure: {value: 1},
			bloom: {value: 0.15},
			grain: {value: 0.03},
			vig: {value: 0.35},
			seed: {value: 0},
			fade: {value: 1},
			tint: {value: new THREE.Vector3(1, 1, 1)},
		});
		this.qAdd = new FullScreenQuad(this.mAdd);
		this.qDown = new FullScreenQuad(this.mDown);
		this.qBlur = new FullScreenQuad(this.mBlur);
		this.qFinal = new FullScreenQuad(this.mFinal);
	}

	begin() {
		this.renderer.setRenderTarget(this.rtAcc);
		this.renderer.setClearColor(0x000000, 1);
		this.renderer.clear();
	}

	/** render the scene into the first (0) or the second (1) target */
	renderPass(which: 0 | 1, scene: THREE.Scene, cam: THREE.Camera) {
		const r = this.renderer;
		r.setRenderTarget(which === 0 ? this.rtScene : this.rtLit);
		r.render(scene, cam);
	}

	/** add the last rendered pass(es) to the accumulation buffer; mode 0: first only, 1: second only, 2: mix by the alpha of the second */
	addMix(weight: number, mode: 0 | 1 | 2, rim = 0) {
		const r = this.renderer;
		const u = this.mAdd.uniforms;
		u.tA.value = this.rtScene.texture;
		u.tB.value = this.rtLit.texture;
		u.weight.value = weight;
		u.mode.value = mode;
		u.rim.value = rim;
		r.setRenderTarget(this.rtAcc);
		r.autoClear = false;
		this.qAdd.render(r);
		r.autoClear = true;
	}

	finish(o: Finish) {
		const r = this.renderer;
		let src: THREE.WebGLRenderTarget = this.rtAcc;
		const bl: THREE.WebGLRenderTarget[] = [];
		for (let l = 0; l < 3; l++) {
			const dst = this.rtB[l];
			this.mDown.uniforms.tMap.value = src.texture;
			this.mDown.uniforms.texel.value.set(1 / src.width, 1 / src.height);
			r.setRenderTarget(dst);
			this.qDown.render(r);
			this.mBlur.uniforms.tMap.value = dst.texture;
			this.mBlur.uniforms.dir.value.set(1 / dst.width, 0);
			r.setRenderTarget(this.rtT[l]);
			this.qBlur.render(r);
			this.mBlur.uniforms.tMap.value = this.rtT[l].texture;
			this.mBlur.uniforms.dir.value.set(0, 1 / dst.height);
			r.setRenderTarget(dst);
			this.qBlur.render(r);
			bl.push(dst);
			src = dst;
		}
		const u = this.mFinal.uniforms;
		u.tAcc.value = this.rtAcc.texture;
		u.tB1.value = bl[0].texture;
		u.tB2.value = bl[1].texture;
		u.tB3.value = bl[2].texture;
		u.exposure.value = o.exposure ?? 1;
		u.bloom.value = o.bloom ?? 0.15;
		u.grain.value = o.grain ?? 0.03;
		u.vig.value = o.vig ?? 0.35;
		u.seed.value = o.seed ?? 0;
		u.fade.value = o.fade ?? 1;
		const t = o.tint ?? [1, 1, 1];
		u.tint.value.set(t[0], t[1], t[2]);
		r.setRenderTarget(null);
		this.qFinal.render(r);
	}
}
