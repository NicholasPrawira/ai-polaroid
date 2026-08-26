"use client";

/**
 * Turning "where am I" into a place name the user would actually write.
 *
 * Two steps, and they fail independently. The browser gives coordinates;
 * OpenStreetMap's Nominatim turns those into a name. Nominatim is used
 * because it needs no API key and no account — the alternative (Google,
 * Mapbox) would put a billable secret in a client-side app that has no
 * server route to proxy through.
 *
 * The coordinates are never stored. They exist only long enough to be
 * exchanged for a name, which is what `photos.location` holds — so a photo
 * the user exports or shares later doesn't carry precise GPS with it.
 */

export const NOMINATIM_ORIGIN = "https://nominatim.openstreetmap.org";

/** Nominatim asks callers to identify themselves and rate-limits to roughly
 *  one call a second. Both are honoured: this only ever fires on an explicit
 *  button press, never on a timer or per-photo. */
const REVERSE_URL = `${NOMINATIM_ORIGIN}/reverse`;

/** Distinguishes "user said no" from "it broke", because the two want very
 *  different messages — one is a settings problem, the other is retryable. */
export type LocateFailure = "denied" | "unavailable" | "timeout" | "failed";

export class LocateError extends Error {
  constructor(public kind: LocateFailure) {
    super(kind);
    this.name = "LocateError";
  }
}

export function locateErrorMessage(kind: LocateFailure): string {
  switch (kind) {
    case "denied":
      return "Location permission is off. Turn it on in your browser settings, or type the place instead.";
    case "unavailable":
      return "Couldn't get a location fix. Try again, or type the place instead.";
    case "timeout":
      return "Getting your location took too long. Try again, or type the place instead.";
    default:
      return "Couldn't look up that place. Type it in instead.";
  }
}

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new LocateError("unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        // Numeric codes rather than the named constants: the constants live
        // on GeolocationPositionError, which isn't reliably available as a
        // global to reference at runtime in every browser.
        if (err.code === 1) reject(new LocateError("denied"));
        else if (err.code === 3) reject(new LocateError("timeout"));
        else reject(new LocateError("unavailable"));
      },
      {
        // A street-level fix is far more precision than a place name needs,
        // and asking for it costs battery and seconds. Low accuracy also
        // lets the device answer from wifi/cell rather than waking the GPS.
        enableHighAccuracy: false,
        timeout: 10_000,
        // A fix from the last few minutes is fine for "where am I standing".
        maximumAge: 300_000,
      },
    );
  });
}

/**
 * Picks the most recognisable name out of a Nominatim address, preferring
 * what a person would say out loud. Someone at a named venue says the venue;
 * otherwise they say the neighbourhood or the city — not the full postal
 * address Nominatim returns in `display_name`.
 */
function placeName(data: {
  name?: string;
  address?: Record<string, string>;
}): string | null {
  const a = data.address ?? {};

  // Nominatim returns administrative subdivision codes as `neighbourhood`
  // in some countries — Indonesian RT/RW, for instance, come back as
  // "RW 02". They are real data but meaningless as a place name, so they
  // are skipped in favour of the next level up. Verified against live
  // responses for Jakarta, which returned exactly this.
  const isAdminCode = (v: string) =>
    /^(RT|RW|RT\/RW)[\s.]*[\d/.]*$/i.test(v.trim()) || /^\d+$/.test(v.trim());

  const pick = (...vals: (string | undefined)[]) => {
    for (const v of vals) {
      const t = v?.trim();
      if (t && !isAdminCode(t)) return t;
    }
    return null;
  };

  const specific = pick(
    data.name,
    a.tourism,
    a.attraction,
    a.amenity,
    a.building,
    a.neighbourhood,
    a.suburb,
    a.village,
    a.town,
  );
  const area = pick(a.city, a.town, a.county, a.state);

  // "Tosari, Pasuruan" reads better than either half alone — but never
  // repeat a name that's already the area ("Jakarta, Jakarta"), and never
  // let the pair grow past what the column accepts.
  if (specific && area && specific !== area) {
    const pair = `${specific}, ${area}`;
    if (pair.length <= 120) return pair;
  }
  return specific || area || pick(a.country);
}

/**
 * The whole flow: ask the browser where we are, then ask Nominatim what
 * that place is called. Throws `LocateError` so the caller can tell the
 * user which half failed.
 */
export async function detectPlaceName(signal?: AbortSignal): Promise<string> {
  const pos = await currentPosition();
  const { latitude, longitude } = pos.coords;

  const url = new URL(REVERSE_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  // Roughly neighbourhood level. Full detail would return a house number,
  // which is both more precision than the UI shows and more than a user
  // would want stamped on a photo.
  url.searchParams.set("zoom", "14");
  url.searchParams.set("addressdetails", "1");

  let res: Response;
  try {
    res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (err) {
    // An aborted request is the caller unmounting, not a failure to report.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new LocateError("failed");
  }
  if (!res.ok) throw new LocateError("failed");

  const data = await res.json().catch(() => null);
  const name = data ? placeName(data) : null;
  if (!name) throw new LocateError("failed");
  return name;
}
