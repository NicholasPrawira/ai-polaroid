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

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not encode the print.")),
      "image/png",
    );
  });
}

/**
 * Burns the frame into a downloadable PNG so the saved file matches what's on
 * screen. The borders stay blank — no caption, no date stamp.
 *
 * Returns a Blob rather than a data URL: Safari silently refuses to download
 * data URLs past a fairly small size, and these prints comfortably exceed it.
 */
export async function composeExport(shot: Shot): Promise<Blob> {
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

  return toBlob(canvas);
}

export function filenameFor(shot: Shot): string {
  return `polaroid-${shot.id}.png`;
}

/**
 * Saves the print. Must be called synchronously from the click handler —
 * Safari drops the user-activation flag across an `await`, and then blocks both
 * the share sheet and the download.
 *
 * iOS Safari has no visible filesystem, so the Share Sheet ("Save Image") is
 * the only route that actually lands a photo in the camera roll. Everywhere
 * else, fall back to a download of an object URL.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    // Fire and forget; a user dismissing the sheet rejects, which is not an error.
    void navigator.share({ files: [file] }).catch(() => {});
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give Safari a moment to start reading the stream before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
