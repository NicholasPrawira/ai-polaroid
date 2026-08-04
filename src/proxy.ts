import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 renamed the `middleware` file convention to `proxy` — this app
// is on 16.2.12, so the export must be named `proxy`, not `middleware`.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and images, so the session
     * cookie stays fresh on every navigation without doing wasted work on
     * files that never touch Supabase.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
