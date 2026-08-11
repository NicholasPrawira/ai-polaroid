"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PhotoCard } from "./PhotoCard";
import {
  ChevronLeftIcon,
  CloseIcon,
  DownloadIcon,
  RefreshIcon,
  SecondaryButton,
  TrashIcon,
} from "./Chrome";
import { UserButton } from "./UserButton";
import { FolderPicker } from "./FolderPicker";
import { FolderIcon } from "./Chrome";
import { VoiceNote } from "./VoiceNote";
import { Folder, Profile, Shot } from "@/lib/types";
import { prepareDownload, saveBlob } from "@/lib/export";

/** Keyed by `shot.id` at the call site — a fresh mount per shot is what
 *  resets the draft, rather than an effect syncing it after the fact. */
function MemoryField({
  shot,
  onUpdateCaption,
}: {
  shot: Shot;
  onUpdateCaption: (shotId: string, caption: string | null) => void;
}) {
  const [draft, setDraft] = useState(shot.caption ?? "");

  function commit() {
    const trimmed = draft.trim();
    if (trimmed === (shot.caption ?? "")) return;
    onUpdateCaption(shot.id, trimmed || null);
  }

  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value.slice(0, 500))}
      onBlur={commit}
      placeholder="What's the story behind this one?"
      rows={5}
      className="type-body-md w-full resize-none rounded-md bg-transparent text-center text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)] focus:outline-none"
    />
  );
}

const FLIP_DRAG_THRESHOLD = 40;

/**
 * The photo is a card with two sides, like a real print you'd write on the
 * back of: front is the image, back is that photo's memory. A swipe on the
 * card flips it — it doesn't page to a different photo.
 */
