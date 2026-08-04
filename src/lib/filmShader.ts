"use client";

/**
 * Local disposable-camera look, as a single-pass WebGL shader.
 *
 * Runs on-device in a few milliseconds: free, offline, deterministic, and it
 * physically cannot alter a face — it only remaps colour. The one thing it
 * cannot do is relight the scene, because it has no idea what is subject and
 * what is background. That is the sole reason to reach for the AI path.
 */

export type FilmParams = {
  /** Film grain strength. Real grain peaks in midtones, so it's modulated by luminance. */
  grain: number;
  /** How far the green/olive shadow, warm highlight split is pushed. */
  cast: number;
  /** Black-point crush. */
  crush: number;
  /** Highlight bloom from the flash. */
  bloom: number;
  /** Corner darkening. */
  vignette: number;
  /** RGB channel separation at the edges. */
  aberration: number;
  /** Cheap-plastic-lens softness toward the corners. */
  softness: number;
  /** Dust specks and hairline scratches. */
  dust: number;
  /**
   * Approximates flash falloff. A real flash lights by 1/d², and what is far
   * is usually already dimmer — so pushing the dim end down further reads as
   * "lit by a flash" without needing to know what is subject and what is not.
   */
  falloff: number;
  /** Overall saturation multiplier. */
  saturation: number;
  /** Randomises grain/dust placement per shot. */
  seed: number;
};

export const DEFAULT_PARAMS: Omit<FilmParams, "seed"> = {
  grain: 0.62,
  cast: 0.95,
  crush: 0.42,
  bloom: 0.45,
  vignette: 0.6,
  aberration: 0.4,
  softness: 0.45,
  dust: 0.22,
  falloff: 0.85,
  saturation: 0.78,
};

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_tex;
uniform vec2  u_texel;
uniform float u_grain, u_cast, u_crush, u_bloom, u_vignette;
uniform float u_aberration, u_softness, u_dust, u_saturation, u_seed;
uniform float u_falloff;

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

/* Small gaussian, used for both lens softness and the bloom pass. */
vec3 blur(vec2 uv, float radius) {
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      vec2 off = vec2(float(x), float(y)) * u_texel * radius;
      float w = exp(-float(x * x + y * y) * 0.4);
      sum += texture(u_tex, uv + off).rgb * w;
      total += w;
    }
  }
  return sum / total;
}

