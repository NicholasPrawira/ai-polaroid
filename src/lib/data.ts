import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Folder, Profile, Shot } from "@/lib/types";

/** How long a minted photo URL stays good for. */
export const SIGNED_URL_TTL = 60 * 60;

export const PHOTO_BUCKET = "photos";

/**
 * The data access layer.
 *
 * Every read goes through here so the ownership check sits next to the data
 * rather than in the UI. The proxy's redirect is an optimistic convenience; it
 * is not what keeps one account's photographs away from another. RLS does that,
 * and these functions run under the caller's session so RLS applies.
 */

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("email, credits, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  // The row is created by a trigger on signup; if it is somehow missing, treat
  // the account as having nothing rather than inventing a balance.
  if (!data) return { email: user.email ?? null, credits: 0, isAdmin: false };

  return {
    email: data.email ?? user.email ?? null,
    credits: data.credits,
    isAdmin: data.is_admin,
  };
}

export async function getFolders(): Promise<Folder[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("folders")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });

  return (data ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    createdAt: new Date(f.created_at).getTime(),
  }));
}

/**
 * Developed photographs, newest first.
 *
 * Rows whose develop failed or is still running are left out: the gallery shows
 * prints, and there is nothing to show for a photo with no developed file yet.
 * The raw capture is still on disk either way.
 */
export async function getShots(): Promise<Shot[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("photos")
    .select("id, folder_id, developed_path, taken_at")
    .eq("status", "done")
    .not("developed_path", "is", null)
    .order("taken_at", { ascending: false });

  const rows = data ?? [];
  if (rows.length === 0) return [];

  // One round trip for every URL rather than one per photo.
  const { data: signed } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.developed_path as string),
      SIGNED_URL_TTL,
    );

  const urls = new Map(
    (signed ?? [])
      .filter((s) => s.signedUrl && !s.error)
      .map((s) => [s.path, s.signedUrl] as const),
  );

  return rows.flatMap((row) => {
    const url = urls.get(row.developed_path as string);
    // A row whose file cannot be signed would render as a broken frame, which
    // reads as data loss. Leaving it out is the honest failure.
    if (!url) return [];
    return [
      {
        id: row.id,
        imageUrl: url,
        createdAt: new Date(row.taken_at).getTime(),
        folderId: row.folder_id,
      },
    ];
  });
}
