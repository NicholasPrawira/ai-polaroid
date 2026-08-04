"use client";

import { useCallback, useState } from "react";
import { CameraScreen } from "@/components/CameraScreen";
import { ProcessingScreen } from "@/components/ProcessingScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { GalleryScreen } from "@/components/GalleryScreen";
import { TabBar } from "@/components/Chrome";
import { Folder, Screen, Shot } from "@/lib/types";
import { useDevelop } from "@/lib/useDevelop";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("camera");
  // Session-only, in memory. Refreshing clears everything, by design (PRD 5.5).
  const [shots, setShots] = useState<Shot[]>([]);
  const [current, setCurrent] = useState<Shot | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [source, setSource] = useState<string | null>(null);

  // Promote a finished develop into a print.
  const handleComplete = useCallback((image: string) => {
    const shot: Shot = {
      id: Math.random().toString(36).slice(2, 10),
      imageUrl: image,
      createdAt: Date.now(),
      folderId: null,
    };
    setShots((prev) => [shot, ...prev]);
    setCurrent(shot);
    setScreen("result");
  }, []);

  const { state, progress, start, cancel } = useDevelop(handleComplete);

  const handleCapture = useCallback(
    (dataUrl: string) => {
      setSource(dataUrl);
      setScreen("processing");
      start(dataUrl);
    },
    [start],
  );

  const handleCancel = useCallback(() => {
    cancel();
    setSource(null);
    setScreen("camera");
  }, [cancel]);

  const handleRetry = useCallback(() => {
    if (source) start(source);
  }, [source, start]);

  const handleCreateFolder = useCallback((name: string) => {
    const folder: Folder = {
      id: Math.random().toString(36).slice(2, 10),
      name,
      createdAt: Date.now(),
    };
    setFolders((prev) => [...prev, folder]);
    return folder.id;
  }, []);

  const handleFile = useCallback((shotId: string, folderId: string | null) => {
    const patch = (s: Shot): Shot => (s.id === shotId ? { ...s, folderId } : s);
    setShots((prev) => prev.map(patch));
    setCurrent((prev) => (prev && prev.id === shotId ? patch(prev) : prev));
  }, []);

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
          <CameraScreen onCapture={handleCapture} lastShot={shots[0] ?? null} />
        )}

        {screen === "result" && current && (
          <ResultScreen
            shot={current}
            folders={folders}
            onNewPhoto={handleNewPhoto}
            onFile={handleFile}
            onCreateFolder={handleCreateFolder}
          />
        )}

        {screen === "gallery" && (
          <GalleryScreen
            shots={shots}
            folders={folders}
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
