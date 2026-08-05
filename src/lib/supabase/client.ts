import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * For Client Components. `createBrowserClient` is already a singleton, so
 * calling this more than once is cheap — it returns the same instance.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
