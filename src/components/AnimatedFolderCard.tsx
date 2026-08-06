"use client";

import { useState } from "react";
import Image from "next/image";
import { Shot } from "@/lib/types";

const ROTATIONS = [-12, 0, 12];
const TRANSLATIONS = [-38, 0, 38];

/**
 * A folder that fans its 3 most recent photos out above it. Hover drives the
 * fan-out on desktop; touch has no hover, so tapping does the same job in
 * two steps — first tap fans the photos out, a second tap on the folder
 * itself (not one of the photos) opens it. Tapping a fanned photo directly
 * always goes straight to that photo, at any point once it's visible.
 */
export function AnimatedFolderCard({
  name,
  preview,
  count,
  onOpen,
  onSelectShot,
}: {
  name: string;
  /** Up to 3 shots, newest first. */
  preview: Shot[];
  count: number;
  onOpen: () => void;
  onSelectShot: (shot: Shot) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  function handleActivate() {
    if (!expanded && preview.length > 0) {
      setExpanded(true);
    } else {
      onOpen();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${name}, ${count} ${count === 1 ? "photo" : "photos"}`}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate();
        }
      }}
      onMouseEnter={() => preview.length > 0 && setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className="flex cursor-pointer flex-col items-center gap-2 rounded-md p-3 text-center transition-colors hover:bg-[var(--color-surface-container)]"
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: 120, height: 96 }}
      >
        {/* Back flap */}
        <div
          className="absolute h-14 w-20 rounded-md bg-[var(--color-surface-container)] shadow-md"
          style={{
            transformOrigin: "bottom center",
            transform: expanded ? "rotateX(-15deg)" : "rotateX(0deg)",
            transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            zIndex: 10,
          }}
        />
        {/* Tab */}
        <div
          className="absolute h-2.5 w-7 rounded-t-sm bg-[var(--color-surface-container-high)]"
          style={{
            top: "calc(50% - 28px - 8px)",
            left: "calc(50% - 40px + 10px)",
            transformOrigin: "bottom center",
            transform: expanded
              ? "rotateX(-25deg) translateY(-1px)"
              : "rotateX(0deg)",
            transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            zIndex: 10,
          }}
        />

        {/* Fanned preview photos */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ zIndex: 20 }}
        >
          {preview.map((shot, index) => (
            <button
              key={shot.id}
              type="button"
              tabIndex={expanded ? 0 : -1}
              aria-label="Open photo"
              onClick={(e) => {
                e.stopPropagation();
                if (expanded) onSelectShot(shot);
              }}
              className="absolute h-16 w-12 overflow-hidden rounded-md border border-[var(--color-outline-variant)] shadow-lg"
              style={{
                left: -24,
                top: -34,
                transform: expanded
                  ? `translateY(-54px) translateX(${TRANSLATIONS[index]}px) rotate(${ROTATIONS[index]}deg) scale(1)`
                  : "translateY(0px) translateX(0px) rotate(0deg) scale(0.5)",
                opacity: expanded ? 1 : 0,
                transition: `all 500ms cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 70}ms`,
                zIndex: 10 - index,
                pointerEvents: expanded ? "auto" : "none",
              }}
            >
              <Image
                src={shot.imageUrl}
                alt=""
                fill
                unoptimized
                sizes="48px"
                className="object-cover"
              />
            </button>
          ))}
        </div>

        {/* Front flap */}
        <div
          className="absolute h-14 w-20 rounded-md bg-[var(--color-surface-container-high)] shadow-lg"
          style={{
            top: "calc(50% - 28px + 3px)",
            transformOrigin: "bottom center",
            transform: expanded
              ? "rotateX(25deg) translateY(6px)"
              : "rotateX(0deg)",
            transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            zIndex: 30,
          }}
        />
      </div>

      <p className="type-body-md w-full truncate">{name}</p>
      <p className="type-viewfinder-label text-[var(--color-on-surface-variant)]">
        {count} {count === 1 ? "photo" : "photos"}
      </p>
    </div>
  );
}
