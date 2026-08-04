import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Where the emailed sign-in link lands. Exchanging the token for a session sets
 * cookies, which is why this is a Route Handler — a Server Component render
 * cannot write them.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?error=link`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    // Expired or already used. Sending them back to ask for a fresh one is more
    // useful than an error page with nothing to do on it.
    return NextResponse.redirect(`${origin}/login?error=expired`);
  }

  return NextResponse.redirect(origin);
}
