/**
 * The origin the caller actually used.
 *
 * `request.nextUrl.origin` is not it: behind `next start` it reports the
 * configured hostname rather than the requested one, so a visitor on
 * 127.0.0.1 gets redirected to localhost. That is a different origin as far as
 * cookies are concerned, which silently drops the session that was just
 * established — the sign-in link appears to work and then lands on the login
 * page again.
 */
export function originOf(headers: Headers): string | null {
  const explicit = headers.get("origin");
  if (explicit) return explicit;

  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return null;

  const proto = headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
