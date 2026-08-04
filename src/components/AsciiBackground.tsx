"use client";

import { useEffect, useRef } from "react";
import { ASCII_FOREST, CHAR_SETS, AsciiConfig } from "@/lib/asciiConfig";

/**
 * Canvas2D reimplementation of the "Forest" ASCII effect, driven by scroll.
 *
 * Pipeline, in the order the spec lays it out:
 *   1. background — the photo, blurred, at bgOpacity, with a tilt-shift band
 *   2. sampling   — each photo downscaled to one pixel per cell, which is the
 *                   cheapest correct way to get a cell's average
 *   3. glyphs     — a character per cell, chosen by luminance
 *   4. tone       — brightness / contrast / grayscale, folded into step 3
 *   5. post       — chromatic, halftone, film dust
 *   8. animation  — shimmer, a travelling wave added to luminance
 *
 * The scene changes with the hero word that is currently lit. Rather than
 * swapping images, the luminance fields are interpolated: every scene is
 * sampled once into a Float32Array, and each frame reads a blend of the two
 * neighbouring fields. Glyphs therefore morph into each other instead of
 * cutting, and the crossfade costs one lerp per cell.
 *
 * Two decisions carry the frame budget. Glyphs are blitted from a sprite atlas
 * rather than drawn with fillText, because the grid runs to five figures of
 * cells. And chromatic aberration composites the finished glyph layer three
 * times rather than redrawing the glyphs three times.
 */

export const SCENES = [
  "/scene-travel1.jpg",
  "/scene-reunion1.jpg",
  "/scene-road-trip.png",
  "/scene-graduation.jpg",
  "/scene-hangout.png",
  "/scene-concert.png",
  "/scene-first-date.png",
  "/scene-everyday.jpg",
];

