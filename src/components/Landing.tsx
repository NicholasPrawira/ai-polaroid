"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * The page a signed-out visitor lands on.
 *
 * The headline names one occasion at a time while the rest wait beneath it.
 * The highlight is a class on the active word itself rather than a bar
 * positioned over the column — so however the column moves, whether from the
 * rotation or from the page scrolling underneath it, the colour cannot drift
 * onto the wrong word. There is nothing to keep in sync because there is only
 * one thing.
 */

const OCCASIONS = [
  "Travel",
  "Reunion",
  "Road Trip",
  "Graduation",
  "Hangout",
  "Concert",
  "First Date",
  "Everyday Moments",
];

/** Matches the `leading-[1.15]` on the list; both must move together. */
const LINE = 1.15;
const DWELL_MS = 2200;

function Occasions() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    // Nobody who asked for less motion gets any: the interval simply never
    // starts, which leaves the first occasion showing and highlighted.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(
      () => setActive((i) => (i + 1) % OCCASIONS.length),
      DWELL_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="relative inline-block leading-[1.15]">
      {/*
        Reserves the width of the current word only. Without it the wrapper
        would size to "Everyday Moments", the longest entry, and no longer fit
        beside "Capture your" — pushing the whole column onto its own line.
      */}
      <span aria-hidden className="invisible">
        {OCCASIONS[active]}
      </span>

      {/*
        Absolutely placed and `w-max`, so the longer occasions spill to the
        right and downward without disturbing the headline's line box.
      */}
      <ul
        aria-hidden
        className="absolute top-0 left-0 m-0 w-max list-none p-0 leading-[1.15] transition-transform duration-700 ease-out"
        style={{ transform: `translateY(-${active * LINE}em)` }}
      >
        {OCCASIONS.map((word, i) => (
          <li
            key={word}
            className={
              i === active
                ? "text-[var(--color-film-amber-bright)] transition-colors duration-500"
                : "text-white/25 transition-colors duration-500"
            }
          >
            {word}
          </li>
        ))}
      </ul>

      {/* The list is decorative motion; this is what a screen reader gets. */}
      <span className="sr-only">{OCCASIONS.join(", ")}</span>
    </span>
  );
}

const QUESTIONS: Array<{ q: string; a: string }> = [
  {
    q: "What does it actually do?",
    a: "You take a photo in the browser and it comes back looking like it was shot on a cheap disposable camera in about 2003 — hard flash, coarse 35mm grain, dust, scratches, and a green-yellow cast. It is a film emulation, not a filter slapped on top.",
  },
  {
    q: "Does it change my face?",
    a: "No. The instructions given to the model forbid altering faces, composition, or anything in the frame. Only colour, grain, exposure, and lens character are allowed to change. You come out looking like you, just developed badly on purpose.",
  },
  {
    q: "Do I need an account?",
    a: "Yes. Photos are saved to it, which is the whole point — without one, every picture would vanish the moment you refreshed. Signing in is a link sent to your email; there is no password to invent or lose.",
  },
  {
    q: "Who can see my photos?",
    a: "Only you. They live in private storage and are served through links that expire, and the database refuses to hand one account's photos to another. Nobody browsing the site can reach them.",
  },
  {
    q: "What is a photo credit?",
    a: "One credit develops one photo. Developing costs real money at the image model, so the balance is what keeps a shared link from running up a bill. New accounts start with ten, and a promo code adds more.",
  },
  {
    q: "How long does developing take?",
    a: "Usually ten to forty seconds. That wait is not hidden behind a spinner — you watch the picture come up, the way a print does in a tray. If it fails, the credit goes back.",
  },
  {
    q: "Can I delete a photo?",
    a: "Yes, and it deletes properly: the developed print, the original capture, and the record of it. Photographs have other people in them, so getting rid of one has to actually get rid of it.",
  },
];

export function Landing() {
  return (
    <main className="bg-[#0b0b0c] text-white">
      {/* ---------------------------------------------------------- hero */}
      <section className="relative flex min-h-dvh flex-col justify-center overflow-hidden px-6 py-24 sm:px-10">
        {/* Stand-in for the night photograph: a dark wash plus the dot grid.
            The real frame is not in this repository. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 115%, #3a2a12 0%, #17130f 45%, #0b0b0c 100%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(currentColor 1px, transparent 1px), radial-gradient(currentColor 1px, transparent 1px)",
            backgroundSize: "22px 22px, 22px 22px",
            backgroundPosition: "0 0, 11px 11px",
            color: "#9aa0a6",
          }}
        />

        <div className="relative mx-auto w-full max-w-4xl">
          <h1 className="text-[clamp(2.25rem,9vw,4.5rem)] font-bold tracking-tight">
            <span className="block sm:inline">Capture your</span>{" "}
            <Occasions />
          </h1>

          <p className="mt-[9.5em] max-w-md text-[15px] leading-relaxed text-white/55 sm:mt-[7em]">
            A disposable camera that lives in your browser. Shoot now, let it
            develop, and keep the roll.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="rounded-md bg-[var(--color-film-amber-bright)] px-6 py-3.5 text-[15px] font-medium text-[#241703] transition-opacity hover:opacity-90"
            >
              Start shooting
            </Link>
            <a
              href="#questions"
              className="rounded-md border border-white/20 px-6 py-3.5 text-[15px] text-white/80 transition-colors hover:bg-white/5"
            >
              Common questions
            </a>
          </div>
        </div>

        <div
          aria-hidden
          className="relative mx-auto mt-16 w-full max-w-4xl text-[11px] tracking-[0.18em] text-white/30 uppercase"
        >
          scroll
        </div>
      </section>

      {/* ------------------------------------------------------ questions */}
      <section
        id="questions"
        className="scroll-mt-8 bg-white px-6 py-20 text-[#141414] sm:px-10 sm:py-28"
      >
        <div className="mx-auto w-full max-w-2xl">
          <h2 className="text-[clamp(1.75rem,5vw,2.5rem)] font-bold tracking-tight">
            Questions
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-black/55">
            The ones worth answering before you hand a camera your face.
          </p>

          <dl className="mt-10 divide-y divide-black/10 border-y border-black/10">
            {QUESTIONS.map(({ q, a }) => (
              // <details> so a question opens without JavaScript, and so the
              // page is still readable if it never loads.
              <details key={q} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17px] font-medium marker:content-none">
                  <dt>{q}</dt>
                  <span
                    aria-hidden
                    className="shrink-0 text-2xl leading-none text-black/30 transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <dd className="pr-10 pb-6 text-[15px] leading-relaxed text-black/65">
                  {a}
                </dd>
              </details>
            ))}
          </dl>

          <div className="mt-14">
            <Link
              href="/login"
              className="inline-block rounded-md bg-[#141414] px-6 py-3.5 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
            >
              Take the first one
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-[#0b0b0c] px-6 py-10 text-[13px] text-white/35 sm:px-10">
        <div className="mx-auto max-w-2xl">AI Disposable Camera</div>
      </footer>
    </main>
  );
}
