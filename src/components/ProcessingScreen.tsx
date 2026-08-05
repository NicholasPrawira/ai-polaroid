"use client";

import Image from "next/image";
import { PhotoCard } from "./PhotoCard";
import { CloseIcon, HourglassIcon } from "./Chrome";

/**
 * The darkroom. The only dark screen in the app, bracketed by two light ones,
 * so the wait reads as a deliberate stage rather than dead time.
 */
export function ProcessingScreen({
  source,
  progress,
  error,
  onCancel,
  onRetry,
}: {
  source: string;
  progress: number;
  error: string | null;
  onCancel: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[var(--color-darkroom)] text-[var(--color-on-darkroom)]">
      <header className="flex items-center justify-between px-4 pt-[max(10px,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={onCancel}
          className="type-button-text flex items-center gap-1.5 rounded-md px-2 py-2 opacity-90"
        >
          <CloseIcon />
          Cancel
        </button>
        <span className="type-viewfinder-label flex items-center gap-1.5 opacity-60">
          <HourglassIcon />
          {error ? "Failed" : "Processing…"}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-10">
        <div className="w-full max-w-[300px]">
          <PhotoCard lifted>
            <Image
              src={source}
              alt=""
              fill
              unoptimized
              sizes="300px"
              className="object-cover"
            />
            {/* Slow fade from black up to the photo — no blur/scale gimmick,
                just the image opening up as progress advances. */}
            <div
              className="absolute inset-0 bg-black"
              style={{ opacity: 1 - progress }}
            />
          </PhotoCard>
        </div>

        <div className="mt-8 text-center">
          {error ? (
            <p className="type-timestamp-sm text-[var(--color-error)]">
              {error}
            </p>
          ) : (
            <p className="type-headline-lg">Developing…</p>
          )}
        </div>
      </div>

      <div className="px-10 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="mb-5 h-px w-full bg-white/15" />
        {error ? (
          <button
            type="button"
            onClick={onRetry}
            className="type-button-text w-full rounded-md border border-white/25 px-4 py-3.5"
          >
            Try again
          </button>
        ) : (
          <p className="type-viewfinder-label mx-auto max-w-[34ch] text-center leading-4 opacity-45">
            Please wait while the AI develops the film. Do not close the
            application.
          </p>
        )}
      </div>
    </div>
  );
}
