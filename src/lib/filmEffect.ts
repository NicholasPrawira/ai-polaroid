import { loadImage, sampleLut, type Lut3D } from "./lut";

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function clampInt(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** 0 below `edge0`, 1 above `edge1`, eased in between — used for the
 *  vignette falloff so it reads as a gradient, not a hard ring. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Downscale-then-upscale as a cheap Gaussian blur, keeping only pixels
 *  bright enough to have blown the flash out — the soft glow that puts
 *  around a lit dashboard screen or a chrome highlight. */
function createBloomLayer(source: HTMLCanvasElement): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const smallW = Math.max(8, Math.round(w / 12));
  const smallH = Math.max(8, Math.round(h / 12));

  const small = document.createElement("canvas");
  small.width = smallW;
  small.height = smallH;
  const sctx = small.getContext("2d");
  if (!sctx) return small;
  sctx.drawImage(source, 0, 0, smallW, smallH);

  const smallData = sctx.getImageData(0, 0, smallW, smallH);
  const px = smallData.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255;
    const g = px[i + 1] / 255;
    const b = px[i + 2] / 255;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const t = clamp01((luma - 0.62) / 0.38);
    px[i] = Math.round(r * t * 255);
    px[i + 1] = Math.round(g * t * 255);
    px[i + 2] = Math.round(b * t * 255);
    px[i + 3] = Math.round(t * 255);
  }
  sctx.putImageData(smallData, 0, 0);

  const bloom = document.createElement("canvas");
  bloom.width = w;
  bloom.height = h;
  const bctx = bloom.getContext("2d");
  if (!bctx) return bloom;
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(small, 0, 0, w, h);
  return bloom;
}

/**
 * Grades a capture into the disposable-camera-flash look: warm/olive LUT
 * color with crushed, tinted shadows, an underexposed vignette, faint
 * chromatic aberration at the edges, soft highlight bloom, and coarse
 * monochrome film grain. This is the app's one develop pipeline — every
 * photo runs through it, on-device, no model call involved.
 */
export async function applyDisposableLook(dataUrl: string, lut: Lut3D): Promise<string> {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  ctx.drawImage(img, 0, 0);

  const src = ctx.getImageData(0, 0, w, h);
  const srcPx = src.data;
  const out = ctx.createImageData(w, h);
  const outPx = out.data;

  const cx = w / 2;
  const cy = h / 2;
  const maxDist = Math.hypot(cx, cy);
  // How far a channel drifts apart at the extreme corner, in pixels.
  const caPx = Math.max(w, h) * 0.0035;

  for (let y = 0; y < h; y++) {
    const dy = y - cy;
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dist = Math.hypot(dx, dy) / maxDist; // 0 at center, ~1 at corner
      const ux = dist === 0 ? 0 : dx / (dist * maxDist);
      const uy = dist === 0 ? 0 : dy / (dist * maxDist);

      // Chromatic aberration: sample red and blue from points nudged
      // outward/inward along the radius, green stays put.
      const shift = dist * dist * caPx;
      const rx = clampInt(Math.round(x + ux * shift), 0, w - 1);
      const ry = clampInt(Math.round(y + uy * shift), 0, h - 1);
      const bx = clampInt(Math.round(x - ux * shift), 0, w - 1);
      const by = clampInt(Math.round(y - uy * shift), 0, h - 1);

      const gi = (y * w + x) * 4;
      const ri = (ry * w + rx) * 4;
      const bi = (by * w + bx) * 4;

      let r = srcPx[ri] / 255;
      let g = srcPx[gi + 1] / 255;
      let b = srcPx[bi + 2] / 255;

      [r, g, b] = sampleLut(lut, r, g, b);

      // Overall underexposure — a cheap flash only really lights what's
      // close to the lens, so everything starts a stop or so darker.
      const exposure = 0.82;
      r *= exposure;
      g *= exposure;
      b *= exposure;

      // Crush shadows toward black rather than letting them sit as flat
      // dark gray — film contrast, not just a darker exposure.
      r = Math.pow(clamp01(r), 1.25);
      g = Math.pow(clamp01(g), 1.2);
      b = Math.pow(clamp01(b), 1.3);

      // Olive-green tint in the shadows, strongest where it's darkest —
      // straight black would read as digital, not film.
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const shadow = (1 - luma) * (1 - luma) * 0.1;
      r = clamp01(r + shadow * 0.35);
      g = clamp01(g + shadow * 0.55);
      b = clamp01(b - shadow * 0.45);

      // Vignette on top of that — the background keeps falling away past
      // where the flash reaches, well before the frame edge.
      const vignette = 1 - smoothstep(0.25, 1.0, dist) * 0.65;
      r *= vignette;
      g *= vignette;
      b *= vignette;

      // Monochrome film grain — one delta per pixel across all channels,
      // so it reads as grain rather than colored digital noise. Coarser in
      // the shadows, the way cheap film stock actually behaves.
      const grainAmount = 0.055 + (1 - luma) * 0.05;
      const grain = (Math.random() - 0.5) * grainAmount;
      r = clamp01(r + grain);
      g = clamp01(g + grain);
      b = clamp01(b + grain);

      outPx[gi] = Math.round(r * 255);
      outPx[gi + 1] = Math.round(g * 255);
      outPx[gi + 2] = Math.round(b * 255);
      outPx[gi + 3] = 255;
    }
  }

  ctx.putImageData(out, 0, 0);

  // Soft bloom around blown highlights — the dashboard screen, chrome trim
  // catching the flash — instead of them just sitting there as flat white.
  const bloom = createBloomLayer(canvas);
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.55;
  ctx.drawImage(bloom, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  return canvas.toDataURL("image/jpeg", 0.92);
}

export type { Lut3D };
