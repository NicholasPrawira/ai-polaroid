"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { PhotoCard } from "./PhotoCard";
import { Shot } from "@/lib/types";

const SWIPE_THRESHOLD = 24;
const FLIP_MS = 300;

/**
 * A grid thumbnail that's also a tiny flip card. Either gesture — tap or
 * swipe — flips it to its memory side first and opens straight there, so the
 * tile's own flip reads as the start of the big one in ResultScreen rather
 * than an unrelated animation.
 */
export function PhotoTile({
  shot,
  tiltDeg,
  onOpen,
}: {
  shot: Shot;
  tiltDeg: number;
  onOpen: (opts?: { flipped?: boolean }) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const dragRef = useRef<{ x: number; y: number; committed: boolean } | null>(
    null,
  );
  // A plain tap is handled by the browser's own click, not reconstructed
  // from pointer math — that's what makes it work the same everywhere
  // (mouse, touch, stylus, assistive tech) without hand-rolling each case.
  // The swipe path only needs to veto that click when it fires one of its own.
  const suppressClickRef = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    dragRef.current = { x: e.clientX, y: e.clientY, committed: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;

    if (!drag.committed) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        dragRef.current = null;
        return;
      }
      drag.committed = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }

  function endDrag(e: React.PointerEvent) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag?.committed) return;

    if (Math.abs(e.clientX - drag.x) > SWIPE_THRESHOLD) {
      suppressClickRef.current = true;
      setFlipped(true);
      window.setTimeout(() => onOpen({ flipped: true }), FLIP_MS);
    }
  }

  function onClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setFlipped(true);
    window.setTimeout(() => onOpen({ flipped: true }), FLIP_MS);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Open photo"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      className="cursor-pointer text-left transition-transform active:scale-[0.97]"
      style={{ transform: `rotate(${tiltDeg}deg)`, perspective: 600 }}
    >
      <div
        className="relative"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateY(${flipped ? 180 : 0}deg)`,
          transition: `transform ${FLIP_MS}ms ease`,
        }}
      >
        <div style={{ backfaceVisibility: "hidden" }}>
          <PhotoCard radius="md">
            <Image
              src={shot.imageUrl}
              alt="Photo"
              fill
              unoptimized
              draggable={false}
              sizes="150px"
              className="object-cover"
            />
          </PhotoCard>
        </div>

        <div
          className="absolute inset-0"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-md bg-[var(--color-surface-container-high)]">
            <span className="type-viewfinder-label text-[var(--color-on-surface-variant)]">
              {shot.caption ? "memory" : "add memory"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
