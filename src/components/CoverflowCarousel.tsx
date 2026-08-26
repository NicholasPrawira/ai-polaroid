"use client";

import * as React from "react";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

const ChevronLeftIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const MicIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21M9 21h6" />
  </svg>
);

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export interface CoverflowSlide {
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  meta?: { label: string; value: string }[];
  /** Shown on the flip side, like the memory note on a developed print.
   *  Slides without one just don't flip. */
  memory?: string;
}

export interface CoverflowCarouselProps {
  slides: CoverflowSlide[];
  /** Degrees the first neighbour tilts. */
  rotate?: number;
  /** How far the first neighbour recedes, as a fraction of card width. */
  depth?: number;
  /** Viewer distance as a multiple of card width — smaller is a wider lens. */
  perspective?: number;
  /** Exponent on distance. Below 1 the rake eases off as cards travel out. */
  falloff?: number;
  /** Opacity lost per step from the centre. */
  fade?: number;
  /** Any CSS length. Everything else is derived from it, so the rake scales. */
  cardWidth?: string;
  /** Space between cards, as a fraction of card width. */
  gap?: number;
  loop?: boolean;
  showCaption?: boolean;
  showPagination?: boolean;
  showNavigation?: boolean;
  /** Names the carousel for assistive tech. */
  label?: string;
  className?: string;
  cardClassName?: string;
}

/**
 * Adapted from a shadcn/ui component — this app doesn't use shadcn, so the
 * `lucide-react` icons and `cn()`/`@/lib/utils` import were swapped for
 * local equivalents, and every `bg-muted`/`text-foreground`/`ring-ring`
 * class (shadcn theme tokens this app never registers) was swapped for the
 * landing panel's own bright-panel palette. The carousel physics — drag
 * inertia, modular-arithmetic looping, direct-to-DOM rAF painting — are
 * untouched.
 */
