"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type WaitlistState = { error: string } | null;

/** Deliberately loose — the real check is the `email` input type plus
 *  Postgres's own constraint. This only catches obvious junk before it
 *  costs a round trip. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const source = String(formData.get("source") ?? "landing").slice(0, 64);

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { error: "That doesn't look like an email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("waitlist")
    .insert({ email, source });

  // 23505 is unique_violation: the address is already on the list. That's a
  // success from the visitor's point of view, and reporting it back would
  // turn the form into an "is this person signed up?" oracle.
  if (error && error.code !== "23505") {
    // The visitor gets a generic message — Supabase's own error text can name
    // tables and constraints. Log the real one so the cause is visible in the
    // server output instead of being swallowed.
    console.error("waitlist insert failed", error.code, error.message);
    return { error: "Something went wrong. Try again." };
  }

  redirect("/waitlist/thanks");
}
