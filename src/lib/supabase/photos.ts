"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { Folder, Shot } from "@/lib/types";

type Client = SupabaseClient<Database>;

const BUCKET = "photos";
const VOICE_BUCKET = "voice-notes";
/** Signed URLs are re-issued on every load rather than cached, so this only
 *  needs to outlive one browsing session. */
const SIGNED_URL_TTL_S = 60 * 60;

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

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || "image/jpeg" });
  if (uploadError) throw uploadError;

  const { data: row, error: insertError } = await supabase
    .from("photos")
    .insert({
      id,
      user_id: userId,
      folder_id: folderId,
      storage_path: path,
    })
    .select()
    .single();
  if (insertError) {
    // Don't leave an orphaned object if the row failed to write.
    await supabase.storage.from(BUCKET).remove([path]);
    throw insertError;
  }

  return {
    id: row.id,
    imageUrl: imageDataUrl, // already have the bytes locally; skip the round-trip
    createdAt: new Date(row.created_at).getTime(),
    folderId: row.folder_id,
    caption: row.caption,
    storagePath: row.storage_path,
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

  await supabase.storage.from(BUCKET).remove([photo.storagePath]);
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

  const paths = photosRes.data.map((p) => p.storage_path);
  const signedByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_S);
    if (signError) throw signError;
    for (const s of signed) {
      if (s.signedUrl && s.path) signedByPath.set(s.path, s.signedUrl);
    }
  }

  const voicePaths = photosRes.data
    .map((p) => p.voice_path)
    .filter((p): p is string => p !== null);
  const signedVoiceByPath = new Map<string, string>();
  if (voicePaths.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from(VOICE_BUCKET)
      .createSignedUrls(voicePaths, SIGNED_URL_TTL_S);
    if (signError) throw signError;
    for (const s of signed) {
      if (s.signedUrl && s.path) signedVoiceByPath.set(s.path, s.signedUrl);
    }
  }

  const shots: Shot[] = photosRes.data
    .filter((p) => signedByPath.has(p.storage_path))
    .map((p) => ({
      id: p.id,
      imageUrl: signedByPath.get(p.storage_path)!,
      createdAt: new Date(p.created_at).getTime(),
      folderId: p.folder_id,
      caption: p.caption,
      storagePath: p.storage_path,
      voicePath: p.voice_path,
      voiceUrl: p.voice_path ? (signedVoiceByPath.get(p.voice_path) ?? null) : null,
    }));

  const folders: Folder[] = foldersRes.data.map((f) => ({
    id: f.id,
    name: f.name,
    createdAt: new Date(f.created_at).getTime(),
    color: f.color,
  }));

  return { shots, folders };
}
