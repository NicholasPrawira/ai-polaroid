import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { originOf } from "@/lib/origin";

/**
 * Next 16 renamed Middleware to Proxy: the file is `proxy.ts` and the export is
 * `proxy`. It runs on the Node.js runtime, which cannot be changed.
 *
 * Two jobs, in this order:
 *
 * 1. Refresh the Supabase session cookie. Server Components cannot write
 *    cookies, so if this did not happen here the access token would expire and
 *    never renew.
 * 2. An *optimistic* redirect for signed-out visitors. Optimistic because it
 *    only reads the session — the real authorisation lives next to the data, in
 *    RLS and in the checks each page and route makes for itself.
 */

/**
 * Reachable without a session. Everything else requires one.
 *
 * `/` is public because it serves the landing page to signed-out visitors and
 * the camera to everyone else; the page itself decides which, from the session.
 */
const PUBLIC_PATHS = ["/", "/login", "/auth"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Nothing may run between creating the client and this call: it is what
  // refreshes the token, and any early return above it logs users out at random.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

  // API routes answer for themselves — a signed-out fetch should get JSON with
  // a 401, not an HTML login page it cannot parse.
  // Redirect back to the host the visitor is actually on. `nextUrl` reports the
  // configured hostname, and bouncing somebody to a different origin loses the
  // session cookie that was set for theirs.
  const origin = originOf(request.headers) ?? request.nextUrl.origin;

  if (!user && !isPublic && !path.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  if (user && path === "/login") {
    return NextResponse.redirect(new URL("/", origin));
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next's own assets and static image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
