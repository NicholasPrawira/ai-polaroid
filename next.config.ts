import type { NextConfig } from "next";

/**
 * Response headers applied to every route.
 *
 * Deliberately limited to headers that can't break this app's behaviour.
 * A `Content-Security-Policy` is the notable omission: the camera pipeline
 * relies on `blob:`/`data:` image sources, Tailwind emits inline styles,
 * and Supabase opens cross-origin XHR + WebSocket connections, so a CSP
 * has to be authored against all of that and verified in a real browser —
 * shipping a guessed one would silently break capture rather than fail
 * loudly. Tracked as follow-up work instead of half-done here.
 */
const securityHeaders = [
  // The app never needs to be framed; this blocks clickjacking outright.
  // (frame-ancestors in a CSP would supersede it, if one is added later.)
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
