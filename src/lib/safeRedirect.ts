/**
 * Narrows a caller-supplied `next` destination to a same-origin path.
 *
 * Both the login form and the emailed-link handler take a redirect target
 * straight off the URL, and `redirect()` in Next 16 forwards absolute URLs
 * to external sites ("redirect also accepts absolute URLs and can be used
 * to redirect to external links" — next/dist/docs .../redirect.md). Without
 * this, `/login?next=https://evil.example` sends the user off-site *after*
 * a successful sign-in, which is exactly the shape a credential-phishing
 * page wants: the victim really did just authenticate, so the fake
 * "session expired, sign in again" screen that greets them is believable.
 *
 * Anything that isn't a plain absolute path falls back to `/camera`:
 *   - `https://evil.example`  — absolute URL, different origin
 *   - `//evil.example`        — protocol-relative; the browser treats this
 *                               as a host, not a path
 *   - `/\evil.example`        — backslash variants some parsers normalise
 *                               into `//`
 *   - `javascript:…`          — scheme payload rather than a route
 *
 * Kept deliberately allow-list shaped (must start with a single `/`, no
 * scheme, no host) rather than blocking known-bad prefixes, so a bypass
 * has to defeat the rule itself instead of an incomplete denylist.
 */
export const DEFAULT_REDIRECT = "/camera";

export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT,
): string {
  if (!candidate) return fallback;

  // Reject anything with a scheme or control/whitespace characters, which
  // browsers and URL parsers strip or normalise in inconsistent ways.
  if (/[\x00-\x20\\]/.test(candidate)) return fallback;
  if (!candidate.startsWith("/")) return fallback;
  // `//host` and `/\host` are authority references, not paths.
  if (candidate.startsWith("//")) return fallback;

  return candidate;
}
