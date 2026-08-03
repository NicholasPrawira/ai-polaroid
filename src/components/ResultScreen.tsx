"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { PolaroidFrame } from "./PolaroidFrame";
import {
  DownloadIcon,
  PrimaryButton,
  RefreshIcon,
  SecondaryButton,
} from "./Chrome";
import { ThemeToggle } from "./ThemeToggle";
import { Shot } from "@/lib/types";
import { composeExport, filenameFor, saveBlob } from "@/lib/export";

export function ResultScreen({
  shot,
  onNewPhoto,
}: {
  shot: Shot;
  onNewPhoto: () => void;
}) {
  // Composed up front, not on click. Safari revokes the user-activation flag
  // across an await, which blocks both the share sheet and the download — so
  // the save handler has to be able to run synchronously.
  // Keyed by shot id so switching prints invalidates the previous result
  // without needing a synchronous reset inside the effect.
  const [entry, setEntry] = useState<{
    id: string;
    blob?: Blob;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    composeExport(shot)
      .then((blob) => {
        if (!cancelled) setEntry({ id: shot.id, blob });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setEntry({
          id: shot.id,
          error:
            err instanceof Error ? err.message : "Could not prepare the print.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [shot]);

  const ready = entry?.id === shot.id ? entry : null;
  const blob = ready?.blob ?? null;
  const error = ready?.error ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="grid grid-cols-[40px_1fr_40px] items-center px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2">
        <ThemeToggle />
        <h1 className="text-center text-[17px] font-semibold">AI Polaroid</h1>
        <span />
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-8">
        <div className="w-full max-w-[300px]">
          <PolaroidFrame lifted>
            <Image
              src={shot.imageUrl}
              alt="Developed polaroid"
              fill
              unoptimized
              sizes="300px"
              className="object-cover"
            />
          </PolaroidFrame>
        </div>
      </div>

      <div className="space-y-3 px-6 pb-5">
        {error && (
          <p className="type-timestamp-sm text-center text-[var(--color-error)]">
            {error}
          </p>
        )}
        <PrimaryButton
          onClick={() => blob && saveBlob(blob, filenameFor(shot))}
          disabled={!blob}
          icon={<DownloadIcon />}
        >
          {blob ? "Save to Gallery" : "Preparing…"}
        </PrimaryButton>
        <SecondaryButton onClick={onNewPhoto} icon={<RefreshIcon />}>
          New Photo
        </SecondaryButton>
      </div>
    </div>
  );
}
