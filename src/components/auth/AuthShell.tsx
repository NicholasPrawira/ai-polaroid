import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";

/**
 * Light-panel token overrides, matching the landing page's reveal panel
 * (#f3f0ef / #1c1c1d) rather than the app's single dark palette. Scoped as
 * CSS custom properties on the wrapper rather than hardcoded per-element, so
 * every child that already reads `var(--color-*)` — FormField, SubmitButton,
 * error text, links — repaints correctly for free.
 *
 * Overrides the `--color-*` variables directly, not the `--surface` /
 * `--on-surface` base tokens they're aliased from. Tailwind's `@theme inline`
 * resolves `--color-surface: var(--surface)` once, at `:root` — a nested
 * `var()` reference is substituted using the scope where it's *declared*, not
 * where it's *used*, so redefining `--surface` deeper in the tree never
 * reaches it. Only redeclaring `--color-surface` itself at this scope works.
 *
 * `color` is set explicitly on the wrapper too: overriding a custom property
 * doesn't retroactively change an already-inherited `color`, so without this
 * the title and body text would keep the dark palette's light-on-dark value.
 */
const LIGHT_PANEL_VARS = {
  "--color-surface": "#f3f0ef",
  "--color-surface-container": "#e8e4e2",
  "--color-surface-container-low": "#eeeae8",
  "--color-on-surface": "#1c1c1d",
  "--color-on-surface-variant": "#5c5c5d",
  "--color-outline": "#8a8685",
  "--color-outline-variant": "#d6d2d0",
  "--color-primary": "#1c1c1d",
  "--color-on-primary": "#f3f0ef",
  "--color-error": "#b3261e",
} as CSSProperties;

/** Shared frame for every auth page: logo mark, title, and a centred card. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  image,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Optional photo for the right-hand column on wide screens. Every auth
   *  page uses the light panel treatment now, image or not. */
  image?: string;
}) {
  const form = (
    <div className="relative z-2 w-full max-w-sm">
      <Link
        href="/"
        className="mb-8 flex justify-center opacity-70 hover:opacity-100"
      >
        {/* The source art is white-on-transparent, made for the app's dark
            screens — inverted here since this panel is the one light
            surface in the app (matches the landing reveal panel). */}
        <Image
          src="/capture-memory-logo.png"
          alt="Capture Memory"
          width={1431}
          height={478}
          className="h-[76px] w-auto invert"
        />
      </Link>

      <h1 className="type-headline-lg text-center">{title}</h1>
      {subtitle && (
        <p className="type-body-md mt-2 text-center text-[var(--color-on-surface-variant)]">
          {subtitle}
        </p>
      )}

      <div className="mt-8">{children}</div>

      {footer && (
        <p className="type-body-md mt-6 text-center text-[var(--color-on-surface-variant)]">
          {footer}
        </p>
      )}
    </div>
  );

  const panelClass =
    "grain relative flex flex-col items-center justify-center bg-[var(--color-surface)] px-6 py-12 text-[var(--color-on-surface)]";

  if (!image) {
    return (
      <main style={LIGHT_PANEL_VARS} className={`${panelClass} min-h-dvh`}>
        <div className="grain-layer" style={{ opacity: 0.035 }} />
        {form}
      </main>
    );
  }

  return (
    <main className="grid min-h-dvh md:grid-cols-2">
      <div style={LIGHT_PANEL_VARS} className={panelClass}>
        <div className="grain-layer" style={{ opacity: 0.035 }} />
        {form}
      </div>

      {/* Hard edge, not a fade — a soft gradient here read as a smear across
          the photo rather than a deliberate seam. */}
      <div className="relative hidden overflow-hidden bg-[#1c1c1d] md:block">
        <Image
          src={image}
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
      </div>
    </main>
  );
}
