"use client";

import { useState } from "react";
import Image from "next/image";
import { Folder, Shot } from "@/lib/types";
import { EditIcon } from "./Chrome";
import { FolderEditSheet } from "./FolderEditSheet";

const ROTATIONS = [-12, 0, 12];
const FAN_DIRECTIONS = [-1, 0, 1];

// Every offset below is derived from this one factor, so the whole folder
// scales as a unit — hand-tuning a dozen independent pixel values is how the
// fan and the flaps drift out of proportion with each other.
const SCALE = 0.72;
const CARD_W = 120 * SCALE;
const CARD_H = 96 * SCALE;
const FLAP_W = 80 * SCALE;
const FLAP_H = 56 * SCALE;
const TAB_W = 28 * SCALE;
const TAB_H = 10 * SCALE;
const TAB_TOP_GAP = 8 * SCALE;
const TAB_LEFT_INSET = 10 * SCALE;
const FRONT_TOP_OFFSET = 3 * SCALE;
const MINI_W = 48 * SCALE;
const MINI_H = 64 * SCALE;
const MINI_LEFT = -24 * SCALE;
const MINI_TOP = -34 * SCALE;
const FAN_Y = -54 * SCALE;
const FAN_X = 38 * SCALE;

/**
 * A folder that fans its most recent photos out above it. Hover drives the
 * fan-out on desktop; touch has no hover, so tapping does the same job in
 * two steps — first tap fans the photos out, a second tap on the folder
 * itself (not one of the photos) opens it. Tapping a fanned photo directly
 * always goes straight to that photo, at any point once it's visible.
 */
export function AnimatedFolderCard({
  folder,
  preview,
  count,
  onOpen,
  onSelectShot,
  onUpdateFolder,
}: {
  folder: Folder;
  /** Up to 3 shots, newest first. */
  preview: Shot[];
  count: number;
  onOpen: () => void;
  onSelectShot: (shot: Shot) => void;
  onUpdateFolder: (patch: { name: string; color: string | null }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  // Colors are derived from one base hex rather than stored separately, so
  // picking a folder color can't leave the back/front flaps out of sync with
  // each other — color-mix() darkens the back flap for the fold-shadow read.
  const front = folder.color ?? "var(--color-surface-container-high)";
  const back = folder.color
    ? `color-mix(in srgb, ${folder.color} 65%, black)`
    : "var(--color-surface-container)";

  function handleActivate() {
    if (!expanded && preview.length > 0) {
      setExpanded(true);
    } else {
      onOpen();
    }
  }

  return (
    <>
      <div className="relative flex flex-col items-center gap-1.5 pt-14 pb-2">
        {/* Only shown once the folder is open (fanned out) — a pencil
            sitting on every closed folder in the grid was more chrome than
            the list needed. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          aria-label="Edit folder"
          tabIndex={expanded ? 0 : -1}
          className="absolute top-2 right-2 z-40 grid h-7 w-7 place-items-center rounded-full text-[var(--color-on-surface-variant)] transition-opacity hover:text-[var(--color-on-surface)]"
          style={{
            opacity: expanded ? 0.7 : 0,
            pointerEvents: expanded ? "auto" : "none",
          }}
        >
          <EditIcon size={14} />
        </button>

        {/* No hover/press background here — on touch it tends to stick
            after the tap that opened the folder, reading as a separate dark
            panel behind the icon instead of sitting on the page itself. */}
        <div
          role="button"
          tabIndex={0}
          aria-label={`${folder.name}, ${count} ${count === 1 ? "photo" : "photos"}`}
          onClick={handleActivate}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleActivate();
            }
          }}
          onMouseEnter={() => preview.length > 0 && setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
          className="flex cursor-pointer flex-col items-center gap-1.5 rounded-md p-2 text-center"
        >
          <div
            className="relative flex items-center justify-center"
            style={{ width: CARD_W, height: CARD_H, perspective: 500 }}
          >
            {/* Back flap */}
            <div
              className="absolute rounded-md shadow-md"
              style={{
                width: FLAP_W,
                height: FLAP_H,
                background: back,
                transformOrigin: "bottom center",
                transform: expanded ? "rotateX(-15deg)" : "rotateX(0deg)",
                transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                zIndex: 10,
              }}
            />
            {/* Tab */}
            <div
              className="absolute rounded-t-sm"
              style={{
                width: TAB_W,
                height: TAB_H,
                background: back,
                top: `calc(50% - ${FLAP_H / 2}px - ${TAB_TOP_GAP}px)`,
                left: `calc(50% - ${FLAP_W / 2}px + ${TAB_LEFT_INSET}px)`,
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
                  className="absolute overflow-hidden rounded-md border border-[var(--color-outline-variant)] shadow-lg"
                  style={{
                    width: MINI_W,
                    height: MINI_H,
                    left: MINI_LEFT,
                    top: MINI_TOP,
                    transform: expanded
                      ? `translateY(${FAN_Y}px) translateX(${FAN_X * FAN_DIRECTIONS[index]}px) rotate(${ROTATIONS[index]}deg) scale(1)`
                      : "translateY(0px) translateX(0px) rotate(0deg) scale(0.5)",
                    opacity: expanded ? 1 : 0,
                    transition: `all 500ms cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 70}ms`,
                    zIndex: 10 - index,
                    pointerEvents: expanded ? "auto" : "none",
                  }}
                >
                  {/* 40px preview — the full photo would be ~15x the
                      bytes for something this size. */}
                  <Image
                    src={shot.thumbUrl}
                    alt=""
                    fill
                    unoptimized
                    loading="lazy"
                    sizes="40px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>

            {/* Front flap */}
            <div
              className="absolute rounded-md shadow-lg"
              style={{
                width: FLAP_W,
                height: FLAP_H,
                background: front,
                top: `calc(50% - ${FLAP_H / 2}px + ${FRONT_TOP_OFFSET}px)`,
                transformOrigin: "bottom center",
                transform: expanded
                  ? `rotateX(25deg) translateY(${6 * SCALE}px)`
                  : "rotateX(0deg)",
                transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                zIndex: 30,
              }}
            />
          </div>

          <p className="type-body-md w-full max-w-[110px] truncate">
            {folder.name}
          </p>
          <p className="type-viewfinder-label text-[var(--color-on-surface-variant)]">
            {count} {count === 1 ? "photo" : "photos"}
          </p>
        </div>
      </div>

      {editing && (
        <FolderEditSheet
          folder={folder}
          onSave={onUpdateFolder}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
