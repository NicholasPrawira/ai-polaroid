import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safeRedirect";

/**
 * Landing point for every emailed auth link — signup confirmation and
 * password reset both route here, distinguished by `type`. Supabase's link
 * carries a `token_hash` rather than a session; this exchanges it for one.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Same open-redirect exposure as the login action: this lands straight
  // from an emailed link, so `next` is fully attacker-authored.
  const next = safeRedirectPath(searchParams.get("next"));

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) redirect(next);
  }

  redirect("/login?error=link-expired");
}
