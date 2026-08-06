"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { Folder, Shot } from "@/lib/types";

type Client = SupabaseClient<Database>;

const BUCKET = "photos";
/** Signed URLs are re-issued on every load rather than cached, so this only
 *  needs to outlive one browsing session. */
const SIGNED_URL_TTL_S = 60 * 60;

function extensionFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
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
    .insert({ id, user_id: userId, folder_id: folderId, storage_path: path })
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

  const shots: Shot[] = photosRes.data
    .filter((p) => signedByPath.has(p.storage_path))
    .map((p) => ({
      id: p.id,
      imageUrl: signedByPath.get(p.storage_path)!,
      createdAt: new Date(p.created_at).getTime(),
      folderId: p.folder_id,
      caption: p.caption,
      storagePath: p.storage_path,
    }));

  const folders: Folder[] = foldersRes.data.map((f) => ({
    id: f.id,
    name: f.name,
    createdAt: new Date(f.created_at).getTime(),
    color: f.color,
  }));

  return { shots, folders };
}
