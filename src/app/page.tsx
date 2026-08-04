"use client";

import { useCallback, useRef, useState } from "react";
import { CameraScreen } from "@/components/CameraScreen";
import { ProcessingScreen } from "@/components/ProcessingScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { GalleryScreen } from "@/components/GalleryScreen";
import { TabBar } from "@/components/Chrome";
import { Screen, Shot } from "@/lib/types";
import { DevelopMode as Mode } from "@/lib/develop";
import { DevelopMode, useDevelop } from "@/lib/useDevelop";
import { isSupported } from "@/lib/filmShader";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("camera");
  // Session-only, in memory. Refreshing clears everything, by design (PRD 5.5).
  const [shots, setShots] = useState<Shot[]>([]);
  const [current, setCurrent] = useState<Shot | null>(null);
  const [source, setSource] = useState<string | null>(null);
  // Read inside handleComplete, which must not depend on render-time state.
  const sourceRef = useRef<string | null>(null);
  // Local shader by default: instant, free, offline, and it can't alter a face.
  // Falls back to the AI path where WebGL2 is missing.
  const [mode, setMode] = useState<DevelopMode>(() =>
    typeof window !== "undefined" && !isSupported() ? "ai" : "instant",
  );

  // Promote a finished develop into a print.
  const handleComplete = useCallback(
    (image: string) => {
      const shot: Shot = {
        id: Math.random().toString(36).slice(2, 10),
        sourceUrl: sourceRef.current ?? image,
        variants: { [mode]: image },
        mode,
        createdAt: Date.now(),
      };
      setShots((prev) => [shot, ...prev]);
      setCurrent(shot);
      setScreen("result");
    },
    [mode],
  );

  /** Caches a variant produced later from the result screen. */
  const handleVariant = useCallback(
    (id: string, m: Mode, image: string) => {
      const patch = (s: Shot): Shot =>
        s.id === id ? { ...s, variants: { ...s.variants, [m]: image } } : s;
      setShots((prev) => prev.map(patch));
      setCurrent((prev) => (prev && prev.id === id ? patch(prev) : prev));
    },
    [],
  );

  const { state, progress, start, cancel } = useDevelop(handleComplete);

  const handleCapture = useCallback(
    (dataUrl: string) => {
      setSource(dataUrl);
      sourceRef.current = dataUrl;
      setScreen("processing");
      start(dataUrl, mode);
    },
    [start, mode],
  );

  const handleCancel = useCallback(() => {
    cancel();
    setSource(null);
    setScreen("camera");
  }, [cancel]);

  const handleRetry = useCallback(() => {
    if (source) start(source, mode);
  }, [source, start, mode]);

  const handleNewPhoto = useCallback(() => {
    setSource(null);
    setScreen("camera");
  }, []);

  if (screen === "processing" && source) {
    return (
      <main className="paper grain flex min-h-dvh flex-col">
        <ProcessingScreen
          source={source}
          progress={progress}
          mode={mode}
          error={state.status === "error" ? state.message : null}
          onCancel={handleCancel}
          onRetry={handleRetry}
        />
      </main>
    );
  }

  return (
    <main className="paper grain flex min-h-dvh flex-col">
      <div className="grain-layer" />
      <div className="relative z-2 flex min-h-dvh flex-col">
        {screen === "camera" && (
          <CameraScreen
            onCapture={handleCapture}
            lastShot={shots[0] ?? null}
            mode={mode}
            onModeChange={setMode}
          />
        )}

        {screen === "result" && current && (
          <ResultScreen
            key={current.id}
            shot={current}
            onNewPhoto={handleNewPhoto}
            onVariant={handleVariant}
          />
        )}

        {screen === "gallery" && (
          <GalleryScreen
            shots={shots}
            onSelect={(shot) => {
              setCurrent(shot);
              setScreen("result");
            }}
          />
        )}

        <TabBar
          screen={screen}
          onSelect={setScreen}
          hasResult={current !== null}
        />
      </div>
    </main>
  );
}
