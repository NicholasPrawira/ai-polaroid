"use client";

/**
 * Framing guides and corner brackets. Nothing else.
 *
 * The readouts a real camera would show — shutter, aperture, ISO, exposure
 * compensation, white balance, histogram — were removed because getUserMedia
 * exposes none of them, so every figure was invented and permanently frozen.
 * The blinking REC dot outlasted them for a while as the one piece of pure
 * decoration, and has now gone the same way. What is left actually does
 * something: the thirds guides help you frame the shot.
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

    </div>
  );
}