export function ResultScreen({
  shot,
  folders,
  onNewPhoto,
  onClose,
  onFile,
  onCreateFolder,
  onUpdateCaption,
  onRecordVoice,
  onDeleteVoice,
  onDelete,
  photoCount,
  folderCount,
  profile,
  onTogglePreset,
  initialFlipped = false,
}: {
  shot: Shot;
  folders: Folder[];
  /** Reveal mode only (a single shot just off the camera). */
  onNewPhoto: () => void;
  /** Browse mode only (opened from the gallery) — presence switches the
   *  header to a back chevron instead of leaving the "New Photo" slot. */
  onClose?: () => void;
  onFile: (shotId: string, folderId: string | null) => void;
  onCreateFolder: (name: string) => Promise<string>;
  onUpdateCaption: (shotId: string, caption: string | null) => void;
  onRecordVoice: (shotId: string, blob: Blob) => Promise<void>;
  onDeleteVoice: (shot: Shot) => Promise<void>;
  onDelete: (shot: Shot) => Promise<void>;
  photoCount: number;
  folderCount: number;
  profile: Profile | null;
  onTogglePreset: (enabled: boolean) => void;
  /** Set when opened via the grid's swipe-to-flip gesture — the tile there
   *  already flipped once, so this opens straight to the memory side and
   *  grows in rather than just appearing, continuing that motion instead of
   *  playing an unrelated second animation. */
  initialFlipped?: boolean;
}) {
  const folder = folders.find((f) => f.id === shot.folderId) ?? null;
  const [picking, setPicking] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(initialFlipped);
  const [grown, setGrown] = useState(!initialFlipped);
  const dragRef = useRef<{ x: number; y: number; committed: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (!initialFlipped) return;
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, [initialFlipped]);

  // A fresh flip state per shot — otherwise leaving one photo flipped over
  // and opening the next would show its memory before its face.
  const [flipShotId, setFlipShotId] = useState(shot.id);
  if (flipShotId !== shot.id) {
    setFlipShotId(shot.id);
    if (flipped) setFlipped(false);
  }

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

  function onPointerDown(e: React.PointerEvent) {
    dragRef.current = { x: e.clientX, y: e.clientY, committed: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;

    if (!drag.committed) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        dragRef.current = null;
        return;
      }
      drag.committed = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }

  function endDrag(e: React.PointerEvent) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag?.committed) return;
    if (Math.abs(e.clientX - drag.x) > FLIP_DRAG_THRESHOLD) {
      setFlipped((f) => !f);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(shot);
      // No onClose()/onNewPhoto() here — the parent already navigates away
      // once its own state no longer has this shot to show.
    } catch {
      setDeleting(false);
      setDeleteError("Could not delete this photo. Try again.");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="grid grid-cols-[40px_1fr_40px] items-center px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="grid h-10 w-10 place-items-center rounded-md text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container)]"
          >
            <ChevronLeftIcon />
          </button>
        ) : (
          <span />
        )}
        <h1 className="flex min-w-0 justify-center">
          <Image
            src="/capture-memory-logo.png"
            alt="Capture Memory"
            width={1431}
            height={478}
            className="h-14 w-auto"
          />
        </h1>
        <UserButton
          photoCount={photoCount}
          folderCount={folderCount}
          profile={profile}
          onTogglePreset={onTogglePreset}
        />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8">
        <div
          className="w-full max-w-[320px] cursor-grab active:cursor-grabbing"
          style={{
            perspective: 1200,
            transform: grown ? "scale(1)" : "scale(0.72)",
            opacity: grown ? 1 : 0,
            transition:
              "transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 220ms ease",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            className="relative"
            style={{
              transformStyle: "preserve-3d",
              transform: `rotateY(${flipped ? 180 : 0}deg)`,
              transition: "transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {/* Front */}
            <div style={{ backfaceVisibility: "hidden" }}>
              <PhotoCard lifted>
                <Image
                  src={shot.imageUrl}
                  alt="Developed photo"
                  fill
                  unoptimized
                  draggable={false}
                  sizes="320px"
                  className="object-cover"
                />
              </PhotoCard>
            </div>

            {/* Back — pre-rotated so it reads right-way-round once the card
                as a whole has turned all the way over. */}
            <div
              className="absolute inset-0"
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            >
              <div
                className="relative aspect-square w-full overflow-hidden rounded-lg bg-[var(--color-surface-container-high)]"
                style={{ boxShadow: "var(--shadow-film-lifted)" }}
              >
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6">
                  <div className="flex w-full items-center justify-between gap-2">
                    <p className="type-viewfinder-label text-[var(--color-on-surface-variant)] opacity-70">
                      Memory
                    </p>
                    <VoiceNote
                      voiceUrl={shot.voiceUrl}
                      onRecord={(blob) => onRecordVoice(shot.id, blob)}
                      onDelete={() => onDeleteVoice(shot)}
                    />
                  </div>
                  <MemoryField shot={shot} onUpdateCaption={onUpdateCaption} />
                </div>

                {/* Stamped like the date print on a real disposable-camera
                    back — mono type, tucked in the corner, not part of the
                    editable note. */}
                <p className="type-timestamp-sm absolute right-4 bottom-4 text-[var(--color-on-surface-variant)] opacity-50">
                  {new Date(shot.createdAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="type-viewfinder-label mt-3 text-[var(--color-on-surface-variant)] opacity-50">
          swipe the photo to flip it over
        </p>

        <button
          type="button"
          onClick={() => setPicking(true)}
          className="type-viewfinder-label mt-4 flex items-center gap-2 rounded-md border border-[var(--color-outline-variant)] px-3.5 py-2.5 text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container)]"
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
        <div className="flex justify-center">
          <div className="inline-flex items-stretch overflow-hidden rounded-[10px] bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-sm">
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label="Delete photo"
              className="flex items-center justify-center px-4 transition-opacity active:opacity-60"
            >
              <TrashIcon />
            </button>
            <span
              aria-hidden
              className="my-2 w-px self-stretch bg-[var(--color-on-primary)] opacity-15"
            />
            <button
              type="button"
              onClick={() => file && saveBlob(file.blob, file.filename)}
              disabled={!file}
              className="type-button-text flex items-center gap-2 px-5 py-3 transition-opacity active:opacity-60 disabled:opacity-50"
            >
              <DownloadIcon />
              {file ? "Save to Gallery" : "Preparing…"}
            </button>
          </div>
        </div>
        {!onClose && (
          <SecondaryButton onClick={onNewPhoto} icon={<RefreshIcon />}>
            New Photo
          </SecondaryButton>
        )}
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

      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => !deleting && setConfirmingDelete(false)}
            className="absolute inset-0 bg-black/45"
          />
          <div className="relative rounded-t-xl bg-[var(--color-surface-container-low)] pb-[max(16px,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between border-b border-[var(--color-outline-variant)] px-5 py-4">
              <h2 className="text-[15px] font-semibold">Delete photo</h2>
              <button
                type="button"
                onClick={() => !deleting && setConfirmingDelete(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-on-surface-variant)]"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="space-y-2 px-5 py-5">
              {deleteError && (
                <p className="type-timestamp-sm text-[var(--color-error)]">
                  {deleteError}
                </p>
              )}
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="type-button-text w-full rounded-md bg-[var(--color-primary)] px-4 py-3 text-[var(--color-on-primary)] disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete photo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
