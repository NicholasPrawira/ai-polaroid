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
import { UserButton } from "./UserButton";
import { FolderPicker } from "./FolderPicker";
import { FolderIcon } from "./Chrome";
import { Folder, Shot } from "@/lib/types";
import { prepareDownload, saveBlob } from "@/lib/export";

export function ResultScreen({
  shot,
  folders,
  onNewPhoto,
  onFile,
  onCreateFolder,
  photoCount,
  folderCount,
}: {
  shot: Shot;
  folders: Folder[];
  onNewPhoto: () => void;
  onFile: (shotId: string, folderId: string | null) => void;
  onCreateFolder: (name: string) => string;
  photoCount: number;
  folderCount: number;
}) {
  const [picking, setPicking] = useState(false);
  const folder = folders.find((f) => f.id === shot.folderId) ?? null;
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
        <span />
        <h1 className="text-center text-[15px] font-semibold">
          AI Disposable Camera
        </h1>
        <UserButton photoCount={photoCount} folderCount={folderCount} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8">
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

        <button
          type="button"
          onClick={() => setPicking(true)}
          className="type-viewfinder-label mt-5 flex items-center gap-2 rounded-md border border-[var(--color-outline-variant)] px-3.5 py-2.5 text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container)]"
        >
          <FolderIcon />
          <span className="max-w-[16ch] truncate">
            {folder ? folder.name : "add to folder"}
          </span>
        </button>
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

      {picking && (
        <FolderPicker
          folders={folders}
          current={shot.folderId}
          onPick={(folderId) => onFile(shot.id, folderId)}
          onCreate={onCreateFolder}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
