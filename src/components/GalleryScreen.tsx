"use client";

import Image from "next/image";
import { PhotoCard } from "./PhotoCard";
import { ThemeToggle } from "./ThemeToggle";
import { Shot, displayUrl } from "@/lib/types";

/** Deterministic tilt so a photo doesn't jump around between renders. */
function tilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h % 400) / 100 - 2; // -2deg … +2deg
}

export function GalleryScreen({
  shots,
  onSelect,
}: {
  shots: Shot[];
  onSelect: (shot: Shot) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="grid grid-cols-[40px_1fr_40px] items-center px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2">
        <ThemeToggle />
        <h1 className="text-center text-[17px] font-semibold">Gallery</h1>
        <span />
      </header>

      <p className="type-viewfinder-label px-6 pb-4 text-center leading-4 text-[var(--color-on-surface-variant)] opacity-70">
        This session only — nothing is stored. Save a photo to keep it.
      </p>

      {shots.length === 0 ? (
        <div className="grid flex-1 place-items-center px-10 text-center">
          <p className="type-body-md text-[var(--color-on-surface-variant)]">
            No photos yet. Take a shot and let it develop.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <div className="grid grid-cols-2 gap-5">
            {shots.map((shot) => (
              <button
                key={shot.id}
                type="button"
                onClick={() => onSelect(shot)}
                aria-label="Open photo"
                className="text-left transition-transform active:scale-[0.97]"
                style={{ transform: `rotate(${tilt(shot.id)}deg)` }}
              >
                <PhotoCard radius="md">
                  <Image
                    src={displayUrl(shot)}
                    alt="Photo"
                    fill
                    unoptimized
                    sizes="150px"
                    className="object-cover"
                  />
                </PhotoCard>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
