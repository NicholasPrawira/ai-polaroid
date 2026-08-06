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
 * Drives the develop animation *concurrently* with `run`, rather than after
 * it. The bar eases toward HOLD_AT over `estimatedMs` and waits there; once
 * `run` resolves it completes over FINISH_MS. That way the animation can
 * never finish early and leave the user staring at a full bar.
 *
 * `run` is what actually produces the developed image — an API round-trip
 * for the AI path, or a plain local grade for the raw path. Either way the
 * screen and pacing are the same; only the work behind it differs.
 */
export function useDevelop(
  run: (imageDataUrl: string, signal: AbortSignal) => Promise<string>,
  onComplete: (image: string) => void,
  estimatedMs: number = ESTIMATED_MS,
) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [progress, setProgress] = useState(0);

  // Held in refs so `start` stays stable across renders.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

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
          const t = Math.min(1, (now - startedAtRef.current) / estimatedMs);
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

      runRef
        .current(imageDataUrl, controller.signal)
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
    [stopLoop, estimatedMs],
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
