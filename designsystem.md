---
name: Analog Minimalist
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e4e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#444748'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0ef'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#5e5f5c'
  on-secondary: '#ffffff'
  secondary-container: '#e0e0dc'
  on-secondary-container: '#626360'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#2b1700'
  on-tertiary-container: '#b97416'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#e3e2df'
  secondary-fixed-dim: '#c7c7c3'
  on-secondary-fixed: '#1b1c1a'
  on-secondary-fixed-variant: '#464744'
  tertiary-fixed: '#ffdcbb'
  tertiary-fixed-dim: '#ffb869'
  on-tertiary-fixed: '#2b1700'
  on-tertiary-fixed-variant: '#673d00'
  background: '#fcf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e1'
typography:
  viewfinder-label:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.08em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  timestamp-sm:
    fontFamily: Courier Prime
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: -0.02em
  timestamp-lg:
    fontFamily: Courier Prime
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 20px
  button-text:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  viewfinder-margin: 16px
  control-gap: 24px
  stack-sm: 8px
  stack-md: 16px
---

## Brand & Style
The design system is built on the concept of "Digital Soul, Analog Body." It targets creative enthusiasts who value the slow, intentional process of film photography but require the precision of modern mobile interfaces. The emotional response is one of nostalgic warmth, tactility, and focused immersion.

The style is **Analog Minimalism**. It rejects the flatness of standard SaaS interfaces in favor of subtle grain textures, physical-depth shadows, and a layout that mimics the framing of a physical viewfinder. Every interaction should feel like operating a high-end mechanical camera—deliberate, high-quality, and unmistakably physical.

## Colors
The palette is rooted in the physical materials of instant photography. 

- **Primary (Charcoal):** Used for critical UI controls, glyphs, and high-contrast text. It represents the matte plastic and metal of a vintage camera body.
- **Secondary (Polaroid White):** A warm, slightly desaturated off-white used for the main canvas and film frames. It avoids the harshness of #FFFFFF to mimic aged paper stock.
- **Tertiary (Warm Film):** A rich, amber-toned accent used sparingly for active states, record indicators, or "magic" AI moments.
- **Neutral:** Mid-tone grays are used for secondary information and iconography, ensuring the hierarchy remains focused on the viewfinder and the captured image.

## Typography
This design system employs a dual-font strategy to bridge the gap between UI and artifact.

1.  **Inter:** Used for all functional UI elements. It provides the "Minimalist" legibility required for camera settings, menus, and navigation. Use uppercase with generous letter spacing for labels to evoke technical camera markings.
2.  **Courier Prime:** Acts as the "handwritten" surrogate for timestamps and metadata on the film frames. It represents the mechanical imprint of a date-back camera or the charm of a felt-tip pen on a Polaroid border.

**Scale:** Keep UI type small and precise. The image is the hero; the type is the instrumentation.

## Layout & Spacing
The layout follows a **Fixed-Content/Fluid-Safe-Area** model. The viewfinder remains a fixed aspect ratio (typically 1:1 or 4:5 to match film formats), while the controls occupy the periphery.

- **The Viewfinder:** Must be centered with a minimum margin of 16px from the device edge.
- **The Control Bar:** A dedicated zone at the bottom of the screen for the shutter and primary mode switches, using a 3-column grid for balance.
- **Rhythm:** Use an 8px base grid for all component spacing. Avoid overcrowding; the "Analog Minimalist" aesthetic relies on the negative space around the image.

## Elevation & Depth
Depth is created through "Tonal Inset" and "Soft Stacking" rather than traditional heavy drop shadows.

- **The Canvas:** The background should have a subtle noise/grain overlay (opacity 3-5%) to prevent it from looking like a flat digital hex code.
- **The Film Frame:** Uses a soft, multi-layered ambient shadow (e.g., `0px 4px 20px rgba(0,0,0,0.08)`) to appear as if it's resting on a physical surface.
- **The Controls:** Use a slight "inset" or "pressed" look for the viewfinder area to make it feel like a glass window within the camera body.

## Shapes
The shape language is inspired by the rounded corners of instant film and the ergonomic curves of high-end camera hardware.

- **Film Frames:** Use `rounded-lg` (16px) for the outer frame and a slightly smaller radius for the internal image crop.
- **Primary Buttons:** Circular for shutters to mimic physical buttons; `rounded-md` (12px) for secondary controls.
- **Input Fields:** Softly rounded but never fully pill-shaped, maintaining a sense of structural integrity.

## Components
- **The Shutter Button:** A large, double-ringed circular component. The outer ring is Charcoal; the inner circle is a high-gloss finish that depresses visually on tap.
- **Film Stack:** A component for the gallery that displays images as a physical deck with slight rotation offsets (+/- 2 degrees) to evoke a stack of prints.
- **Viewfinder HUD:** Ultra-thin (1px) charcoal lines for framing guides. No fills.
- **Action Chips:** Small, charcoal-filled pills with Inter-label-style text in Secondary (Off-white) for toggling flash, timer, or lens.
- **Input Fields:** Subtle borders (1px Primary @ 20% opacity) that darken when focused. Use the grain texture inside the field for consistency.

--
