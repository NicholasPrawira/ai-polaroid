"use client";

import { useCallback, useEffect, useState } from "react";
import { CameraScreen } from "@/components/CameraScreen";
import { ProcessingScreen } from "@/components/ProcessingScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { GalleryScreen } from "@/components/GalleryScreen";
import { TabBar } from "@/components/Chrome";
import { Folder, Screen, Shot } from "@/lib/types";
import { useDevelop } from "@/lib/useDevelop";
import { createClient } from "@/lib/supabase/client";
import {
  createFolder,
  loadLibrary,
  movePhotoToFolder,
  persistPhoto,
} from "@/lib/supabase/photos";

export default function Home() {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("camera");
  const [shots, setShots] = useState<Shot[]>([]);
  const [current, setCurrent] = useState<Shot | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    is_pro: boolean;
    photo_quota: number;
  } | null>(null);

  // /camera is auth-gated by proxy.ts, so a session is guaranteed by the
  // time this mounts — this just loads which user, and their library.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id;
      if (cancelled || !id) return;
      setUserId(id);
      loadLibrary(supabase, id).then((library) => {
        if (cancelled) return;
        setShots(library.shots);
        setFolders(library.folders);
      });
      supabase
        .from("profiles")
        .select("is_pro, photo_quota")
        .eq("user_id", id)
        .single()
        .then(({ data: p }) => {
          if (!cancelled) setProfile(p);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Promote a finished develop into a print, persisting it to the user's
  // library. If the upload fails, the shot is still shown so the photo
  // isn't lost off-screen — it just won't survive a refresh.
  const handleComplete = useCallback(
    (image: string) => {
      const fallback: Shot = {
        id: Math.random().toString(36).slice(2, 10),
        imageUrl: image,
        createdAt: Date.now(),
        folderId: null,
      };

      const promoted = userId
        ? persistPhoto(supabase, userId, image, null).catch(() => fallback)
        : Promise.resolve(fallback);

      promoted.then((shot) => {
        setShots((prev) => [shot, ...prev]);
        setCurrent(shot);
        setScreen("result");
        // /api/develop already decremented this server-side (that's what
        // gated the request in the first place) — mirror it locally so the
        // count on screen doesn't wait for a refetch.
        setProfile((prev) =>
          prev && !prev.is_pro
            ? { ...prev, photo_quota: Math.max(0, prev.photo_quota - 1) }
            : prev,
        );
      });
    },
    [supabase, userId],
  );

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

  const handleCreateFolder = useCallback(
    async (name: string) => {
      if (!userId) throw new Error("Not signed in");
      const folder = await createFolder(supabase, userId, name);
      setFolders((prev) => [...prev, folder]);
      return folder.id;
    },
    [supabase, userId],
  );

  const handleFile = useCallback(
    (shotId: string, folderId: string | null) => {
      const patch = (s: Shot): Shot => (s.id === shotId ? { ...s, folderId } : s);
      setShots((prev) => prev.map(patch));
      setCurrent((prev) => (prev && prev.id === shotId ? patch(prev) : prev));
      // Optimistic — the picker sheet already closed by the time this
      // resolves, so a failure here isn't worth surfacing.
      movePhotoToFolder(supabase, shotId, folderId).catch(() => {});
    },
    [supabase],
  );

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
          <CameraScreen
            onCapture={handleCapture}
            lastShot={shots[0] ?? null}
            photoCount={shots.length}
            folderCount={folders.length}
            profile={profile}
          />
        )}

        {screen === "result" && current && (
          <ResultScreen
            shot={current}
            folders={folders}
            onNewPhoto={handleNewPhoto}
            onFile={handleFile}
            onCreateFolder={handleCreateFolder}
            photoCount={shots.length}
            folderCount={folders.length}
            profile={profile}
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
            photoCount={shots.length}
            folderCount={folders.length}
            profile={profile}
          />
        )}

        <TabBar screen={screen} onSelect={setScreen} />
      </div>
    </main>
  );
}
