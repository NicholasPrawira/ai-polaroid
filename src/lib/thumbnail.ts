import { loadImage } from "./lut";

/**
 * Longest edge of the grid rendition. The gallery draws tiles at roughly
 * 150 CSS px, so 320 still looks sharp on a 2x screen while being a
 * fraction of the bytes.
 */
const THUMB_EDGE = 320;

/** Lower than the 0.92 the full photo is saved at. At tile size the
 *  difference isn't visible, and it roughly halves the file again. */
const THUMB_QUALITY = 0.7;

/**
 * Builds the small rendition the gallery grid loads instead of the full
 * photo.
 *
 * The grid renders every photo at ~150px but was downloading the full
 * ~395KB original for each one, and because the gallery has no pagination
 * that cost repeats for the whole library on every visit. A ~25KB
 * thumbnail is the single biggest lever on egress here.
 *
 * Done on-device at save time rather than through Supabase's image
 * transformation service: that service is Pro-only and billed per origin
 * image ($5 per 1,000, with only 100/month included), which for a user
 * shooting 900 photos a month would cost more than the bandwidth it saves.
 * A canvas resize costs nothing and the result is stored once.
 */
export async function makeThumbnail(dataUrl: string): Promise<Blob> {
  const img = await loadImage(dataUrl);

  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  // Never upscale: a photo already smaller than the target is left alone.
  const scale = longest > THUMB_EDGE ? THUMB_EDGE / longest : 1;
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not build thumbnail.")),
      "image/jpeg",
      THUMB_QUALITY,
    );
  });
}
