"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PhotoCard } from "./PhotoCard";
import {
  DownloadIcon,
  PrimaryButton,
  RefreshIcon,
  SecondaryButton,
} from "./Chrome";
import { ThemeToggle } from "./ThemeToggle";
import { Shot } from "@/lib/types";
import { DevelopMode, developPhoto } from "@/lib/develop";
import { prepareDownload, saveBlob } from "@/lib/export";

const LABELS: Record<DevelopMode, string> = { instant: "fast", ai: "ai" };

export function ResultScreen({
  shot,
  onNewPhoto,
  onVariant,
}: {
  shot: Shot;
  onNewPhoto: () => void;
  /** Caches a newly produced variant back onto the shot. */
  onVariant: (id: string, mode: DevelopMode, image: string) => void;
}) {
  // Remounted per shot via a key prop, so no reset effect is needed.
  const [view, setView] = useState<DevelopMode>(shot.mode);
  const [buildError, setBuildError] = useState<string | null>(null);

  const image = shot.variants[view];
  // Guards against launching the same develop twice across re-renders.
  const inFlightRef = useRef<string | null>(null);

  // Produce the other variant on demand, from the same raw capture.
  useEffect(() => {
    if (image) return;
    const key = `${shot.id}:${view}`;
    if (inFlightRef.current === key) return;
    inFlightRef.current = key;

    let cancelled = false;

    developPhoto(shot.sourceUrl, view)
      .then((result) => {
        if (!cancelled) onVariant(shot.id, view, result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setBuildError(err instanceof Error ? err.message : "Develop failed.");
      });

    return () => {
      cancelled = true;
    };
  }, [view, image, shot.id, shot.sourceUrl, onVariant]);

  /* --- Download prep, keyed by what's on screen --- */
  const [entry, setEntry] = useState<{
    key: string;
    file?: { blob: Blob; filename: string };
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    const key = `${shot.id}:${view}`;

    prepareDownload(image, `${shot.id}-${view}`)
      .then((file) => {
        if (!cancelled) setEntry({ key, file });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setEntry({
          key,
          error:
            err instanceof Error ? err.message : "Could not prepare the photo.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [image, shot.id, view]);

  const ready = entry?.key === `${shot.id}:${view}` ? entry : null;
  const file = ready?.file ?? null;
  const saveError = ready?.error ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="grid grid-cols-[40px_1fr_40px] items-center px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2">
        <ThemeToggle />
        <h1 className="text-center text-[15px] font-semibold">
          AI Disposable Camera
        </h1>
        <span />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8">
        <div className="w-full max-w-[320px]">
          <PhotoCard lifted>
            {image ? (
              <Image
                src={image}
                alt={`Developed photo, ${LABELS[view]} pipeline`}
                fill
                unoptimized
                sizes="320px"
                className="object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center">
                <p className="type-viewfinder-label text-white/60">
                  {buildError
                    ? "failed"
                    : view === "ai"
                      ? "asking the ai…"
                      : "developing…"}
                </p>
              </div>
            )}
          </PhotoCard>
        </div>

        {/* Same capture, two pipelines — the only fair way to compare them. */}
        <div className="mt-5 flex items-center gap-1 rounded-md bg-[var(--color-surface-container)] p-1">
          {(["instant", "ai"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setView(m)}
              aria-pressed={view === m}
              className={`type-viewfinder-label rounded-sm px-4 py-2 transition-colors ${
                view === m
                  ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                  : "text-[var(--color-on-surface-variant)]"
              }`}
            >
              {LABELS[m]}
              {m === "ai" && !shot.variants.ai && " ·"}
            </button>
          ))}
        </div>

        <p className="type-viewfinder-label mt-2 h-4 text-center text-[var(--color-on-surface-variant)] opacity-60">
          {buildError ??
            (view === "ai" && !shot.variants.ai
              ? "tapping ai costs one generation"
              : "same shot, both pipelines")}
        </p>
      </div>

      <div className="space-y-3 px-6 pt-4 pb-5">
        {saveError && (
          <p className="type-timestamp-sm text-center text-[var(--color-error)]">
            {saveError}
          </p>
        )}
        <PrimaryButton
          onClick={() => file && saveBlob(file.blob, file.filename)}
          disabled={!file}
          icon={<DownloadIcon />}
        >
          {file ? "Save to Gallery" : "Preparing…"}
        </PrimaryButton>
        <SecondaryButton onClick={onNewPhoto} icon={<RefreshIcon />}>
          New Photo
        </SecondaryButton>
      </div>
    </div>
  );
}
