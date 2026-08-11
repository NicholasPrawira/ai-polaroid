"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { Folder, Shot } from "@/lib/types";
import { makeThumbnail } from "@/lib/thumbnail";

type Client = SupabaseClient<Database>;

const BUCKET = "photos";
const VOICE_BUCKET = "voice-notes";

/** Matches the `photos_monthly_limit` trigger in the database. Kept here
 *  only so the UI can name the number in its message — the trigger is what
 *  actually enforces it, since the browser talks to PostgREST directly and
 *  any client-side check could simply be skipped. */
export const MONTHLY_PHOTO_LIMIT = 200;

/** True when an error came back from the monthly-limit trigger, so callers
 *  can show the real reason instead of a generic failure. */
export function isMonthlyLimitError(error: unknown): boolean {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  return message.includes("Monthly limit reached");
}

/**
 * Signed URLs are re-issued on every load, and each one carries a fresh
 * token — which means a differing URL, which means the browser cache never
 * matches and the whole library is re-downloaded on every visit. With no
 * pagination in the gallery that is the dominant bandwidth cost of the app.
 *
 * A week-long token keeps the URL stable long enough for the HTTP cache to
 * actually do its job across sessions. The objects stay private: the token
 * still expires, and it only ever grants access to that one object.
 */
const SIGNED_URL_TTL_S = 60 * 60 * 24 * 7;

/**
 * `Cache-Control: max-age` Supabase serves the stored object with. Photos
 * are immutable once written — a re-develop writes a new id — so the only
 * thing that ends a cache entry is the signed token expiring.
 */
const STORAGE_CACHE_S = "604800"; // 7 days, matching the token lifetime

function extensionFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function extensionForAudio(mime: string): string {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/**
 * Uploads a developed photo to the signed-in user's private storage folder
 * and records it in `photos`. Path is `{user_id}/{photo_id}.{ext}` — the
 * leading segment is what the storage RLS policies check against `auth.uid()`.
 */
export async function persistPhoto(
  supabase: Client,
  userId: string,
  imageDataUrl: string,
  folderId: string | null,
): Promise<Shot> {
  const blob = await dataUrlToBlob(imageDataUrl);
  const id = crypto.randomUUID();
  const path = `${userId}/${id}.${extensionFor(blob.type || "image/jpeg")}`;
  const thumbPath = `${userId}/${id}_thumb.jpg`;

  // Build the thumbnail before uploading anything, but never let it block
  // the save: a photo without a grid rendition still works (the gallery
  // falls back to the full image), whereas losing the photo does not.
  const thumbBlob = await makeThumbnail(imageDataUrl).catch(() => null);

  const [{ error: uploadError }, thumbUpload] = await Promise.all([
    supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: blob.type || "image/jpeg", cacheControl: STORAGE_CACHE_S }),
    thumbBlob
      ? supabase.storage
          .from(BUCKET)
          .upload(thumbPath, thumbBlob, { contentType: "image/jpeg", cacheControl: STORAGE_CACHE_S })
      : Promise.resolve({ error: null }),
  ]);
  if (uploadError) throw uploadError;
  const thumbStored = !!thumbBlob && !thumbUpload.error;

  const { data: row, error: insertError } = await supabase
    .from("photos")
    .insert({
      id,
      user_id: userId,
      folder_id: folderId,
      storage_path: path,
      thumb_path: thumbStored ? thumbPath : null,
    })
    .select()
    .single();
  if (insertError) {
    // Don't leave an orphaned object if the row failed to write.
    await supabase.storage.from(BUCKET).remove(thumbStored ? [path, thumbPath] : [path]);
    throw insertError;
  }

  return {
    id: row.id,
    imageUrl: imageDataUrl, // already have the bytes locally; skip the round-trip
    createdAt: new Date(row.created_at).getTime(),
    folderId: row.folder_id,
    caption: row.caption,
    storagePath: row.storage_path,
    thumbPath: row.thumb_path,
    // The local data URL is already decoded and costs nothing to reuse,
    // so the grid shows this capture without a fetch either way.
    thumbUrl: imageDataUrl,
    voicePath: null, // a fresh capture never has a voice note yet
    voiceUrl: null,
  };
}

export async function updatePhotoCaption(
  supabase: Client,
  photoId: string,
  caption: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("photos")
    .update({ caption })
    .eq("id", photoId);
  if (error) throw error;
}

/**
 * Uploads a voice memory for an existing photo and points `photos.voice_path`
 * at it, replacing whatever was there before. Path shape mirrors the photos
 * bucket: `{user_id}/{photo_id}.{ext}` — same RLS pattern, separate bucket.
 */
export async function uploadVoiceNote(
  supabase: Client,
  userId: string,
  photoId: string,
  blob: Blob,
): Promise<{ voicePath: string; voiceUrl: string }> {
  const path = `${userId}/${photoId}.${extensionForAudio(blob.type || "audio/webm")}`;

  const { error: uploadError } = await supabase.storage
    .from(VOICE_BUCKET)
    .upload(path, blob, { contentType: blob.type || "audio/webm", upsert: true });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from("photos")
    .update({ voice_path: path })
    .eq("id", photoId);
  if (updateError) throw updateError;

  const { data: signed, error: signError } = await supabase.storage
    .from(VOICE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_S);
  if (signError) throw signError;

  return { voicePath: path, voiceUrl: signed.signedUrl };
}

