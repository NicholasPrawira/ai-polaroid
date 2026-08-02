"use client";

/**
 * Decorative DSLR instrumentation (PRD 5.1a).
 *
 * These readings are FAKE and intentionally static. getUserMedia exposes only a
 * video stream — no shutter speed, aperture, or ISO is available from a phone
 * camera on the web. The HUD exists to sell the "operating a mechanical camera"
 * feeling from the design system. Static numbers are correct behaviour, not a bug.
 */

const TOP_LEFT = "1/500s  F8.0  ISO400";
const BOTTOM = ["1/500", "F 8.0", "ISO 400", "-0.3", "AWB"];

export function ViewfinderHud() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-white">
      {/* Rule-of-thirds guides — 1px hairlines, no fills. */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/3 right-0 left-0 h-px bg-white" />
        <div className="absolute top-2/3 right-0 left-0 h-px bg-white" />
        <div className="absolute top-0 bottom-0 left-1/3 w-px bg-white" />
        <div className="absolute top-0 bottom-0 left-2/3 w-px bg-white" />
      </div>

      {/* Corner brackets */}
      <div className="absolute top-3 left-3 h-4 w-4 border-t border-l border-white/70" />
      <div className="absolute top-3 right-3 h-4 w-4 border-t border-r border-white/70" />
      <div className="absolute bottom-3 left-3 h-4 w-4 border-b border-l border-white/70" />
      <div className="absolute right-3 bottom-3 h-4 w-4 border-r border-b border-white/70" />

      <div className="absolute top-2.5 left-4 type-viewfinder-label opacity-85 drop-shadow">
        {TOP_LEFT}
      </div>
      <div className="absolute top-2.5 right-4 type-viewfinder-label opacity-85 drop-shadow">
        JPEG
      </div>

      {/* Histogram — a fixed silhouette, not computed from the stream. */}
      <div className="absolute top-8 right-4 flex h-6 w-16 items-end gap-px opacity-60">
        {[3, 6, 10, 16, 22, 24, 19, 14, 17, 21, 12, 7, 4, 8, 5, 2].map(
          (h, i) => (
            <div
              key={i}
              className="flex-1 bg-white"
              style={{ height: `${(h / 24) * 100}%` }}
            />
          ),
        )}
      </div>

      <div className="absolute right-4 bottom-8 left-4 flex items-center justify-between type-viewfinder-label opacity-85 drop-shadow">
        {BOTTOM.map((v) => (
          <span key={v}>{v}</span>
        ))}
      </div>

      <div className="absolute right-4 bottom-3 flex items-center gap-1.5">
        <span className="animate-rec block h-1.5 w-1.5 rounded-full bg-[var(--color-error)]" />
        <span className="type-viewfinder-label opacity-85">rec</span>
      </div>
    </div>
  );
}
