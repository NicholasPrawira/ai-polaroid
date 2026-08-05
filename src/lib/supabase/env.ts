/**
 * The Supabase connection details, or a legible failure.
 *
 * Without this, a deployment missing these variables answers every single
 * request with "Your project's URL and Key are required to create a Supabase
 * client!" — thrown from inside the proxy, so every page is a 500 and nothing
 * in the message says which variable is missing or where to put it. It reads
 * like a broken build rather than an unconfigured one.
 *
 * The `NEXT_PUBLIC_` prefix matters for the fix: these are inlined into the
 * bundle at build time, so adding them in the hosting dashboard does nothing
 * until something triggers a rebuild.
 */
export function supabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !key && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ].filter(Boolean);

    const them = missing.length > 1 ? "them" : "it";
    throw new Error(
      `Supabase is not configured: ${missing.join(" and ")} ` +
        `${missing.length > 1 ? "are" : "is"} missing. Set ${them} in the ` +
        `deployment's environment variables and redeploy — these are inlined ` +
        `at build time, so an already-running deployment will not pick ${them} up.`,
    );
  }

  return { url, key };
}
