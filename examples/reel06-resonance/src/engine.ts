/* WebGL2 accumulation renderer. Every output frame is the average of N sub-frames (time inside the shutter, sub-pixel jitter) drawn
 * by the layer shader into a float target, then graded (grain, vignette, dither) into the canvas. Deterministic: nothing depends on
 * wall-clock time. */
import {staticFile} from 'remotion';
import {DW, Frame, NL} from './frame';
import {FS, POST_FS, VS} from './shader';
import ATL from './atlas.json';

export const W = 2560;
export const H = 1440;
export const WAVE_COLS = 4096;
export const WAVE_ROWS = 18; // 4096 x 18 = 73728 samples over the film
export const WAVE_SECONDS = 30;

const halton = (i: number, b: number) => {
	let f = 1;
	let r = 0;
	while (i > 0) {
		f /= b;
		r += f * (i % b);
		i = Math.floor(i / b);
	}
	return r;
};

const u16 = (buf: ArrayBuffer) => new Uint16Array(buf);

const fetchBin = async (name: string): Promise<ArrayBuffer | null> => {
	try {
		const r = await fetch(staticFile(name));
		if (!r.ok) return null;
		return await r.arrayBuffer();
	} catch {
		return null;
	}
};

export type Assets = {atlas: ArrayBuffer; wave: ArrayBuffer | null; env: ArrayBuffer | null};
let assetsPromise: Promise<Assets> | null = null;
export const loadAssets = () => {
	if (!assetsPromise)
		assetsPromise = (async () => {
			const [atlas, wave, env] = await Promise.all([fetchBin('atlas.bin'), fetchBin('wave.bin'), fetchBin('env.bin')]);
			if (!atlas) throw new Error('atlas.bin missing (run scripts/atlas.py)');
			return {atlas, wave, env};
		})();
	return assetsPromise;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
	const s = gl.createShader(type)!;
	gl.shaderSource(s, src);
	gl.compileShader(s);
	if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(s) ?? '';
		const lines = src.split('\n');
		const m = /ERROR: \d+:(\d+)/.exec(log);
		const ctx = m ? lines.slice(Math.max(0, Number(m[1]) - 3), Number(m[1]) + 2).join('\n') : '';
		throw new Error('shader: ' + log + '\n' + ctx);
	}
	return s;
};
const program = (gl: WebGL2RenderingContext, vs: string, fs: string) => {
	const p = gl.createProgram()!;
	gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
	gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
	gl.bindAttribLocation(p, 0, 'aPos');
	gl.linkProgram(p);
	if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
	return p;
};

export class Engine {
	gl: WebGL2RenderingContext;
	pMain: WebGLProgram;
	pPost: WebGLProgram;
	texD: WebGLTexture;
	texAtlas: WebGLTexture;
	texWave: WebGLTexture;
	texEnv: WebGLTexture;
	texAcc: WebGLTexture;
	fbo: WebGLFramebuffer;
	vao: WebGLVertexArrayObject;

	constructor(canvas: HTMLCanvasElement, assets: Assets) {
		const gl = canvas.getContext('webgl2', {antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
		if (!gl) throw new Error('WebGL2 not available');
		this.gl = gl;
		if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float missing');
		gl.getExtension('OES_texture_float_linear');
		const f32 = !!gl.getExtension('EXT_float_blend');
		this.pMain = program(gl, VS, FS);
		this.pPost = program(gl, VS, POST_FS);
		this.vao = gl.createVertexArray()!;
		gl.bindVertexArray(this.vao);
		const vb = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, vb);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

		const tex = (unit: number) => {
			const t = gl.createTexture()!;
			gl.activeTexture(gl.TEXTURE0 + unit);
			gl.bindTexture(gl.TEXTURE_2D, t);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			return t;
		};
		// data texture
		this.texD = tex(0);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, DW, NL + 1, 0, gl.RGBA, gl.FLOAT, null);
		// atlas RG16F
		this.texAtlas = tex(1);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		const aw = ATL.cols * ATL.cs;
		const ah = ATL.rows * ATL.cs;
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, aw, ah, 0, gl.RG, gl.HALF_FLOAT, u16(assets.atlas));
		// waveform R16F 4096 x 18
		this.texWave = tex(2);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, WAVE_COLS, WAVE_ROWS, 0, gl.RED, gl.HALF_FLOAT, assets.wave ? u16(assets.wave) : new Uint16Array(WAVE_COLS * WAVE_ROWS));
		// envelope RG16F 4096 x 1 (min, max)
		this.texEnv = tex(3);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, WAVE_COLS, 1, 0, gl.RG, gl.HALF_FLOAT, assets.env ? u16(assets.env) : new Uint16Array(WAVE_COLS * 2));
		// accumulation target
		this.texAcc = tex(4);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texImage2D(gl.TEXTURE_2D, 0, f32 ? gl.RGBA32F : gl.RGBA16F, W, H, 0, gl.RGBA, f32 ? gl.FLOAT : gl.HALF_FLOAT, null);
		this.fbo = gl.createFramebuffer()!;
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texAcc, 0);
		if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo incomplete');
	}

	/** Render one output frame: `at(t)` returns the scene for (fractional) frame t. */
	draw(f: number, n: number, shutter: number, at: (t: number) => Frame, grade: {grain: number; vig: number; fade: number}) {
		const gl = this.gl;
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
		gl.viewport(0, 0, W, H);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE);
		gl.useProgram(this.pMain);
		const U = (name: string) => gl.getUniformLocation(this.pMain, name);
		gl.uniform2f(U('uRes'), W, H);
		gl.uniform1i(U('uD'), 0);
		gl.uniform1i(U('uAtlas'), 1);
		gl.uniform1i(U('uWave'), 2);
		gl.uniform1i(U('uEnv'), 3);
		gl.uniform4f(U('uAtl'), ATL.cs, ATL.cols, ATL.cols * ATL.cs, ATL.rows * ATL.cs);
		gl.uniform4f(U('uWaveInfo'), WAVE_COLS, WAVE_ROWS, WAVE_COLS, WAVE_SECONDS);
		const uJit = U('uJit');
		const uW = U('uW');
		for (let i = 0; i < n; i++) {
			const tf = n === 1 ? 0 : ((i + 0.5) / n - 0.5) * shutter;
			const fr = at(f + tf);
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.texD);
			gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, DW, NL + 1, gl.RGBA, gl.FLOAT, fr.pack());
			gl.uniform2f(uJit, n === 1 ? 0 : halton(i + 1, 2) - 0.5, n === 1 ? 0 : halton(i + 1, 3) - 0.5);
			if (uW) gl.uniform1f(uW, 1 / n);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, W, H);
		gl.disable(gl.BLEND);
		gl.useProgram(this.pPost);
		gl.activeTexture(gl.TEXTURE4);
		gl.bindTexture(gl.TEXTURE_2D, this.texAcc);
		const P = (name: string) => gl.getUniformLocation(this.pPost, name);
		gl.uniform1i(P('uAcc'), 4);
		gl.uniform2f(P('uRes'), W, H);
		gl.uniform1f(P('uSeed'), f % 97);
		gl.uniform1f(P('uGrain'), grade.grain);
		gl.uniform1f(P('uVig'), grade.vig);
		gl.uniform1f(P('uFade'), grade.fade);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}
}
