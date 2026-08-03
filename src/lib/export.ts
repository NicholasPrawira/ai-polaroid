"use client";

import { Shot } from "./types";

/**
 * The saved file is the developed photograph itself — no frame, no border, no
 * text. Nothing is composited, so the model's output is preserved bit-for-bit
 * rather than being re-encoded through a canvas.
 */
export async function prepareDownload(
  shot: Shot,
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(shot.imageUrl);
  if (!res.ok) throw new Error("Could not read the developed photo.");
  const blob = await res.blob();

  const ext = blob.type === "image/jpeg" ? "jpg" : "png";
  return { blob, filename: `disposable-${shot.id}.${ext}` };
}

/**
 * Saves the print. Must be called synchronously from the click handler —
 * Safari drops the user-activation flag across an `await`, and then blocks both
 * the share sheet and the download.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const file = new File([blob], filename, { type: blob.type });

  // Share only where a plain download can't land a file the user can find.
  // macOS Safari supports the Share API too, but there a share sheet is the
  // wrong answer — "Save" should put a file in Downloads.
  const touchOnly =
    navigator.maxTouchPoints > 0 &&
    !window.matchMedia("(pointer: fine)").matches;

  if (touchOnly && navigator.canShare?.({ files: [file] })) {
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
