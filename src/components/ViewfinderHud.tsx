"use client";

/**
 * Framing guides plus a single REC indicator.
 *
 * The readouts a real camera would show — shutter, aperture, ISO, exposure
 * compensation, white balance, histogram — are deliberately absent.
 * getUserMedia exposes none of them, so any figure here would be invented and
 * permanently frozen. One blinking dot carries the same "this is a camera"
 * feeling without pretending to report anything.
 */
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

      <div className="absolute right-4 bottom-3 flex items-center gap-1.5">
        <span className="animate-rec block h-1.5 w-1.5 rounded-full bg-[var(--color-error)]" />
        <span className="type-viewfinder-label opacity-85">rec</span>
      </div>
    </div>
  );
}
