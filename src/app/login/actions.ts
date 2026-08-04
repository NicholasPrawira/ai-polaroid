"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { originOf } from "@/lib/origin";

export type LoginState = { status: "idle" | "sent" | "error"; message: string };

/**
 * Magic link, no password.
 *
 * A password would mean owning a reset flow, a hashing choice, and a breach
 * surface, all to guard a photo album. The mailbox is already the recovery
 * factor for any password we might set, so this just uses it directly.
 */
export async function requestMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { status: "error", message: "That does not look like an email." };
  }

  // Not every client sends `origin`, and a relative redirect would be rejected
  // by Supabase, so fall back to the forwarded host before giving up.
  const origin = originOf(await headers());

  if (!origin) {
    return { status: "error", message: "Could not work out where to send you." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  // Deliberately the same answer whether or not the address has an account —
  // otherwise this form becomes a way to test who is registered.
  return {
    status: "sent",
    message: "Check your inbox for a sign-in link.",
  };
}
