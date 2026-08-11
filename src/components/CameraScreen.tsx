"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useCamera } from "@/lib/useCamera";
import { ViewfinderHud } from "./ViewfinderHud";
import {
  ActionChip,
  FlashIcon,
  FlipIcon,
  IconButton,
  ShutterButton,
  TimerIcon,
} from "./Chrome";
import { UserButton } from "./UserButton";
import { Profile, Shot } from "@/lib/types";

/** Self-timer positions, cycled by tapping the chip. */
const TIMER_STEPS = [0, 3, 10] as const;

/** Digital zoom levels, tapped directly rather than cycled — matches how
 *  phone camera apps present them. */
const ZOOM_LEVELS = [1, 2, 3] as const;

export function CameraScreen({
  onCapture,
  lastShot,
  photoCount,
  folderCount,
  profile,
  onTogglePreset,
  capturing = false,
  captureError = null,
}: {
  onCapture: (dataUrl: string) => void;
  lastShot: Shot | null;
  photoCount: number;
  folderCount: number;
  profile: Profile | null;
  onTogglePreset: (enabled: boolean) => void;
  /** True for the brief moment between a shutter tap and the print landing
   *  on the result screen — grading is local and fast, so this is just
   *  enough to block a double-tap, not a "developing" wait. */
  capturing?: boolean;
  captureError?: string | null;
}) {
  const { videoRef, facing, flip, zoom, setZoom, capture, error, ready } = useCamera();
  const [flash, setFlash] = useState(false);
  const [flashing, setFlashing] = useState(false);
  // The front camera has no hardware flash, so "on" instead floods the
  // whole screen white for a moment before the shot — the same screen-as-
  // lightsource trick every phone camera app uses for a bright selfie.
  const [screenFlashing, setScreenFlashing] = useState(false);
  const [timerIndex, setTimerIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  // Mirrors `countdown` so the interval can branch on it without reading state
  // inside a setState updater — updaters must stay pure.
  const remainingRef = useRef<number | null>(null);

  const delay = TIMER_STEPS[timerIndex];

  const clearTimers = useCallback(() => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
    remainingRef.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const shoot = useCallback(async () => {
    const useScreenFlash = flash && facing === "user";
    if (useScreenFlash) {
      setScreenFlashing(true);
      // Long enough for the white screen to actually catch the face and
      // for the camera's exposure to settle before the frame is grabbed —
      // firing the capture immediately would beat the light there.
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    }

    const dataUrl = capture();

    if (useScreenFlash) setScreenFlashing(false);
    if (!dataUrl) return;
    // Rear camera's decorative in-frame flash — only when flash is actually
    // on, same as the front camera's screen flash above.
    if (flash && facing !== "user") {
      setFlashing(true);
      timeoutRef.current = window.setTimeout(() => setFlashing(false), 420);
    }
    onCapture(dataUrl);
  }, [capture, onCapture, flash, facing]);

  function handleShutter() {
    // Tapping mid-countdown aborts it, the way a real camera's cancel works.
    if (countdown !== null) {
      clearTimers();
      setCountdown(null);
      return;
    }

    if (delay === 0) {
      shoot();
      return;
    }

    remainingRef.current = delay;
    setCountdown(delay);

    intervalRef.current = window.setInterval(() => {
      const next = (remainingRef.current ?? 1) - 1;
      remainingRef.current = next;

      if (next <= 0) {
        clearTimers();
        setCountdown(null);
        shoot();
        return;
      }
      setCountdown(next);
    }, 1000);
  }

  const busy = !ready || !!error || capturing || screenFlashing;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Screen-as-flash for the front camera — the whole viewport, not just
          the preview box, so it actually throws light onto the user's face
          instead of just looking like a UI flourish. Stays mounted so the
          fade in and out both animate instead of snapping on unmount. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-50 bg-white transition-opacity duration-150 ease-out"
        style={{ opacity: screenFlashing ? 1 : 0 }}
      />
      {/* True centering (absolute, on the header's own width) only kicks in
          at `sm:` and up. On a phone-width header the icon cluster alone is
          ~170px — centering a logo big enough to read there means it
          overlaps the icons; there's no size where centered-and-big both
          fit under ~500px. Mobile falls back to normal flow instead:
          smaller, left of the icons, same as before. */}
      <header className="relative flex items-center gap-1 px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2">
        <h1 className="flex h-10 items-center sm:absolute sm:top-1/2 sm:left-1/2 sm:h-auto sm:-translate-x-1/2 sm:-translate-y-1/2">
          <Image
            src="/capture-memory-logo.png"
            alt="Capture Memory"
            width={1431}
            height={478}
            priority
            className="h-10 w-auto sm:h-16 sm:max-w-[42vw]"
          />
        </h1>
        {/* `ml-auto` rather than `justify-end` on the header — that way this
            still hugs the right edge whether `h1` is a flow sibling (mobile)
            or removed from flow entirely (sm+, once it goes absolute). */}
        <div className="ml-auto flex items-center gap-1">
          <ActionChip
            label="Self-timer"
            value={delay === 0 ? "off" : `${delay}s`}
            active={delay !== 0}
            onClick={() => {
              clearTimers();
              setCountdown(null);
              setTimerIndex((i) => (i + 1) % TIMER_STEPS.length);
            }}
          >
            <TimerIcon />
          </ActionChip>
          <IconButton
            label={flash ? "Flash on" : "Flash off"}
            onClick={() => setFlash((f) => !f)}
            active={flash}
          >
            <FlashIcon on={flash} />
          </IconButton>
          <UserButton
            photoCount={photoCount}
            folderCount={folderCount}
            profile={profile}
            onTogglePreset={onTogglePreset}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <div
          className="relative w-full max-w-sm overflow-hidden rounded-lg bg-black"
          style={{ aspectRatio: "4 / 5", boxShadow: "var(--shadow-film)" }}
        >
          {error ? (
            <div className="grid h-full place-items-center px-8 text-center">
              <p className="type-body-md text-white/80">{error}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="h-full w-full object-cover"
                style={{
                  transform: `scale(${facing === "user" ? -zoom : zoom}, ${zoom})`,
                  opacity: ready ? 1 : 0,
                  transition: "transform 200ms ease, opacity 300ms ease",
                }}
              />
              <ViewfinderHud />

              {countdown !== null && (
                <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/25">
                  <span
                    key={countdown}
                    className="type-timestamp-lg text-[104px] leading-none text-white tabular-nums"
                    style={{ textShadow: "0 2px 24px rgba(0,0,0,0.5)" }}
                  >
                    {countdown}
                  </span>
                </div>
              )}

              {flashing && (
                <div className="animate-shutter absolute inset-0 z-30 bg-white" />
              )}

              <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/40 p-1 backdrop-blur-sm">
                {ZOOM_LEVELS.map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoom(z)}
                    aria-label={`${z}x zoom`}
                    aria-pressed={zoom === z}
                    className={`type-viewfinder-label grid h-7 w-7 place-items-center rounded-full transition-colors ${
                      zoom === z
                        ? "bg-white text-black"
                        : "text-white/80 hover:text-white"
                    }`}
                  >
                    {z}x
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 items-center px-8 py-6">
        <div className="justify-self-start">
          {lastShot ? (
            <div
              className="h-12 w-12 overflow-hidden rounded-md"
              style={{ boxShadow: "var(--shadow-film)" }}
            >
              <Image
                src={lastShot.imageUrl}
                alt=""
                width={48}
                height={48}
                unoptimized
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="h-12 w-12 rounded-md border border-dashed border-[var(--color-outline-variant)]" />
          )}
        </div>

        <div className="justify-self-center">
          <ShutterButton onClick={handleShutter} disabled={busy} />
        </div>

        <div className="justify-self-end">
          <IconButton label="Flip camera" onClick={flip}>
            <FlipIcon />
          </IconButton>
        </div>
      </div>

      <p
        className={`type-viewfinder-label -mt-2 pb-2 text-center opacity-60 ${
          captureError
            ? "text-[var(--color-error)]"
            : "text-[var(--color-on-surface-variant)]"
        }`}
      >
        {captureError
          ? captureError
          : countdown !== null
            ? "tap shutter to cancel"
            : " "}
      </p>
    </div>
  );
}
