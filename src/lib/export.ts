"use client";

import { Shot } from "./types";

/* Print geometry, proportioned like real 600-series stock. */
const IMG = 1024;
const SIDE = 88;
const TOP = 88;
const BOTTOM = 300;
const W = IMG + SIDE * 2;
const H = TOP + IMG + BOTTOM;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the developed image."));
    img.src = src;
  });
}

/**
 * Burns the frame into a single downloadable PNG so the saved file matches
 * what's on screen. The borders stay blank — no caption, no date stamp.
 */
export async function composeExport(shot: Shot): Promise<string> {
  const img = await loadImage(shot.imageUrl);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");

  // Paper
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Image well
  ctx.fillStyle = "#111111";
  ctx.fillRect(SIDE, TOP, IMG, IMG);
  ctx.drawImage(img, SIDE, TOP, IMG, IMG);

  return canvas.toDataURL("image/png");
}

export async function downloadShot(shot: Shot) {
  const dataUrl = await composeExport(shot);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `polaroid-${shot.id}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
