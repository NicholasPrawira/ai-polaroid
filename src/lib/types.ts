export type Shot = {
  id: string;
  /** Data URL of the AI-developed photo. */
  imageUrl: string;
  createdAt: number;
  /** Which folder the photo lives in. `null` means unsorted. */
  folderId: string | null;
};

export type Folder = {
  id: string;
  name: string;
  createdAt: number;
};

export type Screen = "camera" | "processing" | "result" | "gallery";

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
