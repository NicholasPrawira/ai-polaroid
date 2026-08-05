"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * How long a develop is expected to take. The mockup showed 00:45, but measured
 * round-trips on grok-imagine-image-quality land around 7s. Estimating too high
 * makes the bar snap from a quarter-full straight to done, so this tracks the
 * real number with a little headroom for busier photos.
 */
export const ESTIMATED_MS = 12_000;

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
    (imageDataUrl: string) => {
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
          const t = Math.min(1, (now - startedAtRef.current) / ESTIMATED_MS);
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

      fetch("/api/develop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
        signal: controller.signal,
      })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(body.error ?? `Develop failed (${res.status}).`);
          }
          return body.image as string;
        })
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
