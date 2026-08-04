"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DevelopMode, developPhoto } from "./develop";

export type { DevelopMode };

/**
 * How long a develop is expected to take. The mockup showed 00:45, but measured
 * round-trips on grok-imagine-image-quality land around 7s. Estimating too high
 * makes the bar snap from a quarter-full straight to done, so this tracks the
 * real number with a little headroom for busier photos.
 */
export const ESTIMATED_MS = 12_000;

/**
 * The local shader finishes in milliseconds, which would make the develop
 * animation flash past. Hold it to a deliberate beat instead — the waiting is
 * the point, and a consistent one reads better than an instant one.
 */
const INSTANT_MS = 2_400;

/** Progress is parked here until the AI actually returns (PRD 5.3). */
const HOLD_AT = 0.85;
const FINISH_MS = 900;

type State =
  | { status: "idle" }
  | { status: "developing" }
  | { status: "error"; message: string };

/**
 * Drives the develop animation *concurrently* with the API request, rather than
 * after it. The bar eases toward HOLD_AT over the estimated duration and waits
 * there; once the image lands it completes over FINISH_MS. That way the
 * animation can never finish early and leave the user staring at a full bar.
 */
export function useDevelop(onComplete: (image: string) => void) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [progress, setProgress] = useState(0);

  // Held in a ref so `start` stays stable across renders.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const rafRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(0);
  const arrivedAtRef = useRef<number | null>(null);
  const progressAtArrivalRef = useRef(0);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopLoop();
    setState({ status: "idle" });
    setProgress(0);
  }, [stopLoop]);

  const start = useCallback(
    (imageDataUrl: string, mode: DevelopMode = "ai") => {
      const duration = mode === "instant" ? INSTANT_MS : ESTIMATED_MS;
      abortRef.current?.abort();
      stopLoop();

      const controller = new AbortController();
      abortRef.current = controller;

      startedAtRef.current = performance.now();
      arrivedAtRef.current = null;
      progressAtArrivalRef.current = 0;
      setProgress(0);
      setState({ status: "developing" });

      const tick = () => {
        const now = performance.now();

        if (arrivedAtRef.current === null) {
          // Ease-out toward the hold point: quick at first, then patient.
          const t = Math.min(1, (now - startedAtRef.current) / duration);
          setProgress(HOLD_AT * (1 - Math.pow(1 - t, 2)));
        } else {
          const t = Math.min(1, (now - arrivedAtRef.current) / FINISH_MS);
          const from = progressAtArrivalRef.current;
          setProgress(from + (1 - from) * t);
          if (t >= 1) {
            stopLoop();
            return;
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      const work: Promise<string> =
        mode === "instant"
          ? developPhoto(imageDataUrl, "instant").then(async (image) => {
              // The shader is done almost immediately; wait out the rest of the
              // animation so every instant develop feels the same length.
              const elapsed = performance.now() - startedAtRef.current;
              const remaining = duration * HOLD_AT - elapsed;
              if (remaining > 0) {
                await new Promise((r) => window.setTimeout(r, remaining));
              }
              return image;
            })
          : developPhoto(imageDataUrl, "ai", controller.signal);

      work
        .then((image) => {
          if (controller.signal.aborted) return;
          setProgress((p) => {
            progressAtArrivalRef.current = p;
            return p;
          });
          arrivedAtRef.current = performance.now();
          // Let the bar finish its travel before handing the print over.
          window.setTimeout(() => {
            if (controller.signal.aborted) return;
            setState({ status: "idle" });
            setProgress(0);
            onCompleteRef.current(image);
          }, FINISH_MS);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          stopLoop();
          setState({
            status: "error",
            message:
              err instanceof Error ? err.message : "Something went wrong.",
          });
        });
    },
    [stopLoop],
  );

  const reset = useCallback(() => {
    stopLoop();
    setState({ status: "idle" });
    setProgress(0);
  }, [stopLoop]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { state, progress, start, cancel, reset };
}

export function formatCountdown(progress: number, mode: DevelopMode): string {
  const total = mode === "instant" ? INSTANT_MS : ESTIMATED_MS;
  const remainingMs = Math.max(0, total * (1 - progress / 0.85));
  const secs = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
