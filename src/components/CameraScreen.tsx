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
import { Shot } from "@/lib/types";

/** Self-timer positions, cycled by tapping the chip. */
const TIMER_STEPS = [0, 3, 10] as const;

export function CameraScreen({
  onCapture,
  lastShot,
  photoCount,
  folderCount,
}: {
  onCapture: (dataUrl: string) => void;
  lastShot: Shot | null;
  photoCount: number;
  folderCount: number;
}) {
  const { videoRef, facing, flip, capture, error, ready } = useCamera();
  const [flash, setFlash] = useState(false);
  const [flashing, setFlashing] = useState(false);
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

  const shoot = useCallback(() => {
    const dataUrl = capture();
    if (!dataUrl) return;
    setFlashing(true);
    timeoutRef.current = window.setTimeout(() => setFlashing(false), 420);
    onCapture(dataUrl);
  }, [capture, onCapture]);

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

  const busy = !ready || !!error;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="grid grid-cols-[8px_1fr_auto] items-center px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2">
        <span />
        <h1 className="min-w-0 truncate text-center text-[15px] font-semibold">
          AI Disposable Camera
        </h1>
        <div className="flex items-center gap-1">
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
          <UserButton photoCount={photoCount} folderCount={folderCount} />
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
                  transform: facing === "user" ? "scaleX(-1)" : undefined,
                  opacity: ready ? 1 : 0,
                  transition: "opacity 300ms ease",
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

      <p className="type-viewfinder-label -mt-2 pb-2 text-center text-[var(--color-on-surface-variant)] opacity-60">
        {countdown !== null ? "tap shutter to cancel" : " "}
      </p>
    </div>
  );
}
