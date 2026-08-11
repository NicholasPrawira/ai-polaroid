"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

const FILL_MS = 500;

/** Diameter of a circle centered at (x, y) large enough to cover every
 *  corner of a width×height box. */
function coverDiameter(width: number, height: number, x: number, y: number): number {
  return Math.ceil(
    2 *
      Math.max(
        Math.hypot(x, y),
        Math.hypot(width - x, y),
        Math.hypot(x, height - y),
        Math.hypot(width - x, height - y),
      ),
  );
}

/**
 * The landing page's primary CTA — a light outline button that fills dark
 * from wherever the pointer landed, the way a stamp of ink spreads from
 * its point of contact. Rebuilt from a pasted reference that assumed
 * framer-motion and a shadcn-style token system this app doesn't have;
 * same interaction, plain CSS transitions instead.
 */
export function LandingCta({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [active, setActive] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState(0);

  const updateOrigin = useCallback((x: number, y: number) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setOrigin({ x, y });
    setSize(coverDiameter(rect.width, rect.height, x, y));
  }, []);

  // Keeps the fill sized correctly if the button reflows (font load,
  // viewport resize) while it's showing.
  useEffect(() => {
    const node = ref.current;
    if (!node || !active) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setSize(coverDiameter(rect.width, rect.height, origin.x, origin.y));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [active, origin.x, origin.y]);

  return (
    <Link
      ref={ref}
      href={href}
      className="landing-cta"
      data-filled={active}
      onPointerEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        updateOrigin(e.clientX - rect.left, e.clientY - rect.top);
        setActive(true);
      }}
      onPointerDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        updateOrigin(e.clientX - rect.left, e.clientY - rect.top);
        setActive(true);
      }}
      onPointerLeave={() => setActive(false)}
      onFocus={(e) => {
        if (!e.currentTarget.matches(":focus-visible")) return;
        const rect = e.currentTarget.getBoundingClientRect();
        updateOrigin(rect.width / 2, rect.height / 2);
        setActive(true);
      }}
      onBlur={() => setActive(false)}
    >
      <span
        aria-hidden
        className="landing-cta-fill"
        style={{
          width: size,
          height: size,
          left: origin.x,
          top: origin.y,
          transform: `translate(-50%, -50%) scale(${active && size > 0 ? 1 : 0})`,
          transitionDuration: `${FILL_MS}ms`,
        }}
      />
      <span className="landing-cta-label">{children}</span>
    </Link>
  );
}