export function AsciiBackground({
  sources = SCENES,
  /** Elements whose position decides which scene is showing. */
  trackSelector = ".landing-hero li",
  config = ASCII_FOREST,
  className,
}: {
  sources?: string[];
  trackSelector?: string;
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
    const images: HTMLImageElement[] = [];
    let ready = false;

    /* --- Glyph atlas: each character rendered once, then blitted per cell --- */
    const atlas = document.createElement("canvas");
    const atlasCtx = atlas.getContext("2d")!;
    const GLYPH = cell * 2; // 2x so the blit stays crisp
    atlas.width = GLYPH * chars.length;
    atlas.height = GLYPH;
    atlasCtx.font = `700 ${GLYPH * 0.95}px ui-monospace, monospace`;
    atlasCtx.textAlign = "center";
    atlasCtx.textBaseline = "middle";
    atlasCtx.fillStyle = "#fff"; // light glyphs, for a black field
    for (let i = 0; i < chars.length; i++) {
      atlasCtx.fillText(chars[i], GLYPH * (i + 0.5), GLYPH * 0.54);
    }

    /* --- Reusable scratch canvases --- */
    const sample = document.createElement("canvas");
    const sampleCtx = sample.getContext("2d", { willReadFrequently: true })!;
    const layer = document.createElement("canvas");
    const layerCtx = layer.getContext("2d")!;
    const scratch = document.createElement("canvas");
    const scratchCtx = scratch.getContext("2d")!;
    const tintC = document.createElement("canvas");
    const tintCtx = tintC.getContext("2d")!;

    const dot = document.createElement("canvas");
    dot.width = dot.height = 4;
    const dotCtx = dot.getContext("2d")!;
    dotCtx.fillStyle = "#000";
    dotCtx.fillRect(0, 0, 1, 1);
    const halftone = ctx.createPattern(dot, "repeat")!;

    /** Piecewise-linear evaluation of the tone curve control points. */
    const curve = (v: number) => {
      const pts = config.toneCurve;
      for (let i = 1; i < pts.length; i++) {
        if (v <= pts[i].x) {
          const a = pts[i - 1];
          const b = pts[i];
          const t = b.x === a.x ? 0 : (v - a.x) / (b.x - a.x);
          return a.y + (b.y - a.y) * t;
        }
      }
      return pts[pts.length - 1].y;
    };

    let cols = 0;
    let rows = 0;
    /** One luminance field per scene. */
    let fields: Float32Array[] = [];

    /* --- Which scene, and how far into the next one --- */
    let sceneA = 0;
    let sceneB = 0;
    let mix = 0;

    function readScroll() {
      const items = document.querySelectorAll<HTMLElement>(trackSelector);
      if (!items.length) return;
      // Mirrors --band in globals.css: min(34vh, 15rem). Custom properties
      // holding a min() come back unresolved from getComputedStyle, so it is
      // cheaper and more reliable to recompute it than to parse it.
      const band = Math.min(window.innerHeight * 0.34, 15 * 16);

      // Position of the band, expressed in list-item units.
      const first = items[0].getBoundingClientRect();
      const lh = items.length > 1
        ? items[1].getBoundingClientRect().top - first.top
        : first.height;
      const pos = lh > 0 ? (band - (first.top + first.height / 2)) / lh : 0;

      const clamped = Math.max(0, Math.min(items.length - 1, pos));
      sceneA = Math.floor(clamped);
      sceneB = Math.min(sources.length - 1, sceneA + 1);
      mix = clamped - sceneA;
    }

    function resize() {
      if (!canvas || !ready) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);

      cols = Math.ceil(w / cell);
      rows = Math.ceil(h / cell);

      for (const c of [layer, scratch, tintC]) {
        c.width = canvas.width;
        c.height = canvas.height;
      }
      layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scratchCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      sample.width = cols;
      sample.height = rows;

      const contrast = config.contrast / 100;
      const brightness = config.brightness / 100;
      fields = images.map((img) => {
        sampleCtx.clearRect(0, 0, cols, rows);
        // Downscaling to one pixel per cell *is* the box average.
        sampleCtx.drawImage(img, 0, 0, cols, rows);
        const d = sampleCtx.getImageData(0, 0, cols, rows).data;
        const f = new Float32Array(cols * rows);
        for (let i = 0; i < f.length; i++) {
          // grayscale: 100 — luma only
          let v =
            (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) /
            255;
          v = (v - 0.5) * contrast + 0.5 + brightness;
          v = curve(v < 0 ? 0 : v > 1 ? 1 : v);
          f[i] = v < 0 ? 0 : v > 1 ? 1 : v;
        }
        // edgeEmphasis: a cheap gradient magnitude, subtracted so that edges
        // land on denser glyphs.
        const edge = config.edgeEmphasis / 100;
        if (edge > 0) {
          const src = Float32Array.from(f);
          for (let y = 1; y < rows - 1; y++) {
            for (let x = 1; x < cols - 1; x++) {
              const i = y * cols + x;
              const gx = Math.abs(src[i + 1] - src[i - 1]);
              const gy = Math.abs(src[i + cols] - src[i - cols]);
              const g = Math.min(1, (gx + gy) * 1.6);
              f[i] = Math.max(0, src[i] - g * edge);
            }
          }
        }

        return f;
      });
    }

    /** Cover-fit draw, used for both crossfaded scenes. */
    function cover(
      c: CanvasRenderingContext2D,
      img: HTMLImageElement,
      w: number,
      h: number,
    ) {
      const s = Math.max(w / img.width, h / img.height);
      const dw = img.width * s;
      const dh = img.height * s;
      c.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }

    function drawBackground(w: number, h: number) {
      const c = ctx!;

      // Crossfade the two scenes into scratch first, so the blur and the
      // tilt-shift mask each run once instead of twice.
      scratchCtx.clearRect(0, 0, w, h);
      scratchCtx.globalAlpha = 1;
      cover(scratchCtx, images[sceneA], w, h);
      if (sceneB !== sceneA && mix > 0) {
        scratchCtx.globalAlpha = mix;
        cover(scratchCtx, images[sceneB], w, h);
        scratchCtx.globalAlpha = 1;
      }

      c.save();
      c.globalAlpha = config.bgOpacity / 100;
      c.filter = `blur(${config.bgBlur}px)`;
      c.drawImage(scratch, 0, 0, w, h);
      c.filter = "none";

      if (config.blurType === "tilt" && config.blurAmount > 0) {
        const t = tintCtx;
        t.setTransform(1, 0, 0, 1, 0, 0);
        t.clearRect(0, 0, tintC.width, tintC.height);
        t.save();
        t.filter = `blur(${config.blurAmount * 0.4}px)`;
        t.drawImage(scratch, 0, 0);
        t.filter = "none";

        // Erase the in-focus band out of the blurred copy.
        const dpr = tintC.height / h;
        const centre = (config.tiltPosition / 100) * h * dpr;
        const half = ((config.tiltFocus / 100) * h * dpr) / 2;
        const feather = (config.tiltFeather / 100) * h * dpr;
        const span = 2 * (half + feather);
        const g = t.createLinearGradient(0, centre - half - feather, 0, centre + half + feather);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(feather / span, "rgba(0,0,0,0)");
        g.addColorStop(1 - feather / span, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,1)");
        t.globalCompositeOperation = "destination-in";
        t.fillStyle = g;
        t.fillRect(0, 0, tintC.width, tintC.height);
        t.restore();

        c.drawImage(tintC, 0, 0, w, h);
      }
      c.restore();
    }

    function drawFilmDust(w: number, h: number, seconds: number) {
      const c = ctx!;
      const n = Math.round((config.pfx.filmDust.intensity / 100) * 60);
      // Reseeded a few times a second, so it flickers like a projector gate
      // rather than hashing anew at 60fps.
      let seed = Math.floor(seconds * 6) * 9301;
      const rnd = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      c.save();
      for (let i = 0; i < n; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = rnd();
        c.globalAlpha = 0.1 + r * 0.22;
        c.fillStyle = r > 0.6 ? "#fff" : "#000";
        if (r > 0.85) c.fillRect(x, y, 1, 3 + r * 10);
        else c.fillRect(x, y, 1 + r, 1 + r);
      }
      c.restore();
    }

    function render(now: number) {
      if (stopped || !canvas || !ready) return;
      const c = ctx!;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const dpr = canvas.width / w;
      const t = now / 1000;

      readScroll();

      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      drawBackground(w, h);

      /* --- Glyph layer --- */
      layerCtx.clearRect(0, 0, w, h);

      const fa = fields[sceneA];
      const fb = fields[sceneB];
      const animOn = config.animated && !reduceMotion;
      const speed = (config.animSpeed.intensity / 100) * 1.6;
      const amp = (config.animIntensity.intensity / 100) * 0.16;
      const last = chars.length - 1;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          let v = fa[i] + (fb[i] - fa[i]) * mix;

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

      /* --- Chromatic aberration: composite the layer, not the glyphs --- */
      const ca = config.pfx.chromatic;
      if (ca.enabled) {
        const d = (ca.intensity / 100) * 3;
        const paint = (colour: string, dx: number) => {
          const tc = tintCtx;
          tc.setTransform(1, 0, 0, 1, 0, 0);
          tc.clearRect(0, 0, tintC.width, tintC.height);
          tc.drawImage(layer, 0, 0);
          tc.globalCompositeOperation = "source-in";
          tc.fillStyle = colour;
          tc.fillRect(0, 0, tintC.width, tintC.height);
          tc.globalCompositeOperation = "source-over";
          c.globalAlpha = 0.55;
          c.drawImage(tintC, dx, 0, w, h);
          c.globalAlpha = 1;
        };
        paint("#ff2d2d", -d);
        paint("#2dd4ff", d);
      }
      c.drawImage(layer, 0, 0, w, h);

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

    let loaded = 0;
    sources.forEach((src, i) => {
      const img = new Image();
      img.onload = () => {
        images[i] = img;
        if (++loaded === sources.length) {
          ready = true;
          resize();
          raf = requestAnimationFrame(render);
        }
      };
      img.src = src;
    });

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [sources, trackSelector, config]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
