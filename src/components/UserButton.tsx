"use client";

import { useState } from "react";
import { CloseIcon, MoonIcon, SunIcon, UserIcon } from "./Chrome";
import { useTheme } from "@/lib/useTheme";

/**
 * Account entry point. There are no accounts yet, so the sheet is honest about
 * that rather than presenting a sign-in that goes nowhere. Settings live here
 * too, which keeps the camera header down to camera controls.
 */
export function UserButton({
  photoCount,
  folderCount,
}: {
  photoCount: number;
  folderCount: number;
}) {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Account and settings"
        className="grid h-10 w-10 place-items-center rounded-full border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container)]"
      >
        <UserIcon />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/45"
          />

          <div className="relative rounded-t-xl bg-[var(--color-surface-container-low)] pb-[max(16px,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between border-b border-[var(--color-outline-variant)] px-5 py-4">
              <h2 className="text-[15px] font-semibold">Account</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-on-surface-variant)]"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex items-center gap-4 px-5 py-5">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)]">
                <UserIcon />
              </span>
              <div className="min-w-0">
                <p className="type-body-md">Not signed in</p>
                <p className="type-viewfinder-label mt-1 text-[var(--color-on-surface-variant)]">
                  photos live on this device only
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 px-5 pb-5">
              {[
                ["photos", photoCount],
                ["folders", folderCount],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-md bg-[var(--color-surface-container)] px-4 py-3"
                >
                  <dt className="type-viewfinder-label text-[var(--color-on-surface-variant)]">
                    {label}
                  </dt>
                  <dd className="type-headline-lg mt-0.5">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="border-t border-[var(--color-outline-variant)] px-3 py-2">
              <button
                type="button"
                onClick={toggle}
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-[var(--color-surface-container)]"
              >
                <span className="text-[var(--color-on-surface-variant)]">
                  {theme === "dark" ? <SunIcon /> : <MoonIcon />}
                </span>
                <span className="type-body-md flex-1">
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </span>
              </button>
            </div>

            <p className="type-viewfinder-label px-5 pt-3 leading-4 text-[var(--color-on-surface-variant)] opacity-60">
              Nothing is stored yet — refreshing clears every photo and folder.
              Accounts are not built.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
