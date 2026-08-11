import type { NextConfig } from "next";

/** Origin the browser talks to directly: auth, PostgREST, and the signed
 *  storage URLs photos and voice notes are served from. Read from the same
 *  env var the clients use rather than hardcoded, so pointing at a
 *  different project needs no code change. */
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
})();

/**
 * Content-Security-Policy. Every directive here was verified in Chromium
 * against the real app — capture, upload, develop, voice record and
 * playback, gallery, auth — because a wrong directive fails silently,
 * which is worse than no policy at all.
 *
 * `script-src` keeps `'unsafe-inline'`, which is a deliberate trade rather
 * than an oversight. The strict alternative is a per-request nonce, and
 * that was built and measured first: Next 16 ships hydration and streaming
 * data as inline `<script>` tags, so without a nonce the browser blocked
 * 40 of them and hydration died outright ("Connection closed") — pages
 * rendered but ignored input. Adding the nonce didn't fix it either, since
 * Next can only stamp nonces while server-rendering, and every page here
 * is statically prerendered; `'strict-dynamic'` then also disabled
 * host-allowlisting and blocked the static chunks as well. Making it work
 * means opting all 10 static pages into dynamic rendering, giving up CDN
 * caching and raising TTFB on the landing page to harden against an XSS
 * hole the audit didn't find. Not worth it at this size.
 *
 * The directives that do the real work here are the ones that still bite:
 * `connect-src`/`img-src`/`media-src` pin network access to this origin
 * plus Supabase, so injected code can't exfiltrate to an attacker's host;
 * `object-src 'none'` and `base-uri 'self'` close two classic injection
 * vectors; `frame-ancestors 'none'` blocks framing.
 *
 * `style-src` allows inline because the UI computes styles at runtime for
 * the carousel transforms, flip cards and the origin-fill button, which
 * React writes as inline `style` attributes.
 */
const csp = [
  "default-src 'self'",
  // See the note above: strict script-src needs dynamic rendering.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // next/font/google self-hosts at build time, so no external font origin.
  "font-src 'self'",
  // blob:/data: cover canvas captures, the inline-SVG grain, and downloads.
  `img-src 'self' blob: data: ${supabaseOrigin}`.trimEnd(),
  // Voice notes play from a signed Supabase URL; blob: is fresh audio.
  `media-src 'self' blob: ${supabaseOrigin}`.trimEnd(),
  // `data:` is required, not incidental: persistPhoto turns a capture into
  // a Blob via `fetch(dataUrl)` (dataUrlToBlob in lib/supabase/photos.ts),
  // and fetch is governed by connect-src. Without it every save fails —
  // and fails *quietly*, because finalizeShot falls back to a local-only
  // shot, so the photo shows on screen and only vanishes on refresh.
  // Caught by exercising the real pipeline in a browser, not by reading.
  `connect-src 'self' data: ${supabaseOrigin}`.trimEnd(),
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/**
 * Response headers applied to every route.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Superseded by `frame-ancestors 'none'` above in modern browsers; kept
  // for older ones that don't implement that directive.
  { key: "X-Frame-Options", value: "DENY" },
  // Stops browsers second-guessing a declared Content-Type, which is what
  // turns an "image" upload that's really HTML into stored XSS.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak the full URL (which can carry a `next=` path or a signed
  // storage URL) to third-party origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app asks for the camera and microphone itself, so those stay
  // self-enabled; everything else commonly abused is switched off.
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()",
  },
  // Force HTTPS for two years including subdomains. Safe here because the
  // app is HTTPS-only in production; browsers ignore it over plain HTTP,
  // so local dev is unaffected.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
