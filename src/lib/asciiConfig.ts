/**
 * The "Forest" ASCII preset, transcribed from the supplied JSON.
 *
 * Only the parameters this preset actually exercises are typed here. The full
 * spec carries ~25 render modes and nine post-effects; this configuration pins
 * one path through it — characters, grayscale, tilt-shift, three post-effects,
 * shimmer — so the renderer implements that path rather than a dispatch table
 * of modes nothing selects.
 */
export type AsciiConfig = typeof ASCII_FOREST;

export const ASCII_FOREST = {
  renderMode: "characters",
  bgMode: "blur",
  bgBlur: 2,
  bgOpacity: 90,

  cellSize: 10,
  coverage: 100,
  invert: false,
  charSet: "standard",

  brightness: 0,
  contrast: 128,
  edgeEmphasis: 0,
  density: 0,

  saturation: 0,
  grayscale: 100,

  blurType: "tilt",
  blurAmount: 30,
  tiltFocus: 35,
  tiltPosition: 50,
  tiltFeather: 15,

  pfx: {
    chromatic: { enabled: true, intensity: 20 },
    halftone: { enabled: true, intensity: 20 },
    filmDust: { enabled: true, intensity: 20 },
  },

  animated: true,
  animStyle: "shimmer",
  animSpeed: { enabled: true, intensity: 100 },
  animIntensity: { enabled: true, intensity: 60 },
} as const;

/** Classic luminance ramp, densest first. */
export const CHAR_SETS: Record<string, string> = {
  standard: "@%#*+=-:. ",
  blocks: "█▓▒░ ",
  minimal: "#+-. ",
};