export function CoverflowCarousel({
  slides,
  rotate = 44,
  depth = 0.6,
  perspective = 3,
  falloff = 0.56,
  fade = 0.1,
  cardWidth = "clamp(148px, 22vw, 260px)",
  gap = 0.05,
  loop = true,
  showCaption = false,
  showPagination = false,
  showNavigation = false,
  label = "Cover carousel",
  className,
  cardClassName,
}: CoverflowCarouselProps) {
  const count = slides.length;

  const frameRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  /** Fractional card index at the centre. The single source of truth. */
  const posRef = React.useRef(0);
  /** Where the current settle is headed. Stepping off `pos` instead would
      swallow a keypress that lands mid-flight, before the round-off moves. */
  const targetRef = React.useRef(0);
  const widthRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const dragRef = React.useRef<{
    id: number;
    x: number;
    y: number;
    pos: number;
    v: number;
    t: number;
    /** Mouse commits instantly. Touch/pen wait for a clearly-horizontal
        move — until then the gesture is still eligible to be page scroll. */
    committed: boolean;
  } | null>(null);
  /** Set the moment a drag actually commits, so a click firing right after
   *  pointerup doesn't also flip the card the drag just landed on. */
  const draggedRef = React.useRef(false);
  /** Card the pointer went down on, by index. Mouse needs this: capturing
   *  the pointer on mousedown (below) retargets the native `click` that
   *  would normally follow, so a plain mouse tap-to-flip is handled here
   *  instead of through the button's own onClick (which still covers
   *  keyboard activation and touch, neither of which capture on down). */
  const tappedIndexRef = React.useRef<number | null>(null);

  const [selected, setSelected] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);

  /** Nearest whole card, folded back into 0..count-1. */
  const indexAt = React.useCallback(
    (pos: number) => ((Math.round(pos) % count) + count) % count,
    [count],
  );

  // Paint straight to the DOM. Sixty state updates a second would re-render
  // every card for numbers React never needs to see.
  const paint = React.useCallback(() => {
    const width = widthRef.current;
    if (!width) return;
    const pitch = width * (1 + gap);
    const pos = posRef.current;

    cardRefs.current.forEach((card, index) => {
      if (!card) return;

      // Fold the distance into the shorter way round the ring. This is the
      // whole looping mechanism — no cloned nodes, no shuffling the DOM.
      let offset = index - pos;
      if (loop) {
        offset = ((offset % count) + count) % count;
        if (offset > count / 2) offset -= count;
      }

      const distance = Math.abs(offset);
      // Both the tilt and the recession ease off as cards travel out —
      // doubling the distance adds only about half again as much of each.
      // A linear ramp folds the second card shut; this keeps it readable.
      const ramp = Math.pow(distance, falloff);
      // Capped short of edge-on so a far card never turns its back.
      const tilt = Math.min(rotate * ramp, 82) * Math.sign(offset);

      card.style.transform =
        `translateX(calc(-50% + ${offset * pitch}px)) ` +
        `translateZ(${-depth * width * ramp}px) rotateY(${-tilt}deg)`;

      // A card is teleported across the ring at exactly half a turn out, so it
      // has to be gone by then or the jump is visible.
      const edge = loop ? Math.min(1, Math.max(0, count / 2 - distance)) : 1;
      card.style.opacity = String(Math.max(0, 1 - fade * distance) * edge);
      card.style.zIndex = String(100 - Math.round(distance));
    });
  }, [count, depth, fade, falloff, gap, loop, rotate]);

  const settle = React.useCallback(
    (target: number) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      targetRef.current = target;
      setSelected(indexAt(target));

      const step = () => {
        const remaining = target - posRef.current;
        if (Math.abs(remaining) < 0.0004) {
          posRef.current = target;
          paint();
          rafRef.current = null;
          return;
        }
        // ponytail: exponential ease-out, not a spring. Swap in a spring only
        // if the settle needs overshoot.
        posRef.current += remaining * 0.16;
        paint();
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [indexAt, paint],
  );

  const clamp = React.useCallback(
    (pos: number) => (loop ? pos : Math.max(0, Math.min(count - 1, pos))),
    [count, loop],
  );

  const goTo = React.useCallback(
    (index: number) => {
      // Take the shorter way round rather than unwinding the whole ring.
      const target = loop
        ? index + Math.round((targetRef.current - index) / count) * count
        : index;
      settle(clamp(target));
    },
    [clamp, count, loop, settle],
  );

  const nudge = React.useCallback(
    (by: number) => settle(clamp(Math.round(targetRef.current) + by)),
    [clamp, settle],
  );

  /** Below this many px of movement, a touch/pen pointer hasn't declared
      whether it means to drag the carousel or scroll the page. */
  const DRAG_THRESHOLD = 6;

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    targetRef.current = posRef.current;
    draggedRef.current = false;
    const cardEl = (event.target as HTMLElement).closest("[data-index]");
    tappedIndexRef.current = cardEl ? Number(cardEl.getAttribute("data-index")) : null;
    const committed = event.pointerType === "mouse";
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      pos: posRef.current,
      v: 0,
      t: performance.now(),
      committed,
    };
    // Mouse drag is unambiguous — capture right away. Touch/pen only
    // capture once onPointerMove decides the gesture is actually
    // horizontal, so an undecided touch is still free to scroll the page.
    if (committed) event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;

    // Total displacement since pointerdown, independent of the touch/mouse
    // commit branches below — this is what decides whether the pointerup
    // that follows should be treated as a click (flip) or a drag (not).
    if (
      Math.abs(event.clientX - drag.x) >= DRAG_THRESHOLD ||
      Math.abs(event.clientY - drag.y) >= DRAG_THRESHOLD
    ) {
      draggedRef.current = true;
    }

    if (!drag.committed) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
        return;
      }
      if (Math.abs(dy) > Math.abs(dx)) {
        // Vertical intent — let the page handle it and stop tracking this
        // pointer rather than fighting native scroll.
        dragRef.current = null;
        return;
      }
      drag.committed = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    const pitch = widthRef.current * (1 + gap);
    if (!pitch) return;

    const now = performance.now();
    const previous = posRef.current;
    posRef.current = clamp(drag.pos - (event.clientX - drag.x) / pitch);
    // Cards per second, for the throw.
    drag.v = ((posRef.current - previous) / Math.max(now - drag.t, 1)) * 1000;
    drag.t = now;

    const index = indexAt(posRef.current);
    if (index !== selected) setSelected(index);
    paint();
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;

    // Mouse only — see the note on tappedIndexRef above for why touch and
    // keyboard don't need this and go through the button's onClick instead.
    if (event.pointerType === "mouse" && !draggedRef.current) {
      const idx = tappedIndexRef.current;
      if (idx !== null && idx === indexAt(posRef.current) && slides[idx]?.memory) {
        setFlipped((f) => !f);
      }
    }

    if (!drag.committed) return;
    // Let a flick carry, but never more than two cards.
    const carried = Math.max(-2, Math.min(2, drag.v * 0.18));
    settle(clamp(Math.round(posRef.current + carried)));
  };

  // Card width drives pitch, depth and perspective, so it is the only thing
  // worth measuring — and only when the box actually changes.
  useIsoLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const measure = () => {
      const card = cardRefs.current[0];
      if (!card) return;
      widthRef.current = card.offsetWidth;
      paint();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [paint]);

  React.useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // Browsing away from a flipped card should turn it back face-up rather
  // than leaving it flipped off-centre. Adjusted during render (React's
  // documented pattern for this) rather than an effect, which would commit
  // one stale frame with the old card still flipped before catching up.
  const [flippedFor, setFlippedFor] = React.useState(selected);
  if (flippedFor !== selected) {
    setFlippedFor(selected);
    setFlipped(false);
  }

  const active = slides[selected];

  return (
    <div
      className={cx("w-full", className)}
      style={{ ["--cf-card" as string]: cardWidth }}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
    >
      <div className="relative">
        <div
          ref={frameRef}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              nudge(-1);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              nudge(1);
            }
          }}
          // Vertical padding keeps the drop shadows clear of the overflow clip.
          className="cursor-grab overflow-hidden py-10 outline-none focus-visible:ring-2 focus-visible:ring-black/30 active:cursor-grabbing"
          style={{
            perspective: `calc(var(--cf-card) * ${perspective})`,
            // Horizontal drag is ours; the page keeps vertical scrolling.
            touchAction: "pan-y",
          }}
        >
          <div
            className="relative select-none"
            style={{
              height: "var(--cf-card)",
              transformStyle: "preserve-3d",
            }}
          >
            {slides.map((slide, index) => {
              const isCentre = index === selected;
              const canFlip = Boolean(slide.memory);
              return (
                <div
                  key={index}
                  ref={(node) => {
                    cardRefs.current[index] = node;
                  }}
                  data-index={index}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${index + 1} of ${count}`}
                  className="absolute left-1/2 top-0 aspect-square will-change-transform"
                  style={{ width: "var(--cf-card)" }}
                >
                  {/* Separate from the outer div `paint()` tilts for the
                      coverflow effect — this one only ever gets a flat
                      rotateY(180) toggle, so the two 3D transforms never
                      fight each other. Only the centred card responds;
                      tilted neighbours are barely readable to flip anyway. */}
                  <button
                    type="button"
                    tabIndex={isCentre && canFlip ? 0 : -1}
                    aria-label={
                      canFlip
                        ? `${slide.alt}. ${flipped && isCentre ? "Showing memory. Tap to see photo." : "Tap to see memory."}`
                        : slide.alt
                    }
                    // Not `disabled` — that would stop pointerdown bubbling
                    // to the frame's own handlers, breaking drag-to-navigate
                    // whenever a gesture happens to start on an off-centre
                    // card. The click itself is still gated below.
                    onClick={() => {
                      if (draggedRef.current || !isCentre || !canFlip) return;
                      setFlipped((f) => !f);
                    }}
                    className={cx(
                      "relative h-full w-full appearance-none border-0 bg-transparent p-0",
                      isCentre && canFlip ? "cursor-pointer" : "cursor-default",
                    )}
                    style={{
                      transformStyle: "preserve-3d",
                      transform: `rotateY(${isCentre && flipped ? 180 : 0}deg)`,
                      transition: "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                  >
                    {/* Front */}
                    <div
                      className={cx(
                        "absolute inset-0 overflow-hidden rounded-2xl bg-black/5 shadow-xl",
                        cardClassName,
                      )}
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {/* Lazy on purpose. React emits a <head> preload for
                          every eager <img> it renders, and this carousel sits
                          two screens below the fold — those eight preloads
                          were competing with the ASCII canvas's own scene
                          fetches, which are what the user actually sees on
                          arrival. Lazy suppresses the preload and defers the
                          request until the carousel is near the viewport. */}
                      <img
                        src={slide.src}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        className="h-full w-full select-none object-cover"
                      />
                    </div>

                    {/* Back — pre-rotated so it reads right-way-round once
                        the card as a whole has turned all the way over. */}
                    {canFlip && (
                      <div
                        className="absolute inset-0 overflow-hidden rounded-2xl bg-[#1c1c1d] shadow-xl"
                        style={{
                          backfaceVisibility: "hidden",
                          transform: "rotateY(180deg)",
                        }}
                      >
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-5 text-center">
                          <p className="text-[9px] font-semibold tracking-[0.12em] text-white/45 uppercase">
                            Memory
                          </p>
                          <p className="text-[11px] leading-snug text-white/90">
                            {slide.memory}
                          </p>
                          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-white/75">
                            <MicIcon />
                            <span className="text-[10px] tabular-nums">
                              0:{String(8 + (index % 4) * 3).padStart(2, "0")}
                            </span>
                          </span>
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {showNavigation && (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => nudge(-1)}
              className="absolute left-3 top-1/2 z-[200] -translate-y-1/2 rounded-full bg-white/80 p-2 text-[#1c1c1d] backdrop-blur transition hover:bg-white"
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => nudge(1)}
              className="absolute right-3 top-1/2 z-[200] -translate-y-1/2 rounded-full bg-white/80 p-2 text-[#1c1c1d] backdrop-blur transition hover:bg-white"
            >
              <ChevronRightIcon />
            </button>
          </>
        )}
      </div>

      {showCaption && active?.title && (
        <div
          key={selected}
          className="mt-2 flex flex-col items-center px-6 transition-opacity duration-300"
        >
          <p className="text-[15px] font-semibold tracking-tight text-[#1c1c1d]">
            {active.title}
          </p>
          {active.subtitle && (
            <p className="mt-1 text-[13px] text-[#1c1c1d]/60">
              {active.subtitle}
            </p>
          )}
          {active.meta && active.meta.length > 0 && (
            <dl className="mt-10 w-full max-w-[230px] text-[12px]">
              {active.meta.map((row) => (
                <div key={row.label} className="flex justify-between py-[5px]">
                  <dt className="text-[#1c1c1d]/60">{row.label}</dt>
                  <dd className="font-medium text-[#1c1c1d]">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {showPagination && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === selected}
              onClick={() => goTo(index)}
              className={cx(
                "size-2 rounded-full bg-[#1c1c1d] transition-opacity",
                index === selected ? "opacity-100" : "opacity-30",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
