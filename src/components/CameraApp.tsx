"use client";

import { useCallback, useState } from "react";
import { CameraScreen } from "@/components/CameraScreen";
import { ProcessingScreen } from "@/components/ProcessingScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { GalleryScreen } from "@/components/GalleryScreen";
import { TabBar } from "@/components/Chrome";
import { Folder, Profile, Screen, Shot } from "@/lib/types";
import { useDevelop, type Developed } from "@/lib/useDevelop";
import { createFolder, deleteShot, moveShot } from "@/app/actions";

/**
 * The camera, holding the session's view of what the server already has.
 *
 * Photos and folders arrive as props from a Server Component and are then kept
 * locally so the UI can respond immediately to a capture or a move. Persistence
 * is the Server Action's job; this state is the optimistic echo of it, and a
 * reload re-reads the truth from the database.
 */
export function CameraApp({
  initialShots,
  initialFolders,
  profile,
}: {
  initialShots: Shot[];
  initialFolders: Folder[];
  profile: Profile;
}) {
  const [screen, setScreen] = useState<Screen>("camera");
  const [shots, setShots] = useState<Shot[]>(initialShots);
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [credits, setCredits] = useState(profile.credits);
  const [current, setCurrent] = useState<Shot | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Promote a finished develop into a print. The id is the one the database
  // assigned, so filing it later addresses a real row.
  const handleComplete = useCallback((developed: Developed) => {
    const shot: Shot = {
      id: developed.id,
      imageUrl: developed.image,
      createdAt: Date.now(),
      folderId: null,
    };
    setShots((prev) => [shot, ...prev]);
    setCredits(developed.credits);
    setCurrent(shot);
    setScreen("result");
  }, []);

  const { state, progress, start, cancel } = useDevelop(handleComplete);

  const handleCapture = useCallback(
    (dataUrl: string) => {
      if (credits <= 0) {
        setNotice("Out of photo credits. Redeem a code from Account.");
        return;
      }
      setNotice(null);
      setSource(dataUrl);
      setScreen("processing");
      start(dataUrl);
    },
    [credits, start],
  );

  const handleCancel = useCallback(() => {
    cancel();
    setSource(null);
    setScreen("camera");
  }, [cancel]);

  const handleRetry = useCallback(() => {
    if (source) start(source);
  }, [source, start]);

  const handleCreateFolder = useCallback(async (name: string) => {
    const id = await createFolder(name);
    if (!id) return null;
    setFolders((prev) => [
      ...prev,
      { id, name: name.trim().slice(0, 40), createdAt: Date.now() },
    ]);
    return id;
  }, []);

  const handleFile = useCallback(
    async (shotId: string, folderId: string | null) => {
      const patch = (s: Shot): Shot =>
        s.id === shotId ? { ...s, folderId } : s;
      setShots((prev) => prev.map(patch));
      setCurrent((prev) => (prev && prev.id === shotId ? patch(prev) : prev));
      await moveShot(shotId, folderId);
    },
    [],
  );

  const handleNewPhoto = useCallback(() => {
    setSource(null);
    setScreen("camera");
  }, []);

  // Deleting is not a nicety here: these are photographs of people, some of
  // whom never signed up for anything. It removes both files and the row.
  const handleDelete = useCallback(async (shotId: string) => {
    await deleteShot(shotId);
    setShots((prev) => prev.filter((s) => s.id !== shotId));
    setCurrent(null);
    setScreen("gallery");
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

  const account = {
    email: profile.email,
    credits,
    isAdmin: profile.isAdmin,
    photoCount: shots.length,
    folderCount: folders.length,
    onCredits: setCredits,
  };

  return (
    <main className="paper grain flex min-h-dvh flex-col">
      <div className="grain-layer" />
      <div className="relative z-2 flex min-h-dvh flex-col">
        {screen === "camera" && (
          <CameraScreen
            onCapture={handleCapture}
            lastShot={shots[0] ?? null}
            notice={notice}
            account={account}
          />
        )}

        {screen === "result" && current && (
          <ResultScreen
            shot={current}
            folders={folders}
            onNewPhoto={handleNewPhoto}
            onFile={handleFile}
            onCreateFolder={handleCreateFolder}
            onDelete={handleDelete}
            account={account}
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
            account={account}
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
