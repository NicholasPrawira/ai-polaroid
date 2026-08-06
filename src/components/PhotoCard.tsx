"use client";

import { ReactNode } from "react";

/**
 * A developed frame. Just the photograph with rounded corners — no paper, no
 * white border. (ResultScreen flips this card over to a matching back face
 * for the shot's memory — that back face is its own element, not this one.)
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
