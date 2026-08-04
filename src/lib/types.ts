export type Shot = {
  id: string;
  /**
   * Signed URL for the developed photograph. Short-lived — the bucket is
   * private, so this is minted per read rather than stored.
   */
  imageUrl: string;
  /** When the shutter fired, not when the row was written. */
  createdAt: number;
  /** Which folder the photo lives in. `null` means unsorted. */
  folderId: string | null;
};

export type Folder = {
  id: string;
  name: string;
  createdAt: number;
};

/** Photo credits and whether this account can open the dashboard. */
export type Profile = {
  email: string | null;
  credits: number;
  isAdmin: boolean;
};

/** What the account sheet shows, threaded to whichever screen is on top. */
export type AccountSummary = Profile & {
  photoCount: number;
  folderCount: number;
  /** Lets a redeemed code update the balance without a reload. */
  onCredits: (credits: number) => void;
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
