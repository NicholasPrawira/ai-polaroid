import { createBrowserClient } from "@supabase/ssr";

/** Supabase in the browser. Only ever sees the publishable key. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
