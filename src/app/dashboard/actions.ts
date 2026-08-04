"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Dashboard mutations.
 *
 * Each one re-checks admin status against the database. Rendering the dashboard
 * only for admins is not a permission check — a Server Action is a POST anyone
 * can send. The RLS policies on `promo_codes` enforce it a second time, and
 * `admin_grant_credits` a third; this is the layer that gives a usable error.
 */

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!data?.is_admin) throw new Error("Not authorised.");
  return { supabase, user };
}

export type CodeFormState = { ok: boolean; message: string };

/** Ambiguous characters are left out so a code can be read aloud. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export async function createPromoCode(
  _prev: CodeFormState,
  formData: FormData,
): Promise<CodeFormState> {
  const { supabase, user } = await requireAdmin();

  const raw = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const code = raw || generateCode();

  if (code.length < 4 || code.length > 32) {
    return { ok: false, message: "A code needs 4–32 letters or digits." };
  }

  const credits = Number(formData.get("credits"));
  if (!Number.isInteger(credits) || credits < 1) {
    return { ok: false, message: "Credits must be a whole number above zero." };
  }

  const maxRaw = String(formData.get("max_redemptions") ?? "").trim();
  const maxRedemptions = maxRaw === "" ? null : Number(maxRaw);
  if (
    maxRedemptions !== null &&
    (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)
  ) {
    return { ok: false, message: "Leave the limit blank for unlimited." };
  }

  const expiresRaw = String(formData.get("expires_at") ?? "").trim();
  const expiresAt = expiresRaw === "" ? null : new Date(expiresRaw);
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return { ok: false, message: "That expiry date is not a date." };
  }

  const targetEmail =
    String(formData.get("target_email") ?? "")
      .trim()
      .toLowerCase() || null;

  const note = String(formData.get("note") ?? "").trim() || null;

  const { error } = await supabase.from("promo_codes").insert({
    code,
    credits,
    max_redemptions: maxRedemptions,
    expires_at: expiresAt?.toISOString() ?? null,
    target_email: targetEmail,
    note,
    created_by: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: `${code} already exists.` };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard");
  return {
    ok: true,
    message: targetEmail
      ? `${code} created as a voucher for ${targetEmail}.`
      : `${code} created.`,
  };
}

export async function setCodeActive(codeId: string, active: boolean) {
  const { supabase } = await requireAdmin();
  await supabase.from("promo_codes").update({ active }).eq("id", codeId);
  revalidatePath("/dashboard");
}

/**
 * Deleting a code also deletes its redemption records, which is why claimed
 * codes are deactivated instead — the ledger should stay explainable.
 */
export async function deleteCode(codeId: string) {
  const { supabase } = await requireAdmin();
  await supabase.from("promo_codes").delete().eq("id", codeId);
  revalidatePath("/dashboard");
}

export type GrantState = { ok: boolean; message: string };

/** Hands credits to somebody directly, with no code to type in. */
export async function grantCredits(
  _prev: GrantState,
  formData: FormData,
): Promise<GrantState> {
  const { supabase } = await requireAdmin();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const credits = Number(formData.get("credits"));

  if (!email) return { ok: false, message: "Pick somebody first." };
  if (!Number.isInteger(credits) || credits === 0) {
    return { ok: false, message: "Enter a whole number, positive or negative." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (!profile) {
    return { ok: false, message: `No account for ${email}.` };
  }

  const { data, error } = await supabase.rpc("admin_grant_credits", {
    p_user_id: profile.id,
    p_credits: credits,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard");
  return {
    ok: true,
    message: `${email} now has ${data} credits.`,
  };
}
