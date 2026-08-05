"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/admin";

/** Every mutation re-checks this itself rather than trusting the page-level
 *  and proxy-level gates — a Server Action is a public endpoint regardless
 *  of which page renders the form that calls it. */
async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.email !== ADMIN_EMAIL) {
    throw new Error("Not authorized.");
  }
  return supabase;
}

export async function setPro(userId: string, isPro: boolean) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ is_pro: isPro })
    .eq("user_id", userId);
  if (error) throw error;
  revalidatePath("/admin");
}

export async function addPhotoQuota(userId: string, amount: number) {
  if (!Number.isInteger(amount) || amount === 0) return;
  const supabase = await requireAdmin();

  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("photo_quota")
    .eq("user_id", userId)
    .single();
  if (fetchError) throw fetchError;

  const next = Math.max(0, profile.photo_quota + amount);
  const { error } = await supabase
    .from("profiles")
    .update({ photo_quota: next })
    .eq("user_id", userId);
  if (error) throw error;
  revalidatePath("/admin");
}
