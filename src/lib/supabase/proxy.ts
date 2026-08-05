import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_EMAIL } from "@/lib/admin";

const PROTECTED_PREFIXES = ["/camera", "/update-password", "/admin"];
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

/**
 * Refreshes the Auth token on every request and guards protected routes.
 *
 * Must use `getClaims()`, not `getSession()` — the session object is read
 * from the cookie as-is and isn't guaranteed to be revalidated here, so a
 * page guard built on it can be spoofed. `getClaims()` verifies the JWT
 * signature against the project's published keys on every call.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
  const isAuthPage = AUTH_PAGES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

  if (isProtected && !signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Extra boundary on top of the page-level check in src/app/admin — the
  // real enforcement is the RLS policies driven by private.is_admin(), but
  // bouncing here means a non-admin never even sees the admin shell render.
  const isAdminOnly = path === "/admin" || path.startsWith("/admin/");
  if (isAdminOnly && signedIn && data?.claims?.email !== ADMIN_EMAIL) {
    const url = request.nextUrl.clone();
    url.pathname = "/camera";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isAuthPage && signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/camera";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: return `response` as-is. Creating a new NextResponse here
  // would drop the refreshed Auth cookies, silently logging the user out.
  return response;
}
