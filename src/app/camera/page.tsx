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
  deleteVoiceNote,
  loadLibrary,
  movePhotoToFolder,
  persistPhoto,
  updateFolder,
  updatePhotoCaption,
  uploadVoiceNote,
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
  // Lazily fetched and cached — a ~1MB file not worth loading before it's
  // actually needed.
  const presetLutRef = useRef<Promise<Lut3D> | null>(null);
  const getPresetLut = useCallback(() => {
    if (!presetLutRef.current) {
      presetLutRef.current = loadCubeLut("/Kodak-200.cube");
    }
    return presetLutRef.current;
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

  // Promotes a finished capture into a print, persisting it to the user's
  // library. If the upload fails, the shot is still shown so the photo
  // isn't lost off-screen — it just won't survive a refresh.
  const finalizeShot = useCallback(
    (image: string) => {
      const fallback: Shot = {
        id: Math.random().toString(36).slice(2, 10),
        imageUrl: image,
        createdAt: Date.now(),
        folderId: null,
        caption: null,
        // Never actually uploaded, so there's no object to point at — a
        // delete of this shot just clears local state (see handleDeletePhoto).
        storagePath: "",
        voicePath: null,
        voiceUrl: null,
      };

      const promoted = userId
        ? persistPhoto(supabase, userId, image, null).catch(() => fallback)
        : Promise.resolve(fallback);

      promoted.then((shot) => {
        setShots((prev) => [shot, ...prev]);
        setCurrent(shot);
        setViewingFromGallery(false);
        setOpenFlipped(false);
        setScreen("result");
        // consume_photo_quota() already decremented this server-side
        // (runDevelop below calls it before grading, and only proceeds if
        // it returns true) — mirror it locally so the count on screen
        // doesn't wait for a refetch.
        setProfile((prev) =>
          prev && !prev.is_pro
            ? { ...prev, photo_quota: Math.max(0, prev.photo_quota - 1) }
            : prev,
        );
      });
    },
    [supabase, userId],
  );

  const handleComplete = useCallback(
    (image: string) => finalizeShot(image),
    [finalizeShot],
  );

  const PRESET_DEVELOP_MS = 5_000;

  // Every photo goes through the same local preset — a LUT grade plus
  // vignette/grain/bloom (lib/filmEffect.ts) — instead of a per-photo AI
  // call. Quota still gates it (same RPC /api/develop used to call
  // server-side), called directly since there's no server round-trip left
  // to do it from.
  const runDevelop = useCallback(
    async (imageDataUrl: string) => {
      const { data: allowed, error } = await supabase.rpc("consume_photo_quota");
      if (error) throw error;
      if (!allowed) throw new Error("You're out of photos. Ask the admin for more.");

      const [graded] = await Promise.all([
        getPresetLut()
          .then((lut) => applyDisposableLook(imageDataUrl, lut))
          .catch(() => imageDataUrl),
        new Promise((resolve) => window.setTimeout(resolve, PRESET_DEVELOP_MS)),
      ]);
      return graded;
    },
    [supabase, getPresetLut],
  );

  const { state, progress, start, cancel } = useDevelop(
    runDevelop,
    handleComplete,
    PRESET_DEVELOP_MS,
  );

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

  // Not optimistic like caption/folder edits — the caller needs the signed
  // playback URL back, and a failed upload should surface as an error in
  // the recorder UI rather than silently losing the recording.
  const handleRecordVoice = useCallback(
    async (shotId: string, blob: Blob) => {
      if (!userId) throw new Error("Not signed in.");
      const { voicePath, voiceUrl } = await uploadVoiceNote(supabase, userId, shotId, blob);
      const patch = (s: Shot): Shot => (s.id === shotId ? { ...s, voicePath, voiceUrl } : s);
      setShots((prev) => prev.map(patch));
      setCurrent((prev) => (prev && prev.id === shotId ? patch(prev) : prev));
    },
    [supabase, userId],
  );

  const handleDeleteVoice = useCallback(
    async (shot: Shot) => {
      await deleteVoiceNote(supabase, shot);
      const patch = (s: Shot): Shot =>
        s.id === shot.id ? { ...s, voicePath: null, voiceUrl: null } : s;
      setShots((prev) => prev.map(patch));
      setCurrent((prev) => (prev && prev.id === shot.id ? patch(prev) : prev));
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
    return (
      <main className="paper grain flex h-dvh flex-col">
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
    <main className="paper grain flex h-dvh flex-col">
      <div className="grain-layer" />
      <div className="relative z-2 flex min-h-0 flex-1 flex-col">
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
            onClose={viewingFromGallery ? handleCloseViewer : undefined}
            onFile={handleFile}
            onCreateFolder={handleCreateFolder}
            onUpdateCaption={handleUpdateCaption}
            onRecordVoice={handleRecordVoice}
            onDeleteVoice={handleDeleteVoice}
            onDelete={handleDeletePhoto}
            photoCount={shots.length}
            folderCount={folders.length}
            profile={profile}
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
            onUpdateFolder={handleUpdateFolder}
            onCreateFolder={handleCreateFolder}
            onUpload={handleCapture}
          />
        )}

        <TabBar screen={screen} onSelect={setScreen} />
      </div>
    </main>
  );
}
