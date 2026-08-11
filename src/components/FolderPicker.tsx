"use client";

import { useState } from "react";
import { Folder } from "@/lib/types";
import { CheckIcon, CloseIcon, FolderIcon, PlusIcon } from "./Chrome";

/** Bottom sheet for filing a photo. Also the only place folders get created. */
export function FolderPicker({
  folders,
  current,
  onPick,
  onCreate,
  onClose,
}: {
  folders: Folder[];
  current: string | null;
  onPick: (folderId: string | null) => void;
  onCreate: (name: string) => Promise<string>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setError(null);
    try {
      const id = await onCreate(trimmed);
      onPick(id);
      setName("");
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create the folder. Try again.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
      />

      <div className="relative max-h-[80dvh] overflow-y-auto rounded-t-xl bg-[var(--color-surface-container-low)] pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--color-outline-variant)] bg-[var(--color-surface-container-low)] px-5 py-4">
          <h2 className="text-[15px] font-semibold">Add to folder</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-on-surface-variant)]"
          >
            <CloseIcon />
          </button>
        </div>

        <ul className="px-3 py-2">
          <li>
            <button
              type="button"
              onClick={() => {
                onPick(null);
                onClose();
              }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-[var(--color-surface-container)]"
            >
              <span className="text-[var(--color-on-surface-variant)]">
                <FolderIcon />
              </span>
              <span className="type-body-md flex-1">Unsorted</span>
              {current === null && <CheckIcon />}
            </button>
          </li>

          {folders.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(f.id);
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-[var(--color-surface-container)]"
              >
                <span className="text-[var(--color-on-surface-variant)]">
                  <FolderIcon />
                </span>
                <span className="type-body-md flex-1 truncate">{f.name}</span>
                {current === f.id && <CheckIcon />}
              </button>
            </li>
          ))}
        </ul>

        <form
          onSubmit={submit}
          className="border-t border-[var(--color-outline-variant)] px-5 pt-4"
        >
          {/* Was tracked in state but never rendered, so a failed create
              looked like nothing happened at all. */}
          {error && (
            <p className="type-timestamp-sm mb-3 text-center text-[var(--color-error)]">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 40))}
            placeholder="New folder — e.g. Japan 2026"
            aria-label="New folder name"
            className="type-body-md min-w-0 flex-1 rounded-md border border-[var(--color-outline-variant)] bg-transparent px-3 py-2.5 text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] focus:border-[var(--color-on-surface)] focus:outline-none"
          />
          <button
            type="submit"
            /* `creating` was tracked but never used to gate the button, so a
               double-tap could fire two creates for the same name. */
            disabled={!name.trim() || creating}
            aria-label="Create folder"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[var(--color-primary)] text-[var(--color-on-primary)] disabled:opacity-40"
          >
            <PlusIcon />
          </button>
          </div>
        </form>
      </div>
    </div>
  );
}
