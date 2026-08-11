"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safeRedirect";

export type AuthState = { error: string } | null;

function siteUrl(): string {
  // Set NEXT_PUBLIC_SITE_URL in production; falls back to localhost for dev,
  // where Supabase's redirect allow-list is already configured for it.
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  // Attacker-controllable via `/login?next=…`, and `redirect()` honours
  // absolute URLs — so this has to be narrowed to a same-origin path.
  const next = safeRedirectPath(formData.get("next")?.toString());

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };

  redirect(next);
}

export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl()}/auth/confirm?next=/camera` },
  });
  if (error) return { error: error.message };

  // A session here means email confirmation is off and the account is
  // already active. With it on, there's no session yet — same call, same
  // response shape either way, so branch on what actually came back rather
  // than assuming project config.
  if (data.session) redirect("/camera");
  redirect("/signup/check-email");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/update-password`,
  });
  // Don't reveal whether the address has an account — same message either way.
  if (error) return { error: "Something went wrong. Try again." };

  redirect("/forgot-password/check-email");
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) return { error: "Passwords don't match." };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/camera");
}
