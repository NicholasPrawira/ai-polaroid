"use client";

import { applyFilmLook } from "./filmShader";

export type DevelopMode = "instant" | "ai";

/**
 * Runs one capture through one of the two pipelines. Both take the same raw
 * input and return a data URL, which is what makes an honest side-by-side
 * comparison possible: identical source, only the pipeline differs.
 */
export async function developPhoto(
  source: string,
  mode: DevelopMode,
  signal?: AbortSignal,
): Promise<string> {
  if (mode === "instant") return applyFilmLook(source);

  const res = await fetch("/api/develop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: source }),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Develop failed (${res.status}).`);
  return body.image as string;
}
