import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/**
 * Supabase on the server, carrying the caller's session.
 *
 * `cookies()` is async in Next 16 — synchronous access was removed, not just
 * deprecated. And cookies cannot be written during a Server Component render,
 * only from a Server Action or Route Handler, so `setAll` swallows that failure:
 * when it happens the session is simply left to be refreshed by the proxy on
 * the next request.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component render — the proxy refreshes the session instead.
        }
      },
    },
  });
}
