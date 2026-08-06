"use client";

import { useState } from "react";
import { CheckIcon, CloseIcon } from "./Chrome";
import { FOLDER_COLORS, Folder } from "@/lib/types";

/** Bottom sheet for naming a folder and picking its color — editing an
 *  existing one, or (with `folder` omitted) creating a new one. Same form
 *  either way, since a new folder's name and color aren't different in kind
 *  from an existing one's. */
export function FolderEditSheet({
  folder,
  onSave,
  onClose,
}: {
  folder?: Folder;
  onSave: (patch: { name: string; color: string | null }) => void | Promise<unknown>;
  onClose: () => void;
}) {
  const [name, setName] = useState(folder?.name ?? "");
  const [color, setColor] = useState<string | null>(folder?.color ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: trimmed, color });
      onClose();
    } catch {
      setError(
        folder
          ? "Could not save changes. Try again."
          : "Could not create the folder. Try again.",
      );
    } finally {
      setSaving(false);
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

      <form
        onSubmit={submit}
        className="relative rounded-t-xl bg-[var(--color-surface-container-low)] pb-[max(16px,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-outline-variant)] px-5 py-4">
          <h2 className="text-[15px] font-semibold">
            {folder ? "Edit folder" : "New folder"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-on-surface-variant)]"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div>
            <label className="type-viewfinder-label mb-2 block text-[var(--color-on-surface-variant)]">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              placeholder="e.g. Japan 2026"
              aria-label="Folder name"
              autoFocus
              className="type-body-md w-full rounded-md border border-[var(--color-outline-variant)] bg-transparent px-3 py-2.5 text-[var(--color-on-surface)] focus:border-[var(--color-on-surface)] focus:outline-none"
            />
          </div>

          <div>
            <label className="type-viewfinder-label mb-2 block text-[var(--color-on-surface-variant)]">
              Color
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setColor(null)}
                aria-label="Default color"
                aria-pressed={color === null}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]"
              >
                {color === null && <CheckIcon />}
              </button>
              {FOLDER_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  aria-label={`Color ${swatch}`}
                  aria-pressed={color === swatch}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                  style={{ backgroundColor: swatch }}
                >
                  {color === swatch && (
                    <span className="text-white">
                      <CheckIcon />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5">
          {error && (
            <p className="type-timestamp-sm mb-3 text-center text-[var(--color-error)]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="type-button-text w-full rounded-md bg-[var(--color-primary)] px-4 py-3 text-[var(--color-on-primary)] disabled:opacity-40"
          >
            {saving
              ? folder
                ? "Saving…"
                : "Creating…"
              : folder
                ? "Save"
                : "Create folder"}
          </button>
        </div>
      </form>
    </div>
  );
}
