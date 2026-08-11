export type Shot = {
  id: string;
  /** Data URL of the developed photo. */
  imageUrl: string;
  createdAt: number;
  /** Which folder the photo lives in. `null` means unsorted. */
  folderId: string | null;
  /** A short note about the moment. `null` until the user adds one. */
  caption: string | null;
  /** Path in the private `photos` storage bucket — needed to remove the
   *  object itself when the photo is deleted, not just its database row. */
  storagePath: string;
  /** Path in the private `voice-notes` storage bucket, or `null` if this
   *  shot has no voice memory attached. */
  voicePath: string | null;
  /** Playable (signed) URL for the voice note, or `null` to match `voicePath`. */
  voiceUrl: string | null;
};

export type Folder = {
  id: string;
  name: string;
  createdAt: number;
  /** Hex string, or `null` for the default neutral folder. */
  color: string | null;
};

/** Curated so every option reads clearly against the dark surface — no
 *  free-form picker, just a small set that's already been checked for
 *  contrast. */
export const FOLDER_COLORS = [
  "#b97416", // film amber, matches the app's existing accent
  "#4a72b0", // blue
  "#5b8c5a", // green
  "#a24a4a", // rust
  "#8a6bb0", // violet
] as const;

export type Screen = "camera" | "result" | "gallery";

export type Profile = {
  /** Off means a capture is saved raw, straight off the camera — no LUT
   *  grade, vignette, or grain applied. */
  preset_enabled: boolean;
};

/** Groups a date the way a photo roll reads: today, yesterday, then the date. */
export function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(d)) / 86_400_000);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}
