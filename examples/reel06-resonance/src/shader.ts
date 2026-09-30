/* The one shader of the film. A layer is a small scene made of distance fields: a few "slots" (dot, glyph word, box, waveform),
 * grouped so that slots of the same group are blended (that is how a word melts into another word, or a dot into a word), rings
 * ("pulses") that travel along the level sets of a group's field, fills, a Chladni rosette, glow. Up to four layers are composited,
 * optionally revealed by a travelling ring (the shock wave that changes the room) or by the counter of a letter (push-through).
 * Everything is read from a float data texture (one row per layer, one global row), so the picture is a pure function of the frame. */

export const VS = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0., 1.); }`;

export const FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform vec2 uRes;
uniform sampler2D uD;
uniform sampler2D uAtlas;
uniform sampler2D uWave;
uniform sampler2D uEnv;
uniform vec2 uJit;
uniform float uW;
uniform vec4 uAtl;   // CS, cols, atlas w, atlas h
uniform vec4 uWaveInfo; // fine samples per row, rows, env samples, seconds
out vec4 outColor;

#define NL 10
const int O_SLOT = 16;
const int O_PULSE = 48;
const int O_WORD = 72;
const float PI = 3.14159265359;

vec4 T(int l, int i){ return texelFetch(uD, ivec2(i, l), 0); }
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float hash1(float x){ return fract(sin(x * 127.1) * 43758.5453); }

// ---------------------------------------------------------------- glyphs
float glyphD(vec2 p, float scale, float rot, int idx, out float cd){
	float c = cos(rot), s = sin(rot);
	vec2 q = vec2(c * p.x + s * p.y, -s * p.x + c * p.y) / scale;
	float half_ = uAtl.x * 0.5;
	float h = half_ - 2.0;
	vec2 qc = clamp(q, -h, h);
	float cols = uAtl.y;
	float row = floor(float(idx) / cols);
	float col = float(idx) - row * cols;
	vec2 px = vec2(col * uAtl.x + half_ + qc.x, row * uAtl.x + half_ - qc.y);
	vec2 v = texture(uAtlas, px / uAtl.zw).rg;
	float ext = length(q - qc);
	cd = (v.g + ext) * scale;
	return (v.r + ext) * scale;
}

float wordD(int l, int w, vec2 u){
	float d = 1e5;
	vec4 cn = T(l, 15);
	int n = int((w == 0 ? cn.z : cn.w) + 0.5);
	for (int i = 0; i < n; i++){
		vec4 a = T(l, O_WORD + w * 16 + i * 2);
		vec4 b = T(l, O_WORD + w * 16 + i * 2 + 1);
		if (b.x < 0.0 || a.z <= 0.0) continue;
		float cd;
		d = min(d, glyphD(u - a.xy, a.z, a.w, int(b.x), cd));
	}
	return d;
}

// letter-by-letter morph between word 0 and word 1 (aligned by index); a missing partner grows out of nothing
float pairD(int l, float m, vec2 u){
	vec4 cn = T(l, 15);
	int n = int(max(cn.z, cn.w) + 0.5);
	float d = 1e5;
	for (int i = 0; i < n; i++){
		vec4 a0 = T(l, O_WORD + i * 2);
		vec4 b0 = T(l, O_WORD + i * 2 + 1);
		vec4 a1 = T(l, O_WORD + 16 + i * 2);
		vec4 b1 = T(l, O_WORD + 16 + i * 2 + 1);
		float cd;
		bool h0 = b0.x >= 0.0 && a0.z > 0.0;
		bool h1 = b1.x >= 0.0 && a1.z > 0.0;
		float d0 = h0 ? glyphD(u - a0.xy, a0.z, a0.w, int(b0.x), cd) : (h1 ? 60.0 + glyphD(u - a1.xy, a1.z * 0.05, a1.w, int(b1.x), cd) : 1e3);
		float d1 = h1 ? glyphD(u - a1.xy, a1.z, a1.w, int(b1.x), cd) : (h0 ? 60.0 + glyphD(u - a0.xy, a0.z * 0.05, a0.w, int(b0.x), cd) : 1e3);
		d = min(d, mix(d0, d1, m));
	}
	return d;
}

// ---------------------------------------------------------------- waveform
float waveAt(float x01){ // x01 in [0,1] over the whole film; fine waveform, linear
	float n = uWaveInfo.x * uWaveInfo.y;
	float k = clamp(x01, 0.0, 1.0) * (n - 1.0);
	float row = floor(k / uWaveInfo.x);
	float col = k - row * uWaveInfo.x;
	return texture(uWave, vec2((col + 0.5) / uWaveInfo.x, (row + 0.5) / uWaveInfo.y)).r;
}
vec2 envAt(float x01){
	return texture(uEnv, vec2(clamp(x01, 0.0, 1.0), 0.5)).rg;
}

// ---------------------------------------------------------------- slots
float roundBox(vec2 p, vec2 b, float r){
	vec2 q = abs(p) - b + r;
	return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// bend: the strip of the plane (x along, y across) is rolled into an arc of curvature k; returns strip coordinates
vec2 bendCoords(vec2 u, float k, float rad){
	if (k < 1e-5) return u;
	float rho = 1.0 / k;
	vec2 c = vec2(0.0, -rho);           // centre of the arc, the strip lies on top of it
	vec2 d = u - c;
	float phi = atan(d.x, d.y);          // angle from the vertical
	float s = rho * phi;
	float n = length(d) - rho;
	return vec2(s, n);
}

float slotD(int l, int k, vec2 u, out float cd){
	vec4 a = T(l, O_SLOT + k * 4);
	vec4 b = T(l, O_SLOT + k * 4 + 1);
	vec4 c = T(l, O_SLOT + k * 4 + 2);
	int type = int(a.x + 0.5);
	float d = 1e5;
	cd = 1e5;
	if (type == 1){ // dot
		d = length(u - b.xy) - b.z;
	} else if (type == 2){ // word
		d = wordD(l, int(b.x + 0.5), u);
	} else if (type == 6){ // paired words
		d = pairD(l, b.x, u);
	} else if (type == 3){ // box: centre, half sizes, corner radius
		d = roundBox(u - b.xy, vec2(b.z, b.w), c.y);
	} else if (type == 5){ // waveform curve: b = [cx, cy, halfLen, amp], c = [shell, t0, t1, envMix]
		vec4 g = T(l, 6);
		vec2 q = u - b.xy;
		float bendK = g.x;
		vec2 s = bendCoords(q, bendK, 0.0);
		float x = s.x;
		float xn = x / (2.0 * b.z) + 0.5;      // 0..1 across the strip
		float t0 = c.y, t1 = c.z;
		float ph = mix(t0, t1, xn);
		float x01 = ph / uWaveInfo.w;
		float wv = waveAt(x01) * b.w;
		float dx = 1.5 * (t1 - t0) / (2.0 * b.z) / uWaveInfo.w;
		float slope = (waveAt(x01 + dx) - waveAt(x01 - dx)) * b.w / 3.0;
		float line = abs(s.y - wv) / sqrt(1.0 + slope * slope);
		vec2 e = envAt(x01) * b.w;
		float env = max(s.y - e.y, e.x - s.y);
		float m = c.w;
		d = mix(line, env, m);
		// the ends of the strip (a negative shell asks for a pure field: no end caps)
		if (c.x >= 0.0) d = max(d, abs(x) - b.z);
	}
	return d;
}

// ---------------------------------------------------------------- Chladni rosette
// value and gradient magnitude of the standing pattern cos(m th + p) cos(k r + q), analytically (derivatives inside loops are unreliable)
void term(float m, float p, float k, float q, float r, float th, float w, inout float G, inout vec2 gr){
	float ca = cos(m * th + p), sa = sin(m * th + p), cb = cos(k * r + q), sb = sin(k * r + q);
	G += w * ca * cb;
	gr += w * vec2(-k * ca * sb, -m * sa * cb / max(r, 1.0));
}
void rosetteG(vec2 u, vec4 r0, vec4 r1, out float G, out vec2 gv){
	float r = length(u);
	float th = atan(u.y, u.x) + r1.w;
	float mx = r1.z;
	float Ga = 0.0, Gb = 0.0;
	vec2 ga = vec2(0.0), gb = vec2(0.0);
	term(r0.y, r0.w, r0.z, 0.0, r, th, 1.0, Ga, ga);
	term(r0.y + 2.0, 1.1 + r0.w, 1.35 * r0.z, 0.6, r, th, 0.9, Ga, ga);
	term(r1.x, 0.0, r1.y, 0.0, r, th, 1.0, Gb, gb);
	term(r1.x + 2.0, 1.1, 1.35 * r1.y, 0.6, r, th, 0.9, Gb, gb);
	G = mix(Ga, Gb, mx);
	vec2 g = mix(ga, gb, mx);                       // (d/dr, (1/r) d/dtheta)
	vec2 rh = u / max(r, 1e-3);
	vec2 th_ = vec2(-rh.y, rh.x);
	gv = g.x * rh + g.y * th_;
}

// ---------------------------------------------------------------- one layer
vec4 renderLayer(int l, vec2 p){
	vec4 bg = T(l, 2);
	vec4 ink1 = T(l, 3);
	vec4 ink2 = T(l, 4);
	vec4 xf = T(l, 5);
	vec4 glw = T(l, 7);
	vec4 gl2 = T(l, 8);
	float zoom = xf.x;
	float cr = cos(xf.w), sr = sin(xf.w);
	vec2 q = (p - uRes * 0.5) / zoom;
	vec2 u = vec2(cr * q.x - sr * q.y, sr * q.x + cr * q.y) + xf.yz;
	vec4 sw = T(l, 104);   // swirl (rad), swirl radius, dissolve, dissolve radius
	vec4 sw2 = T(l, 105);  // spread, grain px, seed
	float r_pre = length(u);
	if (abs(sw.x) > 1e-4){
		float a_ = sw.x * exp(-r_pre / max(sw.y, 1.0));
		float ca = cos(a_), sa = sin(a_);
		u = vec2(ca * u.x - sa * u.y, sa * u.x + ca * u.y);
	}

	// slot fields per group
	float sumW[6]; float mixD[6];
	for (int g = 0; g < 6; g++){ sumW[g] = 0.0; mixD[g] = 0.0; }
	vec3 gcol[6]; float gamt[6];
	for (int g = 0; g < 6; g++){ gcol[g] = vec3(0.0); gamt[g] = 0.0; }
	vec4 cnt = T(l, 15);
	int nSlot = int(cnt.x + 0.5);
	int nPulse = int(cnt.y + 0.5);
	for (int k = 0; k < nSlot; k++){
		vec4 a = T(l, O_SLOT + k * 4);
		if (a.y <= 0.0001) continue;
		vec4 fc = T(l, O_SLOT + k * 4 + 3);
		float cd;
		float d = slotD(l, k, u, cd);
		vec4 c = T(l, O_SLOT + k * 4 + 2);
		if (c.x > 0.0 && int(a.x + 0.5) != 5) d = abs(d) - c.x; // shell: outline
		if (int(a.x + 0.5) == 5) d = d - max(c.x, 0.0);
		int g = int(a.w + 0.5);
		sumW[g] += a.y; mixD[g] += a.y * d;
		gcol[g] += a.y * fc.rgb; gamt[g] += a.y * fc.a;
	}
	vec3 col = bg.rgb;
	float alpha = bg.a;
	float line1 = ink1.a;

	// rosette
	vec4 r0 = T(l, 9);
	if (r0.x > 0.001){
		vec4 r1 = T(l, 10); vec4 r2 = T(l, 11); vec4 r3 = T(l, 12);
		float rad = r2.x;
		float G; vec2 gv;
		rosetteG(u, r0, r1, G, gv);
		vec4 wm = T(l, 106); // [word mix, distance to field scale, 0, 0]: the sand's nodal lines are pulled onto the outline of word 0
		if (wm.x > 0.001){
			float D = wordD(l, 0, u);
			float e = 1.5;
			vec2 gD = vec2(wordD(l, 0, u + vec2(e, 0.0)) - wordD(l, 0, u - vec2(e, 0.0)), wordD(l, 0, u + vec2(0.0, e)) - wordD(l, 0, u - vec2(0.0, e))) / (2.0 * e);
			G = mix(G, wm.y * D, wm.x);
			gv = mix(gv, wm.y * gD, wm.x);
		}
		float gm = max(length(gv), 1e-4);
		float dist = abs(G) / gm * zoom;                    // px to the nodal line
		float rr = length(u);
		float inside = clamp((rad - rr) * zoom, 0.0, 1.0);
		float ln = 1.0 - smoothstep(r2.y * 0.5 - 0.5, r2.y * 0.5 + 0.7, dist);
		float sand = step(hash(floor(p * 0.5) + 3.7), exp(-dist * dist / (2.0 * r3.a * r3.a + 0.01)) * 0.85);
		float a = max(ln, sand) * inside * r0.x;
		vec3 rc = mix(r3.rgb, ink2.rgb, 0.0);
		col = mix(col, rc, a);
		alpha = max(alpha, a * step(0.001, r0.x) * (bg.a < 0.5 ? 1.0 : 0.0));
		// plate edge
		float edge = 1.0 - smoothstep(0.0, 1.5, abs(rr - rad) * zoom - r2.z * 0.5);
		col = mix(col, ink1.rgb, edge * r0.x * step(0.001, r2.z));
	}

	// groups
	int nGroup = int(T(l, 6).y + 0.5);
	for (int g = 0; g < nGroup; g++){
		if (sumW[g] < 0.0001) continue;
		float d = mixD[g] / sumW[g];
		vec3 fcol = gcol[g] / sumW[g];
		float famt = gamt[g] / sumW[g];
		// pulses of this group
		for (int j = 0; j < nPulse; j++){
			vec4 a = T(l, O_PULSE + j * 2);
			if (int(a.x + 0.5) != g || a.w <= 0.001) continue;
			vec4 b = T(l, O_PULSE + j * 2 + 1);
			float wpx = a.z;
			float dd = abs(d - a.y) * zoom;
			float soft = max(b.y, 0.0);
			float ln = clamp(wpx * 0.5 + 0.5 - dd, 0.0, 1.0);
			if (soft > 0.0) ln = max(ln, exp(-dd * dd / (soft * soft)) * 0.35);
			vec3 lc = mix(ink1.rgb, ink2.rgb, b.x);
			col = mix(col, lc, ln * a.w);
			alpha = max(alpha, ln * a.w);
		}
		// field lines: level sets of the group's field at a fixed spacing, moving with the phase
		vec4 f0 = T(l, 13);
		vec4 f1 = T(l, 14);
		if (f0.w > 0.001 && int(f1.y + 0.5) == g){
			float sp = f0.x;
			float m = mod(d - f0.y, sp);
			float dl = min(m, sp - m) * zoom;
			float kIdx = floor((d - f0.y) / sp + 0.5);
			bool emph = f1.w > 0.5 && mod(kIdx, f1.w) < 0.5;
			float lnf = clamp(f0.z * (emph ? 1.9 : 1.0) * 0.5 + 0.5 - dl, 0.0, 1.0);
			float env = exp(-max(d, 0.0) / f1.x) * smoothstep(-1.0, 5.0, d * zoom);
			vec3 lcf = mix(ink1.rgb, ink2.rgb, emph ? 1.0 : f1.z);
			float af = lnf * env * f0.w;
			col = mix(col, lcf, af);
			alpha = max(alpha, af);
		}
		// fill
		float fa = clamp(0.5 - d * zoom, 0.0, 1.0) * famt;
		vec4 wp = T(l, 1);
		if (wp.z > 0.5) fa *= smoothstep(wp.x + wp.y, wp.x - wp.y, u.x);
		col = mix(col, fcol, fa);
		alpha = max(alpha, fa);
		// glow around the group flagged in gl2.y
		if (int(gl2.y + 0.5) == g && glw.a > 0.0){
			float gg = exp(-max(d, 0.0) / max(gl2.x, 1.0)) * glw.a;
			col = col + glw.rgb * gg * (1.0 - fa);
			alpha = max(alpha, gg * 0.6);
		}
	}
	if (sw.z > 0.001){
		// dust: the layer breaks into grains, the outer parts first (or, run backwards, it materialises out of dust)
		float rr_ = clamp(r_pre / max(sw.w, 1.0), 0.0, 1.0);
		float k = sw.z * (1.0 + sw2.x) - (1.0 - rr_) * sw2.x;
		float hg = hash(floor(p / max(sw2.y, 1.0)) + sw2.z);
		alpha *= step(k, hg);
	}
	return vec4(col, alpha);
}

// ---------------------------------------------------------------- composite
vec2 gRingO; float gRingR; float gRingW;
float ringMask(vec2 p){
	float d = length(p - gRingO);
	return 1.0 - smoothstep(gRingR - gRingW, gRingR, d);
}

vec3 compose(vec2 p){
	vec3 col = vec3(0.0);
	int nLayers = int(T(10, 5).x + 0.5);
	for (int l = 0; l < nLayers; l++){
		vec4 h = T(l, 0);
		if (h.x < 0.5) continue;
		float m = 1.0;
		int mm = int(h.y + 0.5);
		if (mm == 1) m = ringMask(p);
		float winD = 1e5;
		if (mm == 3){
			// a window: a rectangle that shrinks and morphs into a glyph (both in layer 0's scene coordinates)
			vec4 xf = T(0, 5);
			float cr = cos(xf.w), sr = sin(xf.w);
			vec2 q = (p - uRes * 0.5) / xf.x;
			vec2 u = vec2(cr * q.x - sr * q.y, sr * q.x + cr * q.y) + xf.yz;
			vec4 r7 = T(l, 107);
			vec4 r8 = T(l, 108);
			vec4 r9 = T(l, 109);
			float cd3;
			float Dr = roundBox(u - r7.xy, r7.zw, r8.x);
			float Dg = glyphD(u - r9.xy, r8.w, r9.z, int(r8.z + 0.5), cd3);
			winD = mix(Dr, Dg, r8.y) * xf.x;
			m = clamp(0.5 - winD / max(r9.w, 0.5), 0.0, 1.0);
		}
		if (mm == 2){
			// the counter of a glyph of layer 0's first word
			vec4 xf = T(0, 5);
			float cr = cos(xf.w), sr = sin(xf.w);
			vec2 q = (p - uRes * 0.5) / xf.x;
			vec2 u = vec2(cr * q.x - sr * q.y, sr * q.x + cr * q.y) + xf.yz;
			int gi = int(h.z + 0.5);
			int w = int(h.w + 0.5);
			vec4 a = T(0, O_WORD + w * 16 + gi * 2);
			vec4 b = T(0, O_WORD + w * 16 + gi * 2 + 1);
			float cd;
			glyphD(u - a.xy, a.z, a.w, int(b.x), cd);
			m = clamp(0.5 - cd * xf.x, 0.0, 1.0);
		}
		if (m <= 0.0) continue;
		vec4 c = renderLayer(l, p);
		float a = c.a * m;
		if (mm == 3){
			vec4 ol = T(l, 110);
			float e3 = smoothstep(0.0, 1.4, -winD - 0.4) * (1.0 - smoothstep(2.2, 3.6, -winD));
			c.rgb = mix(c.rgb, ol.rgb, e3 * ol.a);
		}
		if (l == 0 && T(0, 104).z <= 0.001) a = 1.0;
		if (T(l, 1).w > 0.5) col += c.rgb * a; else col = mix(col, c.rgb, a);
	}
	return col;
}

void main(){
	vec2 p = gl_FragCoord.xy + uJit;
	vec4 g0 = T(10, 0); // ring: ox, oy, R, W
	vec4 g1 = T(10, 1); // refract px, chroma px, rim, glitch amount
	vec4 g2 = T(10, 2); // rim colour, seed
	vec4 g3 = T(10, 3); // flash colour + amount
	vec4 g4 = T(10, 4); // slice shift px, band height, rgb split px, unused
	gRingO = g0.xy; gRingR = g0.z; gRingW = max(g0.w, 1.0);
	vec2 pp = p;
	// glitch slices
	if (g4.x > 0.01){
		float band = floor(p.y / max(g4.y, 2.0));
		float hsh = hash1(band + g2.a * 13.0);
		pp.x += (hsh - 0.5) * 2.0 * g4.x * step(0.55, hash1(band * 1.7 + g2.a));
	}
	// refraction on the ring
	vec2 dirv = normalize(pp - gRingO + 1e-4);
	float dist = length(pp - gRingO);
	float bump = exp(-pow((dist - (gRingR - gRingW * 0.5)) / (gRingW * 0.6), 2.0));
	vec2 disp = dirv * g1.x * bump;
	vec2 pr = pp + disp;
	vec3 col = vec3(0.0);
	float chroma = g1.y * bump + g4.z;
	int nch = chroma > 0.05 ? 3 : 1;
	for (int c = 0; c < nch; c++){
		vec2 ch = dirv * chroma * float(1 - c);
		if (g4.z > 0.0) ch = vec2(g4.z, 0.0) * float(1 - c);
		vec3 v = compose(pr + ch);
		if (nch == 1) col = v; else col[c] = v[c];
	}
	float m = ringMask(pp);
	col += g2.rgb * g1.z * (m * (1.0 - m) * 4.0) * step(0.5, g0.w) * step(1.0, gRingR);
	col = mix(col, g3.rgb, g3.a);
	outColor = vec4(col * uW, 1.0);
}`;

export const POST_FS = `#version 300 es
precision highp float;
uniform sampler2D uAcc;
uniform vec2 uRes;
uniform float uSeed;
uniform float uGrain;
uniform float uVig;
uniform float uFade;
out vec4 outColor;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
	vec2 uv = gl_FragCoord.xy / uRes;
	vec3 c = texture(uAcc, uv).rgb;
	vec2 q = uv - 0.5;
	c *= 1.0 - uVig * dot(q, q) * 1.5;
	float n = hash(gl_FragCoord.xy + uSeed * 17.0) - 0.5;
	float n2 = hash(gl_FragCoord.xy * 0.71 + uSeed * 31.0) - 0.5;
	c += (n + 0.5 * n2) * uGrain * (0.35 + 0.65 * (1.0 - dot(c, vec3(0.333))));
	c += (hash(gl_FragCoord.xy * 1.37 + uSeed * 5.0) - 0.5) / 255.0;
	c *= uFade;
	outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;
