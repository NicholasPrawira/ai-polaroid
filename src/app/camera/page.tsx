"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraScreen } from "@/components/CameraScreen";
import { ProcessingScreen } from "@/components/ProcessingScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { GalleryScreen } from "@/components/GalleryScreen";
import { TabBar } from "@/components/Chrome";
import { Folder, Profile, Screen, Shot } from "@/lib/types";
import { useDevelop } from "@/lib/useDevelop";
import { loadCubeLut, type Lut3D } from "@/lib/lut";
import { applyDisposableLook } from "@/lib/filmEffect";
import { createClient } from "@/lib/supabase/client";
import {
  createFolder,
  deletePhoto,
  loadLibrary,
  movePhotoToFolder,
  persistPhoto,
  updateFolder,
  updatePhotoCaption,
} from "@/lib/supabase/photos";

export default function Home() {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("camera");
  const [shots, setShots] = useState<Shot[]>([]);
  const [current, setCurrent] = useState<Shot | null>(null);
  // Whether `current` was opened from the gallery (back chevron, no "New
  // Photo") or is the fresh print straight off the camera (the reverse).
  const [viewingFromGallery, setViewingFromGallery] = useState(false);
  // Set when the grid tile was swiped rather than tapped — the tile already
  // flipped itself, so the viewer opens already turned to continue that
  // motion instead of showing the front first.
  const [openFlipped, setOpenFlipped] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  // Lazily fetched and cached — only the raw (disposable-effect-off) path
  // ever needs it, and it's a ~1MB file not worth loading up front.
  const rawLutRef = useRef<Promise<Lut3D> | null>(null);
  const getRawLut = useCallback(() => {
    if (!rawLutRef.current) {
      rawLutRef.current = loadCubeLut("/Kodak-200.cube");
    }
    return rawLutRef.current;
  }, []);

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
        .select("is_pro, photo_quota, disposable_effect")
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

  // Promotes a finished capture into a print, persisting it to the user's
  // library. If the upload fails, the shot is still shown so the photo
  // isn't lost off-screen — it just won't survive a refresh. `consumedQuota`
  // is false for a raw capture (disposable effect off) — nothing was sent to
  // OpenRouter, so nothing should come off the quota either. It doubles as
  // the "went through AI" flag persisted on the shot, since the two are the
  // same thing at every call site.
  const finalizeShot = useCallback(
    (image: string, consumedQuota: boolean) => {
      const fallback: Shot = {
        id: Math.random().toString(36).slice(2, 10),
        imageUrl: image,
        createdAt: Date.now(),
        folderId: null,
        caption: null,
        // Never actually uploaded, so there's no object to point at — a
        // delete of this shot just clears local state (see handleDeletePhoto).
        storagePath: "",
        aiGenerated: consumedQuota,
      };

      const promoted = userId
        ? persistPhoto(supabase, userId, image, null, consumedQuota).catch(() => fallback)
        : Promise.resolve(fallback);

      promoted.then((shot) => {
        setShots((prev) => [shot, ...prev]);
        setCurrent(shot);
        setViewingFromGallery(false);
        setOpenFlipped(false);
        setScreen("result");
        if (consumedQuota) {
          // /api/develop already decremented this server-side (that's what
          // gated the request in the first place) — mirror it locally so the
          // count on screen doesn't wait for a refetch.
          setProfile((prev) =>
            prev && !prev.is_pro
              ? { ...prev, photo_quota: Math.max(0, prev.photo_quota - 1) }
              : prev,
          );
        }
      });
    },
    [supabase, userId],
  );

  const handleComplete = useCallback(
    (image: string) => finalizeShot(image, true),
    [finalizeShot],
  );

  const runAiDevelop = useCallback(async (imageDataUrl: string, signal: AbortSignal) => {
    const res = await fetch("/api/develop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageDataUrl }),
      signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Develop failed (${res.status}).`);
    return body.image as string;
  }, []);

  const { state, progress, start, cancel } = useDevelop(runAiDevelop, handleComplete);

  // Disposable effect off means no AI call and no quota spent — but the
  // capture still goes through the same processing screen instead of just
  // appearing, so it reads as a develop step rather than an instant preview.
  const RAW_DEVELOP_MS = 5_000;
  const handleRawComplete = useCallback(
    (image: string) => finalizeShot(image, false),
    [finalizeShot],
  );
  const runRawDevelop = useCallback(
    async (imageDataUrl: string) => {
      const [graded] = await Promise.all([
        getRawLut()
          .then((lut) => applyDisposableLook(imageDataUrl, lut))
          .catch(() => imageDataUrl),
        new Promise((resolve) => window.setTimeout(resolve, RAW_DEVELOP_MS)),
      ]);
      return graded;
    },
    [getRawLut],
  );
  const {
    state: rawState,
    progress: rawProgress,
    start: startRaw,
    cancel: cancelRaw,
  } = useDevelop(runRawDevelop, handleRawComplete, RAW_DEVELOP_MS);

  // Which of the two develops is behind the current "processing" screen —
  // decides which hook's state/progress/retry to read from below.
  const [isRawDevelop, setIsRawDevelop] = useState(false);

  const handleCapture = useCallback(
    (dataUrl: string) => {
      setSource(dataUrl);
      setScreen("processing");
      if (profile && !profile.disposable_effect) {
        setIsRawDevelop(true);
        startRaw(dataUrl);
        return;
      }
      setIsRawDevelop(false);
      start(dataUrl);
    },
    [start, startRaw, profile],
  );

  const handleToggleDisposableEffect = useCallback(
    (enabled: boolean) => {
      setProfile((prev) => (prev ? { ...prev, disposable_effect: enabled } : prev));
      supabase.rpc("set_disposable_effect", { enabled }).then(({ error }) => {
        if (error) {
          // Revert — the toggle in the UI would otherwise lie about what's
          // actually saved server-side.
          setProfile((prev) =>
            prev ? { ...prev, disposable_effect: !enabled } : prev,
          );
        }
      });
    },
    [supabase],
  );

  const handleCancel = useCallback(() => {
    cancel();
    cancelRaw();
    setSource(null);
    setScreen("camera");
  }, [cancel, cancelRaw]);

  const handleRetry = useCallback(() => {
    if (!source) return;
    if (isRawDevelop) startRaw(source);
    else start(source);
  }, [source, start, startRaw, isRawDevelop]);

  const handleCreateFolder = useCallback(
    async (name: string, color: string | null = null) => {
      if (!userId) throw new Error("Not signed in");
      const folder = await createFolder(supabase, userId, name, color);
      setFolders((prev) => [...prev, folder]);
      return folder.id;
    },
    [supabase, userId],
  );

  const handleUpdateFolder = useCallback(
    (folderId: string, patch: { name: string; color: string | null }) => {
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, ...patch } : f)),
      );
      // Optimistic, same reasoning as handleFile below — the edit sheet has
      // already closed by the time this resolves.
      updateFolder(supabase, folderId, patch).catch(() => {});
    },
    [supabase],
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

  const handleUpdateCaption = useCallback(
    (shotId: string, caption: string | null) => {
      const patch = (s: Shot): Shot => (s.id === shotId ? { ...s, caption } : s);
      setShots((prev) => prev.map(patch));
      setCurrent((prev) => (prev && prev.id === shotId ? patch(prev) : prev));
      updatePhotoCaption(supabase, shotId, caption).catch(() => {});
    },
    [supabase],
  );

  const handleNewPhoto = useCallback(() => {
    setSource(null);
    setScreen("camera");
  }, []);

  const handleCloseViewer = useCallback(() => {
    setScreen("gallery");
  }, []);

  // Confirmed by the popup in ResultScreen before this ever runs — this is
  // the actual delete, not the "are you sure".
  const handleDeletePhoto = useCallback(
    async (shot: Shot) => {
      await deletePhoto(supabase, shot);
      setShots((prev) => prev.filter((s) => s.id !== shot.id));
      setCurrent(null);
      setScreen(viewingFromGallery ? "gallery" : "camera");
    },
    [supabase, viewingFromGallery],
  );

  if (screen === "processing" && source) {
    const active = isRawDevelop ? { state: rawState, progress: rawProgress } : { state, progress };
    return (
      <main className="paper grain flex min-h-dvh flex-col">
        <ProcessingScreen
          source={source}
          progress={active.progress}
          error={active.state.status === "error" ? active.state.message : null}
          onCancel={handleCancel}
          onRetry={handleRetry}
          raw={isRawDevelop}
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
            onToggleDisposableEffect={handleToggleDisposableEffect}
          />
        )}

        {screen === "result" && current && (
          <ResultScreen
            shot={current}
            folders={folders}
            onNewPhoto={handleNewPhoto}
            onClose={viewingFromGallery ? handleCloseViewer : undefined}
            onFile={handleFile}
            onCreateFolder={handleCreateFolder}
            onUpdateCaption={handleUpdateCaption}
            onDelete={handleDeletePhoto}
            photoCount={shots.length}
            folderCount={folders.length}
            profile={profile}
            onToggleDisposableEffect={handleToggleDisposableEffect}
            initialFlipped={openFlipped}
          />
        )}

        {screen === "gallery" && (
          <GalleryScreen
            shots={shots}
            folders={folders}
            onSelect={(shot, opts) => {
              setCurrent(shot);
              setViewingFromGallery(true);
              setOpenFlipped(!!opts?.flipped);
              setScreen("result");
            }}
            photoCount={shots.length}
            folderCount={folders.length}
            profile={profile}
            onToggleDisposableEffect={handleToggleDisposableEffect}
            onUpdateFolder={handleUpdateFolder}
            onCreateFolder={handleCreateFolder}
          />
        )}

        <TabBar screen={screen} onSelect={setScreen} />
      </div>
    </main>
  );
}
