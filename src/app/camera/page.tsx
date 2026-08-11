"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraScreen } from "@/components/CameraScreen";
import { ResultScreen } from "@/components/ResultScreen";
import { GalleryScreen } from "@/components/GalleryScreen";
import { TabBar } from "@/components/Chrome";
import { Folder, Profile, Screen, Shot } from "@/lib/types";
import { loadCubeLut, type Lut3D } from "@/lib/lut";
import { applyDisposableLook } from "@/lib/filmEffect";
import { createClient } from "@/lib/supabase/client";
import {
  MONTHLY_PHOTO_LIMIT,
  createFolder,
  deletePhoto,
  deleteVoiceNote,
  isMonthlyLimitError,
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  // Lazily fetched and cached — a ~1MB file not worth loading before it's
  // actually needed.
  const presetLutRef = useRef<Promise<Lut3D> | null>(null);
  const getPresetLut = useCallback(() => {
    if (!presetLutRef.current) {
      presetLutRef.current = loadCubeLut("/Kodak-200.cube");
    }
    return presetLutRef.current;
  }, []);

  // /camera is auth-gated by proxy.ts, which already verified the session
  // server-side (getClaims(), a real JWT check) before this ever rendered —
  // so re-verifying with the network round-trip of auth.getUser() here is
  // redundant. getSession() reads the already-verified session straight
  // out of local storage, which is what makes this feel instant instead of
  // waiting on an extra request before the library query can even start.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user.id;
      if (cancelled || !id) return;
      setUserId(id);

      // Independent of each other — run concurrently instead of making the
      // profile wait behind the library (or vice versa).
      const [libraryResult, profileResult] = await Promise.allSettled([
        loadLibrary(supabase, id),
        supabase.from("profiles").select("preset_enabled").eq("user_id", id).single(),
      ]);
      if (cancelled) return;

      if (libraryResult.status === "fulfilled") {
        setShots(libraryResult.value.shots);
        setFolders(libraryResult.value.folders);
      }
      // On rejection, shots/folders stay at their initial empty state — the
      // gallery just reads as "no photos yet" rather than erroring the page.

      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value.data);
      }
    }

    load().catch(() => {});
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
        thumbPath: null,
        // Nothing was stored, so the grid reuses the local bytes it already has.
        thumbUrl: image,
        voicePath: null,
        voiceUrl: null,
      };

      const promoted = userId
        ? persistPhoto(supabase, userId, image, null).catch((err: unknown) => {
            // Hitting the monthly cap is a real answer, not a glitch — say
            // so, rather than letting the shot look saved and then vanish
            // on the next refresh.
            if (isMonthlyLimitError(err)) {
              setCaptureError(
                `You've reached ${MONTHLY_PHOTO_LIMIT} photos this month. This one wasn't saved.`,
              );
            }
            return fallback;
          })
        : Promise.resolve(fallback);

      promoted.then((shot) => {
        setShots((prev) => [shot, ...prev]);
        setCurrent(shot);
        setViewingFromGallery(false);
        setOpenFlipped(false);
        setScreen("result");
      });
    },
    [supabase, userId],
  );

  // No quota, no AI call — grading (or not) is the only branch left, driven
  // by the preset toggle.
  const runDevelop = useCallback(
    async (imageDataUrl: string) => {
      if (!(profile?.preset_enabled ?? true)) return imageDataUrl;

      return getPresetLut()
        .then((lut) => applyDisposableLook(imageDataUrl, lut))
        .catch(() => imageDataUrl);
    },
    [getPresetLut, profile?.preset_enabled],
  );

  const handleTogglePreset = useCallback(
    (enabled: boolean) => {
      setProfile((prev) => (prev ? { ...prev, preset_enabled: enabled } : prev));
      supabase.rpc("set_preset_enabled", { enabled }).then(({ error }) => {
        if (error) {
          // Revert — the toggle in the UI would otherwise lie about what's
          // actually saved server-side.
          setProfile((prev) =>
            prev ? { ...prev, preset_enabled: !enabled } : prev,
          );
        }
      });
    },
    [supabase],
  );

  // No processing screen — grading is fast enough (local canvas work) that
  // waiting on a dedicated "developing" step would be waiting for nothing.
  // `capturing` just guards against a double-tap while the promise settles.
  const handleCapture = useCallback(
    (dataUrl: string) => {
      setCapturing(true);
      setCaptureError(null);
      runDevelop(dataUrl)
        .then((graded) => finalizeShot(graded))
        .catch((err: unknown) => {
          setCaptureError(
            err instanceof Error ? err.message : "Could not develop this photo.",
          );
        })
        .finally(() => setCapturing(false));
    },
    [runDevelop, finalizeShot],
  );

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
            onTogglePreset={handleTogglePreset}
            capturing={capturing}
            captureError={captureError}
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
            onTogglePreset={handleTogglePreset}
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
            onTogglePreset={handleTogglePreset}
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
