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
  /**
   * Pulls the midtones down. The preset ships an identity curve because it was
   * authored against a photograph; these scenes are lighter and flatter, and
   * without this most of the frame lands above the glyph threshold and simply
   * isn't drawn.
   */
  toneCurve: [
    { x: 0, y: 0 },
    { x: 0.45, y: 0.24 },
    { x: 0.8, y: 0.66 },
    { x: 1, y: 1 },
  ],
  /**
   * Darkens cells where luminance changes fast, which is what makes structure
   * legible in a photograph whose subject is one broad tone. A hillside of
   * grass has almost no luminance range once desaturated; its ridges and paths
   * are edges, not tones, and without this they render as an even field.
   */
  edgeEmphasis: 55,
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
