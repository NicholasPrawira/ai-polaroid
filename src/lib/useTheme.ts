"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

export const THEME_KEY = "aipolaroid-theme";
const EVENT = "aipolaroid-themechange";

/**
 * Runs before first paint (injected in <head>) so the page never flashes the
 * wrong palette. Kept as a string because it must be inlined, not bundled.
 */
export const NO_FLASH_SCRIPT = `(function(){try{var s=localStorage.getItem('${THEME_KEY}');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=(s==='light'||s==='dark')?s:(d?'dark':'light')}catch(e){document.documentElement.dataset.theme='light'}})()`;

/* The <html data-theme> attribute is the single source of truth. The pre-paint
   script sets it, so React reads it rather than owning it — which is what
   useSyncExternalStore is for. */

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

function apply(next: Theme) {
  document.documentElement.dataset.theme = next;
  window.dispatchEvent(new Event(EVENT));
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Follow the OS for as long as the user hasn't picked a side.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem(THEME_KEY)) return;
      apply(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = getSnapshot() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private mode — the choice just won't survive a reload.
    }
    apply(next);
  }, []);

  return { theme, toggle };
}
