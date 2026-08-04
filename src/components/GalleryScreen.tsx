"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { PhotoCard } from "./PhotoCard";
import { UserButton } from "./UserButton";
import { ChevronLeftIcon, FolderIcon } from "./Chrome";
import { AccountSummary, Folder, Shot, dayLabel } from "@/lib/types";

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
  onSelect: (shot: Shot) => void;
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
          <div className="grid grid-cols-2 gap-5">
            {group.map((shot) => (
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
                    src={shot.imageUrl}
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
  account,
}: {
  shots: Shot[];
  folders: Folder[];
  onSelect: (shot: Shot) => void;
  account: AccountSummary;
}) {
  const [tab, setTab] = useState<"all" | "folders">("all");
  const [openFolder, setOpenFolder] = useState<string | null>(null);

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

  const unsorted = useMemo(() => shots.filter((s) => !s.folderId), [shots]);
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
          <h1 className="truncate text-center text-[17px] font-semibold">
            {active.name}
          </h1>
          <span />
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
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="grid grid-cols-[40px_1fr_40px] items-center px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2">
        <span />
        <h1 className="text-center text-[17px] font-semibold">Gallery</h1>
        <UserButton account={account} />
      </header>

      <div className="flex justify-center px-6 pt-1 pb-3">
        <div className="flex items-center gap-1 rounded-md bg-[var(--color-surface-container)] p-1">
          {(
            [
              ["all", "all photos"],
              ["folders", "folders"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={`type-viewfinder-label rounded-sm px-4 py-2 transition-colors ${
                tab === id
                  ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                  : "text-[var(--color-on-surface-variant)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="type-viewfinder-label px-6 pb-4 text-center leading-4 text-[var(--color-on-surface-variant)] opacity-70">
        Saved to your account. Sign in anywhere to find them again.
      </p>

      {tab === "all" ? (
        shots.length === 0 ? (
          <Empty>No photos yet. Take a shot and let it develop.</Empty>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            <PhotoGrid shots={shots} onSelect={onSelect} />
          </div>
        )
      ) : folders.length === 0 && unsorted.length === 0 ? (
        <Empty>
          No folders yet. Open a photo and add it to a folder to start one.
        </Empty>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <ul className="space-y-2">
            {folders.map((folder) => {
              const inside = byFolder.get(folder.id) ?? [];
              const cover = [...inside].sort(
                (a, b) => b.createdAt - a.createdAt,
              )[0];
              return (
                <li key={folder.id}>
                  <button
                    type="button"
                    onClick={() => setOpenFolder(folder.id)}
                    className="flex w-full items-center gap-4 rounded-md p-2 text-left transition-colors hover:bg-[var(--color-surface-container)]"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-[var(--color-surface-container-high)]">
                      {cover ? (
                        <Image
                          src={cover.imageUrl}
                          alt=""
                          width={56}
                          height={56}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="grid h-full place-items-center text-[var(--color-outline)]">
                          <FolderIcon />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="type-body-md truncate">{folder.name}</p>
                      <p className="type-viewfinder-label mt-0.5 text-[var(--color-on-surface-variant)]">
                        {inside.length}{" "}
                        {inside.length === 1 ? "photo" : "photos"}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}

            {unsorted.length > 0 && (
              <li className="pt-2">
                <p className="type-viewfinder-label px-2 pb-2 text-[var(--color-on-surface-variant)] opacity-70">
                  unsorted · {unsorted.length}
                </p>
                <div className="px-2">
                  <PhotoGrid shots={unsorted} onSelect={onSelect} />
                </div>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
