"use client";

import { useEffect, useState } from "react";
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
import { prepareDownload, saveBlob } from "@/lib/export";

export function ResultScreen({
  shot,
  onNewPhoto,
}: {
  shot: Shot;
  onNewPhoto: () => void;
}) {
  // Prepared up front, not on click. Safari revokes the user-activation flag
  // across an await, which blocks both the share sheet and the download — so
  // the save handler has to be able to run synchronously.
  // Keyed by shot id so switching photos invalidates the previous result.
  const [entry, setEntry] = useState<{
    id: string;
    file?: { blob: Blob; filename: string };
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    prepareDownload(shot)
      .then((file) => {
        if (!cancelled) setEntry({ id: shot.id, file });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setEntry({
          id: shot.id,
          error:
            err instanceof Error ? err.message : "Could not prepare the photo.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [shot]);

  const ready = entry?.id === shot.id ? entry : null;
  const file = ready?.file ?? null;
  const error = ready?.error ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="grid grid-cols-[40px_1fr_40px] items-center px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2">
        <ThemeToggle />
        <h1 className="text-center text-[15px] font-semibold">
          AI Disposable Camera
        </h1>
        <span />
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-8">
        <div className="w-full max-w-[320px]">
          <PhotoCard lifted>
            <Image
              src={shot.imageUrl}
              alt="Developed photo"
              fill
              unoptimized
              sizes="320px"
              className="object-cover"
            />
          </PhotoCard>
        </div>
      </div>

      <div className="space-y-3 px-6 pb-5">
        {error && (
          <p className="type-timestamp-sm text-center text-[var(--color-error)]">
            {error}
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
