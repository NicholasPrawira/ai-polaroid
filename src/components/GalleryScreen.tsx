"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { UserButton } from "./UserButton";
import { AnimatedFolderCard } from "./AnimatedFolderCard";
import { FolderEditSheet } from "./FolderEditSheet";
import { PhotoTile } from "./PhotoTile";
import { ChevronLeftIcon, EditIcon, PlusIcon, UploadIcon } from "./Chrome";
import { Folder, Profile, Shot, dayLabel } from "@/lib/types";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

const GALLERY_TABS = [
  ["all", "all photos"],
  ["folders", "folders"],
] as const;

/** Segmented control with a pill that slides to the active tab instead of
 *  each button just swapping its own background — measured via refs rather
 *  than a fixed percentage, since the two labels aren't the same width. */
function GalleryTabs({
  tab,
  onChange,
}: {
  tab: "all" | "folders";
  onChange: (tab: "all" | "folders") => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Partial<Record<string, HTMLButtonElement>>>({});
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const button = buttonRefs.current[tab];
    if (!container || !button) return;
    const containerRect = container.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    setIndicator({
      left: buttonRect.left - containerRect.left,
      width: buttonRect.width,
    });
  }, [tab]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-1 rounded-md bg-[var(--color-surface-container)] p-1"
    >
      {indicator && (
        <div
          className="absolute top-1 bottom-1 rounded-sm bg-[var(--color-primary)] transition-[left,width] duration-300 ease-out"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}
      {GALLERY_TABS.map(([id, label]) => (
        <button
          key={id}
          ref={(el) => {
            if (el) buttonRefs.current[id] = el;
          }}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={tab === id}
          className={`type-viewfinder-label relative z-10 rounded-sm px-4 py-2 transition-colors duration-300 ${
            tab === id
              ? "text-[var(--color-on-primary)]"
              : "text-[var(--color-on-surface-variant)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Deterministic tilt so a photo doesn't jump around between renders. */
function tilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h % 400) / 100 - 2; // -2deg … +2deg
}

function PhotoGrid({
  shots,
  onSelect,
}: {
  shots: Shot[];
  onSelect: (shot: Shot, opts?: { flipped?: boolean }) => void;
}) {
  // Newest first, split into days so the roll reads as a history.
  const days = useMemo(() => {
    const groups = new Map<string, Shot[]>();
    for (const shot of [...shots].sort((a, b) => b.createdAt - a.createdAt)) {
      const key = dayLabel(shot.createdAt);
      const list = groups.get(key);
      if (list) list.push(shot);
      else groups.set(key, [shot]);
    }
    return [...groups];
  }, [shots]);

  return (
    <div className="space-y-6">
      {days.map(([label, group]) => (
        <section key={label}>
          <h3 className="type-viewfinder-label mb-3 text-[var(--color-on-surface-variant)]">
            {label}
          </h3>
          {/* The app has no max-width wrapper, so on a wide desktop window
              a fixed 2-column grid blows each tile up huge and buries the
              day groupings under a couple of giant photos. More, smaller
              columns as the viewport grows keeps a day's worth of shots
              readable at a glance instead of a scroll. */}
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {group.map((shot) => (
              <PhotoTile
                key={shot.id}
                shot={shot}
                tiltDeg={tilt(shot.id)}
                onOpen={(opts) => onSelect(shot, opts)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid flex-1 place-items-center px-10 text-center">
      <p className="type-body-md text-[var(--color-on-surface-variant)]">
        {children}
      </p>
    </div>
  );
}

export function GalleryScreen({
  shots,
  folders,
  onSelect,
  photoCount,
  folderCount,
  profile,
  onTogglePreset,
  onUpdateFolder,
  onCreateFolder,
  onUpload,
}: {
  shots: Shot[];
  folders: Folder[];
  onSelect: (shot: Shot, opts?: { flipped?: boolean }) => void;
  photoCount: number;
  folderCount: number;
  profile: Profile | null;
  onTogglePreset: (enabled: boolean) => void;
  onUpdateFolder: (
    folderId: string,
    patch: { name: string; color: string | null },
  ) => void;
  onCreateFolder: (name: string, color: string | null) => Promise<string>;
  /** Runs an uploaded photo through the same develop pipeline as a camera
   *  capture, so it comes back with the disposable-camera look. */
  onUpload: (dataUrl: string) => void;
}) {
  const [tab, setTab] = useState<"all" | "folders">("all");
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [editingActive, setEditingActive] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;
    setUploadError(null);
    try {
      const dataUrl = await readAsDataUrl(file);
      onUpload(dataUrl);
    } catch {
      setUploadError("Couldn't read that photo. Try a different file.");
    }
  }

  const byFolder = useMemo(() => {
    const map = new Map<string, Shot[]>();
    for (const shot of shots) {
      if (!shot.folderId) continue;
      const list = map.get(shot.folderId);
      if (list) list.push(shot);
      else map.set(shot.folderId, [shot]);
    }
    return map;
  }, [shots]);

  const active = folders.find((f) => f.id === openFolder) ?? null;

  /* --- Inside a folder --- */
  if (active) {
    const inside = byFolder.get(active.id) ?? [];
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="grid grid-cols-[40px_1fr_40px] items-center px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2">
          <button
            type="button"
            onClick={() => setOpenFolder(null)}
            aria-label="Back to folders"
            className="grid h-10 w-10 place-items-center rounded-md text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container)]"
          >
            <ChevronLeftIcon />
          </button>
          <h1 className="min-w-0 truncate text-center text-[17px] font-semibold">
            {active.name}
          </h1>
          <button
            type="button"
            onClick={() => setEditingActive(true)}
            aria-label="Edit folder"
            className="grid h-10 w-10 place-items-center rounded-md text-[var(--color-on-surface-variant)] transition-colors hover:bg-[var(--color-surface-container)] hover:text-[var(--color-on-surface)]"
          >
            <EditIcon />
          </button>
        </header>

        <p className="type-viewfinder-label px-6 pb-4 text-center text-[var(--color-on-surface-variant)] opacity-70">
          {inside.length} {inside.length === 1 ? "photo" : "photos"}
        </p>

        {inside.length === 0 ? (
          <Empty>
            Nothing filed here yet. Open a photo and add it to this folder.
          </Empty>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <PhotoGrid shots={inside} onSelect={onSelect} />
          </div>
        )}

        {editingActive && (
          <FolderEditSheet
            folder={active}
            onSave={(patch) => onUpdateFolder(active.id, patch)}
            onClose={() => setEditingActive(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="grid grid-cols-[40px_1fr_40px] items-center px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload a photo"
          className="grid h-10 w-10 place-items-center rounded-md text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container)]"
        >
          <UploadIcon />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChosen}
          className="hidden"
        />
        <h1 className="min-w-0 truncate text-center text-[17px] font-semibold">Gallery</h1>
        <UserButton
          photoCount={photoCount}
          folderCount={folderCount}
          profile={profile}
          onTogglePreset={onTogglePreset}
        />
      </header>

      {uploadError && (
        <p className="type-timestamp-sm px-6 pb-2 text-center text-[var(--color-error)]">
          {uploadError}
        </p>
      )}

      <div className="flex justify-center px-6 pt-1 pb-3">
        <GalleryTabs tab={tab} onChange={setTab} />
      </div>

      {tab === "all" ? (
        shots.length === 0 ? (
          <Empty>
            No photos yet. Take a shot and let it develop, or upload one from
            your device.
          </Empty>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <PhotoGrid shots={shots} onSelect={onSelect} />
          </div>
        )
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-6">
          <button
            type="button"
            onClick={() => setCreatingFolder(true)}
            className="type-viewfinder-label mb-4 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-[var(--color-outline-variant)] px-3.5 py-3 text-[var(--color-on-surface-variant)] transition-colors hover:bg-[var(--color-surface-container)] hover:text-[var(--color-on-surface)]"
          >
            <PlusIcon />
            New folder
          </button>

          {folders.length === 0 ? (
            <p className="type-body-md pt-6 text-center text-[var(--color-on-surface-variant)]">
              No folders yet — start one above, or file a photo into one from
              its own screen.
            </p>
          ) : (
            <div className="grid grid-cols-2">
              {folders.map((folder) => {
                const inside = [...(byFolder.get(folder.id) ?? [])].sort(
                  (a, b) => b.createdAt - a.createdAt,
                );
                return (
                  <AnimatedFolderCard
                    key={folder.id}
                    folder={folder}
                    preview={inside.slice(0, 3)}
                    count={inside.length}
                    onOpen={() => setOpenFolder(folder.id)}
                    onSelectShot={onSelect}
                    onUpdateFolder={(patch) =>
                      onUpdateFolder(folder.id, patch)
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {creatingFolder && (
        <FolderEditSheet
          onSave={(patch) => onCreateFolder(patch.name, patch.color)}
          onClose={() => setCreatingFolder(false)}
        />
      )}
    </div>
  );
}
