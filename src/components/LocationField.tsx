"use client";

import { useEffect, useRef, useState } from "react";
import { LOCATION_MAX_LENGTH, Shot } from "@/lib/types";
import {
  detectPlaceName,
  LocateError,
  locateErrorMessage,
} from "@/lib/geolocate";

/** A map pin, drawn to match the stroke weight of the icons in Chrome.tsx
 *  rather than importing an icon set for one glyph. */
function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M20 10c0 4.4-5.4 9.6-7.3 11.3a1 1 0 01-1.4 0C9.4 19.6 4 14.4 4 10a8 8 0 1116 0z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function CrosshairIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M22 12h-3M5 12H2" />
    </svg>
  );
}

/**
 * The location line on the back of a print: type a place, or let the browser
 * fill it in. Both write the same field — GPS is a shortcut for typing, not
 * a separate mode, which is why there's no toggle between them.
 *
 * Keyed by `shot.id` at the call site, like `MemoryField` — a fresh mount per
 * shot resets the draft instead of an effect syncing it after the fact.
 */
export function LocationField({
  shot,
  onUpdateLocation,
}: {
  shot: Shot;
  onUpdateLocation: (shotId: string, location: string | null) => void;
}) {
  const [draft, setDraft] = useState(shot.location ?? "");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // A lookup outliving the card it belongs to would set state on an unmounted
  // field, and leave a request running for a photo no longer on screen.
  useEffect(() => () => abortRef.current?.abort(), []);

  function commit(value: string) {
    const trimmed = value.trim();
    if (trimmed === (shot.location ?? "")) return;
    onUpdateLocation(shot.id, trimmed || null);
  }

  async function detect() {
    setLocating(true);
    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const name = await detectPlaceName(controller.signal);
      const value = name.slice(0, LOCATION_MAX_LENGTH);
      setDraft(value);
      // Commit straight away. The user pressed a button meaning "put my
      // location here", so waiting for a blur that may never come would
      // lose it — unlike typing, where blur is the natural commit point.
      commit(value);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(
        locateErrorMessage(err instanceof LocateError ? err.kind : "failed"),
      );
    } finally {
      if (!controller.signal.aborted) setLocating(false);
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-1.5">
        <PinIcon className="shrink-0 text-[var(--color-on-surface-variant)] opacity-60" />
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value.slice(0, LOCATION_MAX_LENGTH));
            if (error) setError(null);
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            // Enter commits without leaving the field — the card back has no
            // submit button, and blur is easy to miss on touch.
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          placeholder="Add a location"
          aria-label="Location"
          className="type-timestamp-sm min-w-0 flex-1 bg-transparent text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)] placeholder:opacity-60 focus:outline-none"
        />
        <button
          type="button"
          onClick={detect}
          disabled={locating}
          aria-label="Use my current location"
          title="Use my current location"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--color-on-surface-variant)] transition-colors hover:bg-[var(--color-surface-container-highest)] disabled:opacity-40"
        >
          {locating ? (
            <span
              className="block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
              aria-hidden="true"
            />
          ) : (
            <CrosshairIcon />
          )}
        </button>
      </div>
      {error && (
        <p
          role="status"
          className="type-timestamp-sm mt-1 pl-[18px] text-left text-[11px] leading-snug text-[var(--color-error)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
