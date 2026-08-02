"use client";

import { ReactNode } from "react";

/**
 * The physical print. Narrow top border, square image well, wide bottom border.
 * Proportions follow real Polaroid 600 stock.
 *
 * The borders are intentionally blank — no caption, no date stamp. An unwritten
 * print is the default state of real instant film.
 */
export function PolaroidFrame({
  children,
  dark = false,
  className = "",
  lifted = false,
  compact = false,
  footer,
}: {
  children: ReactNode;
  /** Keeps the print paper-white when the app is in dark mode. */
  dark?: boolean;
  className?: string;
  lifted?: boolean;
  /** Tighter borders for gallery thumbnails. */
  compact?: boolean;
  /** Bottom-border content. Only the processing screen uses this — finished
   *  prints keep their borders blank. */
  footer?: ReactNode;
}) {
  return (
    <div
      className={`grain rounded-lg ${className}`}
      style={{
        backgroundColor: dark ? "#f6f3f2" : "var(--color-print)",
        boxShadow: lifted ? "var(--shadow-film-lifted)" : "var(--shadow-film)",
        padding: compact ? "8px 8px 0" : "14px 14px 0",
      }}
    >
      <div className="grain-layer rounded-lg" />

      <div
        className="relative z-2 aspect-square w-full overflow-hidden rounded-sm bg-[#111]"
        style={{ boxShadow: "var(--shadow-inset-glass)" }}
      >
        {children}
      </div>

      <div
        className="relative z-2 flex items-center justify-center"
        style={{ height: compact ? 28 : 76 }}
      >
        {footer}
      </div>
    </div>
  );
}
