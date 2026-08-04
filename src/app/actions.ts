"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PHOTO_BUCKET } from "@/lib/data";

/**
 * Mutations for the camera app.
 *
 * A Server Action is a public POST endpoint — rendering the UI that calls it is
 * not a permission check. So every action re-derives the caller from the
 * session and never trusts an owner id from the client. Ownership is checked
 * again by RLS underneath, which is what makes a forged id inert rather than
 * merely unlikely.
 */

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return { supabase, user };
}

export async function createFolder(name: string): Promise<string | null> {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return null;

  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("folders")
    .insert({ owner_id: user.id, name: trimmed })
    .select("id")
    .single();

  if (error) return null;

  revalidatePath("/");
  return data.id;
}

export async function moveShot(shotId: string, folderId: string | null) {
  const { supabase } = await requireUser();

  // No owner filter needed for correctness — the RLS policy on `photos`
  // restricts the update to rows this session owns — but stating it keeps the
  // intent readable at the call site.
  await supabase
    .from("photos")
    .update({ folder_id: folderId })
    .eq("id", shotId);

  revalidatePath("/");
}

/**
 * Deletes a photograph and both of its files.
 *
 * The row goes last. If the storage removal fails we still have the row
 * pointing at the objects, which is recoverable; a deleted row with orphaned
 * files is not.
 */
export async function deleteShot(shotId: string) {
  const { supabase } = await requireUser();

  const { data: photo } = await supabase
    .from("photos")
    .select("raw_path, developed_path")
    .eq("id", shotId)
    .maybeSingle();

  if (!photo) return;

  const paths = [photo.raw_path, photo.developed_path].filter(
    (p): p is string => Boolean(p),
  );
  if (paths.length > 0) {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
    if (error) throw new Error("Could not delete the photo files.");
  }

  await supabase.from("photos").delete().eq("id", shotId);

  revalidatePath("/");
}

export type RedeemResult = {
  ok: boolean;
  message: string;
  /** The balance after a successful claim, so the UI need not guess. */
  credits?: number;
};

export async function redeemCode(
  _prev: RedeemResult,
  formData: FormData,
): Promise<RedeemResult> {
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();

  if (!code) return { ok: false, message: "Enter a code." };

  const { supabase } = await requireUser();

  // All the validation — active, unexpired, unclaimed, addressed to this
  // account — happens inside the function, under a row lock.
  const { data, error } = await supabase.rpc("redeem_promo_code", {
    p_code: code,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  const result = data as { added?: number; credits?: number } | null;
  const added = result?.added ?? 0;
  return {
    ok: true,
    message: `${added} photo ${added === 1 ? "credit" : "credits"} added.`,
    credits: result?.credits,
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect("/login");
}