/**
 * Clears the DB pointer first — same reasoning as `deletePhoto` — then
 * best-effort removes the storage object.
 */
export async function deleteVoiceNote(
  supabase: Client,
  photo: Shot,
): Promise<void> {
  if (!photo.voicePath) return;
  const { error } = await supabase
    .from("photos")
    .update({ voice_path: null })
    .eq("id", photo.id);
  if (error) throw error;

  await supabase.storage.from(VOICE_BUCKET).remove([photo.voicePath]);
}

/**
 * Deletes the database row first — that's the part that actually decides
 * whether the photo still "exists" to the user — then best-effort removes
 * the storage object. A failure on the storage side just leaves an orphaned
 * object behind rather than a photo the user thought they deleted.
 */
export async function deletePhoto(
  supabase: Client,
  photo: Shot,
): Promise<void> {
  const { error } = await supabase.from("photos").delete().eq("id", photo.id);
  if (error) throw error;

  await supabase.storage
    .from(BUCKET)
    .remove(photo.thumbPath ? [photo.storagePath, photo.thumbPath] : [photo.storagePath]);
  if (photo.voicePath) {
    await supabase.storage.from(VOICE_BUCKET).remove([photo.voicePath]);
  }
}

export async function createFolder(
  supabase: Client,
  userId: string,
  name: string,
  color: string | null = null,
): Promise<Folder> {
  const { data, error } = await supabase
    .from("folders")
    .insert({ user_id: userId, name, color })
    .select()
    .single();
  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    createdAt: new Date(data.created_at).getTime(),
    color: data.color,
  };
}

export async function updateFolder(
  supabase: Client,
  folderId: string,
  patch: { name: string; color: string | null },
): Promise<void> {
  const { error } = await supabase
    .from("folders")
    .update({ name: patch.name, color: patch.color })
    .eq("id", folderId);
  if (error) throw error;
}

export async function movePhotoToFolder(
  supabase: Client,
  photoId: string,
  folderId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("photos")
    .update({ folder_id: folderId })
    .eq("id", photoId);
  if (error) throw error;
}

/**
 * Loads everything the signed-in user owns. The bucket is private, so photos
 * are handed back with time-limited signed URLs rather than public ones —
 * fine for a gallery that's re-fetched each time `/camera` mounts.
 */
export async function loadLibrary(
  supabase: Client,
  userId: string,
): Promise<{ shots: Shot[]; folders: Folder[] }> {
  const [photosRes, foldersRes] = await Promise.all([
    supabase
      .from("photos")
      .select()
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("folders")
      .select()
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);
  if (photosRes.error) throw photosRes.error;
  if (foldersRes.error) throw foldersRes.error;

  // Thumbnails live in the same bucket, so they ride along in the same
  // signing batch rather than costing a second round-trip.
  const paths = [
    ...photosRes.data.map((p) => p.storage_path),
    ...photosRes.data
      .map((p) => p.thumb_path)
      .filter((p): p is string => p !== null),
  ];
  const voicePaths = photosRes.data
    .map((p) => p.voice_path)
    .filter((p): p is string => p !== null);

  // Independent of each other — sign both batches concurrently instead of
  // waiting on photos before even starting the voice-note batch.
  const [photoSignRes, voiceSignRes] = await Promise.all([
    paths.length > 0
      ? supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_S)
      : Promise.resolve({ data: [], error: null }),
    voicePaths.length > 0
      ? supabase.storage.from(VOICE_BUCKET).createSignedUrls(voicePaths, SIGNED_URL_TTL_S)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (photoSignRes.error) throw photoSignRes.error;
  if (voiceSignRes.error) throw voiceSignRes.error;

  const signedByPath = new Map<string, string>();
  for (const s of photoSignRes.data ?? []) {
    if (s.signedUrl && s.path) signedByPath.set(s.path, s.signedUrl);
  }
  const signedVoiceByPath = new Map<string, string>();
  for (const s of voiceSignRes.data ?? []) {
    if (s.signedUrl && s.path) signedVoiceByPath.set(s.path, s.signedUrl);
  }

  const shots: Shot[] = photosRes.data
    .filter((p) => signedByPath.has(p.storage_path))
    .map((p) => {
      const full = signedByPath.get(p.storage_path)!;
      return {
        id: p.id,
        imageUrl: full,
        createdAt: new Date(p.created_at).getTime(),
        folderId: p.folder_id,
        caption: p.caption,
        storagePath: p.storage_path,
        thumbPath: p.thumb_path,
        // Photos saved before thumbnails existed fall back to the full
        // image, so the grid works without a backfill.
        thumbUrl: (p.thumb_path ? signedByPath.get(p.thumb_path) : null) ?? full,
        voicePath: p.voice_path,
        voiceUrl: p.voice_path ? (signedVoiceByPath.get(p.voice_path) ?? null) : null,
      };
    });

  const folders: Folder[] = foldersRes.data.map((f) => ({
    id: f.id,
    name: f.name,
    createdAt: new Date(f.created_at).getTime(),
    color: f.color,
  }));

  return { shots, folders };
}
