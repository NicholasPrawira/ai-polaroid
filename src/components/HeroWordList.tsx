"use client";

import { useEffect, useRef } from "react";

/**
 * Renders the scrolling word list and keeps one `<li>` marked
 * `data-active="true"` — whichever sits closest to the sticky heading's own
 * line. The CSS gradient trick (`background-attachment: fixed`, see
 * globals.css) does this without JS on browsers that honour `fixed` there,
 * but iOS Safari and most mobile WebKit don't: the gradient tracks the
 * element instead of the viewport, so the highlight never moves. This is
 * the same idea running as a real measurement instead, and wins the
 * cascade over the gradient wherever it runs.
 */
export function HeroWordList({ words }: { words: string[] }) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const heading = list
      .closest(".landing-hero-inner")
      ?.querySelector("h1");
    if (!heading) return;

    let raf = 0;

    const update = () => {
      raf = 0;
      const bandY = heading.getBoundingClientRect().top;
      const items = Array.from(list.children) as HTMLElement[];
      let closest: HTMLElement | null = null;
      let closestDistance = Infinity;
      for (const item of items) {
        const rect = item.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - (bandY + rect.height / 2));
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = item;
        }
      }
      for (const item of items) {
        if (item === closest) item.setAttribute("data-active", "true");
        else item.removeAttribute("data-active");
      }
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <ul aria-hidden="true" ref={listRef}>
      {words.map((word) => (
        <li key={word}>{word}</li>
      ))}
    </ul>
  );
}
