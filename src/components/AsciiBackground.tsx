"use client";

import { useEffect, useRef } from "react";
import { ASCII_FOREST, CHAR_SETS, AsciiConfig } from "@/lib/asciiConfig";

/**
 * Canvas2D reimplementation of the "Forest" ASCII effect.
 *
 * Pipeline, in the order the spec lays it out:
 *   1. background — the photo, blurred, at bgOpacity, with a tilt-shift band
 *   2. sampling   — the photo downscaled to one pixel per cell, which is the
 *                   cheapest correct way to get each cell's average
 *   3. glyphs     — a character per cell, chosen by luminance
 *   4. tone       — brightness / contrast / grayscale, folded into step 3
 *   5. post       — chromatic, halftone, film dust
 *   8. animation  — shimmer, a travelling wave added to luminance
 *
 * Two decisions carry the frame budget. Glyphs are pre-rendered once into a
 * sprite atlas and blitted, because ~13,000 fillText calls per frame is not
 * affordable and ~13,000 drawImage calls is. And chromatic aberration runs as
 * three composites of the finished glyph layer rather than three passes over
 * the glyphs themselves.
 */
export function AsciiBackground({
  src = "/hero-forest.png",
  config = ASCII_FOREST,
  className,
}: {
  src?: string;
  config?: AsciiConfig;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const chars = CHAR_SETS[config.charSet] ?? CHAR_SETS.standard;
    const cell = config.cellSize;

    let raf = 0;
    let stopped = false;
    let image: HTMLImageElement | null = null;

    /* --- Glyph atlas: each character rendered once, then blitted per cell --- */
    const atlas = document.createElement("canvas");
    const atlasCtx = atlas.getContext("2d")!;
    const GLYPH = cell * 2; // 2x for crispness when the cell is small
    atlas.width = GLYPH * chars.length;
    atlas.height = GLYPH;
    atlasCtx.font = `700 ${GLYPH * 0.95}px ui-monospace, monospace`;
    atlasCtx.textAlign = "center";
    atlasCtx.textBaseline = "middle";
    atlasCtx.fillStyle = "#000";
    for (let i = 0; i < chars.length; i++) {
      atlasCtx.fillText(chars[i], GLYPH * (i + 0.5), GLYPH * 0.54);
    }

    /* --- Reusable scratch canvases --- */
    const sample = document.createElement("canvas");
    const sampleCtx = sample.getContext("2d", { willReadFrequently: true })!;
    const layer = document.createElement("canvas");
    const layerCtx = layer.getContext("2d")!;
    const tint = document.createElement("canvas");
    const tintCtx = tint.getContext("2d")!;

    /* --- Halftone dot pattern, built once --- */
    const dot = document.createElement("canvas");
    dot.width = dot.height = 4;
    const dotCtx = dot.getContext("2d")!;
    dotCtx.fillStyle = "#000";
    dotCtx.fillRect(0, 0, 1, 1);
    const halftone = ctx.createPattern(dot, "repeat")!;

    let cols = 0;
    let rows = 0;
    let lum: Float32Array = new Float32Array(0);

    function resize() {
      if (!canvas || !image) return;
      // DPR is deliberately capped: this is a decorative backdrop, and the
      // glyph grid is the detail budget, not the pixel grid.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.ceil(w / cell);
      rows = Math.ceil(h / cell);

      layer.width = canvas.width;
      layer.height = canvas.height;
      tint.width = canvas.width;
      tint.height = canvas.height;
      layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Downscaling to one pixel per cell *is* the box average.
      sample.width = cols;
      sample.height = rows;
      sampleCtx.clearRect(0, 0, cols, rows);
      sampleCtx.drawImage(image, 0, 0, cols, rows);
      const data = sampleCtx.getImageData(0, 0, cols, rows).data;

      lum = new Float32Array(cols * rows);
      const contrast = config.contrast / 100;
      const brightness = config.brightness / 100;
      for (let i = 0; i < cols * rows; i++) {
        const r = data[i * 4] / 255;
        const g = data[i * 4 + 1] / 255;
        const b = data[i * 4 + 2] / 255;
        // grayscale: 100 — luma only, no channel mixing to preserve
        let v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        v = (v - 0.5) * contrast + 0.5 + brightness;
        lum[i] = Math.min(1, Math.max(0, v));
      }
    }

    /* --- Background: blurred photo, with a sharp tilt-shift band --- */
    function drawBackground(w: number, h: number) {
      if (!image) return;
      const c = ctx!;
      c.save();
      c.globalAlpha = config.bgOpacity / 100;

      // Cover-fit the photo.
      const scale = Math.max(w / image.width, h / image.height);
      const dw = image.width * scale;
      const dh = image.height * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;

      c.filter = `blur(${config.bgBlur}px)`;
      c.drawImage(image, dx, dy, dw, dh);

      // Tilt-shift: a heavily blurred copy, masked away inside the focus band.
      if (config.blurType === "tilt" && config.blurAmount > 0) {
        const t = tintCtx;
        t.setTransform(1, 0, 0, 1, 0, 0);
        t.clearRect(0, 0, tint.width, tint.height);
        t.save();
        const dpr = tint.width / w;
        t.scale(dpr, dpr);
        t.filter = `blur(${config.blurAmount * 0.4}px)`;
        t.drawImage(image, dx, dy, dw, dh);
        t.filter = "none";

        // Erase the in-focus band out of the blurred copy.
        const centre = (config.tiltPosition / 100) * h;
        const half = ((config.tiltFocus / 100) * h) / 2;
        const feather = (config.tiltFeather / 100) * h;
        const g = t.createLinearGradient(0, centre - half - feather, 0, centre + half + feather);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(feather / (2 * (half + feather)), "rgba(0,0,0,0)");
        g.addColorStop(1 - feather / (2 * (half + feather)), "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,1)");
        t.globalCompositeOperation = "destination-in";
        t.fillStyle = g;
        t.fillRect(0, 0, w, h);
        t.restore();

        c.filter = "none";
        c.drawImage(tint, 0, 0, w, h);
      }

      c.filter = "none";
      c.restore();
    }

    /* --- Post-effects --- */
    function drawFilmDust(w: number, h: number, seedTime: number) {
      const c = ctx!;
      const n = Math.round((config.pfx.filmDust.intensity / 100) * 60);
      // Reseeded a few times a second so it flickers like a projector, not 60fps hash.
      let seed = Math.floor(seedTime * 6) * 9301;
      const rnd = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      c.save();
      for (let i = 0; i < n; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = rnd();
        c.globalAlpha = 0.10 + r * 0.22;
        c.fillStyle = r > 0.6 ? "#fff" : "#000";
        if (r > 0.85) c.fillRect(x, y, 1, 3 + r * 10); // hair
        else c.fillRect(x, y, 1 + r, 1 + r); // speck
      }
      c.restore();
    }

    function render(now: number) {
      if (stopped || !canvas || !image) return;
      const c = ctx!;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const t = now / 1000;

      c.setTransform(
        canvas.width / w,
        0,
        0,
        canvas.width / w,
        0,
        0,
      );
      c.clearRect(0, 0, w, h);
      drawBackground(w, h);

      /* --- Glyph layer --- */
      layerCtx.setTransform(layer.width / w, 0, 0, layer.width / w, 0, 0);
      layerCtx.clearRect(0, 0, w, h);

      const animOn = config.animated && !reduceMotion;
      const speed = (config.animSpeed.intensity / 100) * 1.6;
      const amp = (config.animIntensity.intensity / 100) * 0.16;
      const last = chars.length - 1;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let v = lum[y * cols + x];

          // shimmer: a wave travelling diagonally through the luminance field
          if (animOn) v += Math.sin(t * speed + (x + y) * 0.28) * amp;
          v = v < 0 ? 0 : v > 1 ? 1 : v;

          const shade = config.invert ? v : 1 - v;
          if (shade < 0.06) continue; // nothing to draw in the brightest cells

          const idx = Math.min(last, Math.round((1 - shade) * last));
          layerCtx.globalAlpha = Math.min(1, shade * 1.15);
          layerCtx.drawImage(
            atlas,
            idx * GLYPH,
            0,
            GLYPH,
            GLYPH,
            x * cell,
            y * cell,
            cell,
            cell,
          );
        }
      }
      layerCtx.globalAlpha = 1;

      /* --- Chromatic aberration: composite the finished layer, not the glyphs --- */
      const ca = config.pfx.chromatic;
      if (ca.enabled) {
        const d = (ca.intensity / 100) * 3;
        const paint = (colour: string, dx: number) => {
          const tc = tintCtx;
          tc.setTransform(1, 0, 0, 1, 0, 0);
          tc.clearRect(0, 0, tint.width, tint.height);
          tc.drawImage(layer, 0, 0);
          tc.globalCompositeOperation = "source-in";
          tc.fillStyle = colour;
          tc.fillRect(0, 0, tint.width, tint.height);
          tc.globalCompositeOperation = "source-over";
          c.globalAlpha = 0.55;
          c.drawImage(tint, dx, 0, w, h);
          c.globalAlpha = 1;
        };
        paint("#ff2d2d", -d);
        paint("#2dd4ff", d);
      }
      c.drawImage(layer, 0, 0, w, h);

      /* --- Halftone --- */
      const ht = config.pfx.halftone;
      if (ht.enabled) {
        c.save();
        c.globalAlpha = (ht.intensity / 100) * 0.5;
        c.globalCompositeOperation = "multiply";
        c.fillStyle = halftone;
        c.fillRect(0, 0, w, h);
        c.restore();
      }

      if (config.pfx.filmDust.enabled) drawFilmDust(w, h, t);

      raf = requestAnimationFrame(render);
    }

    const img = new Image();
    img.onload = () => {
      image = img;
      resize();
      raf = requestAnimationFrame(render);
    };
    img.src = src;

    const onResize = () => {
      resize();
    };
    window.addEventListener("resize", onResize);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [src, config]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
