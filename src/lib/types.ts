import { DevelopMode } from "./develop";

export type Shot = {
  id: string;
  /** The untouched capture, kept so the other pipeline can be run on it later. */
  sourceUrl: string;
  /** Developed results, filled in per pipeline as they're produced. */
  variants: Partial<Record<DevelopMode, string>>;
  /** Which pipeline produced this shot originally. */
  mode: DevelopMode;
  createdAt: number;
};

/** The image to show for a shot, preferring the requested pipeline. */
export function displayUrl(shot: Shot, prefer?: DevelopMode): string {
  return (
    (prefer && shot.variants[prefer]) ??
    shot.variants[shot.mode] ??
    shot.variants.instant ??
    shot.variants.ai ??
    shot.sourceUrl
  );
}

export type Screen = "camera" | "processing" | "result" | "gallery";
