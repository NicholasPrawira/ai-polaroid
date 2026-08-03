"use client";

import { ReactNode } from "react";

/**
 * A developed frame. Just the photograph with rounded corners — no paper, no
 * white border. A disposable camera returns prints, not instant film, so there
 * is nothing to write on.
 */
export function PhotoCard({
  children,
  className = "",
  lifted = false,
  radius = "lg",
}: {
  children: ReactNode;
  className?: string;
  lifted?: boolean;
  radius?: "md" | "lg";
}) {
  return (
    <div
      className={`relative aspect-square w-full overflow-hidden bg-[#111] ${
        radius === "lg" ? "rounded-lg" : "rounded-md"
      } ${className}`}
      style={{
        boxShadow: lifted ? "var(--shadow-film-lifted)" : "var(--shadow-film)",
      }}
    >
      {children}
    </div>
  );
}