void main() {
  vec2 uv = v_uv;
  vec2 fromCentre = uv - 0.5;
  float r = length(fromCentre) * 1.414;

  /* --- Cheap plastic lens: chromatic aberration, scaling with distance --- */
  vec2 shift = fromCentre * u_aberration * 0.006;
  vec3 col = vec3(
    texture(u_tex, uv + shift).r,
    texture(u_tex, uv).g,
    texture(u_tex, uv - shift).b
  );

  /* --- Corners go soft, centre stays sharp --- */
  float softMask = smoothstep(0.25, 1.0, r) * u_softness;
  if (softMask > 0.001) col = mix(col, blur(uv, 2.2), softMask);

  /* --- Flash bloom: bright areas bleed into their neighbours --- */
  if (u_bloom > 0.001) {
    vec3 blurred = blur(uv, 4.0);
    vec3 highlights = max(blurred - 0.55, 0.0) * 2.2;
    col = 1.0 - (1.0 - col) * (1.0 - highlights * u_bloom);
  }

  /* --- Tone curve: crushed blacks, softly rolled-off whites --- */
  col = max(col - u_crush * 0.22, 0.0) / max(1.0 - u_crush * 0.22, 0.001);
  col = 1.0 - pow(max(1.0 - col, 0.0), vec3(1.18));
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.42); // S-curve, not gentle

  /* --- Analogue colour science ---
     Shadows drift olive, highlights drift warm yellow, reds lift slightly,
     blues get muted. Kodak Gold under a direct flash, roughly. */
  float l = luma(col);
  vec3 shadowTint    = vec3(-0.045, 0.070, -0.075);
  vec3 highlightTint = vec3( 0.085, 0.052, -0.095);
  col += shadowTint    * (1.0 - smoothstep(0.0, 0.55, l)) * u_cast;
  col += highlightTint * smoothstep(0.35, 1.0, l)         * u_cast;
  col.r *= 1.0 + 0.07 * u_cast;
  col.b *= 1.0 - 0.16 * u_cast;

  col = mix(vec3(luma(col)), col, u_saturation);

  /* --- Flash falloff: whatever the flash didn't reach drops away.
         The range reaches well into the midtones, because an indoor frame is
         mostly midtones — clamping this to near-black does nothing at all. --- */
  float lf = luma(col);
  float lit = smoothstep(0.20, 0.88, lf);
  col *= mix(1.0 - u_falloff * 0.62, 1.0, lit);
  // ...and what the flash *did* reach gets pushed up, so the subject separates.
  col += col * pow(lit, 2.0) * u_falloff * 0.18;

  /* --- Vignette --- */
  col *= 1.0 - smoothstep(0.20, 1.05, r) * u_vignette;

  /* --- Grain. Peaks in the midtones and vanishes at both ends, which is what
         separates real emulsion from a flat noise overlay. --- */
  if (u_grain > 0.001) {
    float lum = luma(col);
    float weight = 1.0 - abs(lum * 2.0 - 1.0);
    // Coarse on purpose: fine grain averages itself away the moment the photo
    // is displayed smaller than it was rendered.
    float n = hash(floor(uv * 620.0) + u_seed) - 0.5;
    float nf = hash(uv * 1600.0 + u_seed + 3.1) - 0.5;
    float nc = hash(floor(uv * 620.0) + u_seed + 7.3) - 0.5;
    col += (n * 0.6 + nf * 0.25 + nc * 0.15) * u_grain * 0.3 * weight;
  }

  /* --- Dust specks and hairline scratches from a dirty scanner --- */
  if (u_dust > 0.001) {
    float speck = hash(floor(uv * 1100.0) + u_seed * 3.0);
    if (speck > 0.99935) col += vec3(0.5) * u_dust;

    // Lint fibres: short, and only a few per frame.
    float lint = hash(floor(uv * vec2(420.0, 150.0)) + u_seed * 5.0);
    if (lint > 0.99955) col += vec3(0.28) * u_dust;

    // One or two hairline scratches, faint, never a curtain of them.
    float scratch = hash(vec2(floor(uv.x * 700.0), floor(u_seed)));
    if (scratch > 0.9993) col += vec3(0.14) * u_dust * (1.0 - r * 0.5);
  }

  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("Could not create shader.");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader failed to compile: ${log}`);
  }
  return sh;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the captured photo."));
    img.src = src;
  });
}

export function isSupported(): boolean {
  if (typeof document === "undefined") return false;
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

/**
 * Applies the film look and returns a JPEG data URL.
 * Throws if WebGL2 is unavailable — callers should fall back to the AI path.
 */
export async function applyFilmLook(
  source: string,
  overrides: Partial<FilmParams> = {},
): Promise<string> {
  const img = await loadImage(source);

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true,
    antialias: false,
  });
  if (!gl) throw new Error("WebGL2 is not available.");

  const program = gl.createProgram();
  if (!program) throw new Error("Could not create program.");
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program failed to link: ${gl.getProgramInfoLog(program)}`);
  }
  gl.useProgram(program);

  // Full-screen triangle pair.
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

  const p: FilmParams = {
    ...DEFAULT_PARAMS,
    seed: Math.random() * 1000,
    ...overrides,
  };

  const set = (name: string, value: number) =>
    gl.uniform1f(gl.getUniformLocation(program, name), value);

  gl.uniform2f(
    gl.getUniformLocation(program, "u_texel"),
    1 / canvas.width,
    1 / canvas.height,
  );
  gl.uniform1i(gl.getUniformLocation(program, "u_tex"), 0);
  set("u_grain", p.grain);
  set("u_cast", p.cast);
  set("u_crush", p.crush);
  set("u_bloom", p.bloom);
  set("u_vignette", p.vignette);
  set("u_aberration", p.aberration);
  set("u_softness", p.softness);
  set("u_dust", p.dust);
  set("u_falloff", p.falloff);
  set("u_saturation", p.saturation);
  set("u_seed", p.seed);

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  const out = canvas.toDataURL("image/jpeg", 0.92);

  // Release the context rather than waiting for GC; browsers cap how many
  // live WebGL contexts a page may hold.
  gl.getExtension("WEBGL_lose_context")?.loseContext();

  return out;
}
