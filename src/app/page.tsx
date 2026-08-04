import Link from "next/link";
import { AsciiBackground } from "@/components/AsciiBackground";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Disposable Camera",
  description:
    "Point, shoot, wait. Your photo comes back looking like it spent twenty years in a drawer.",
};

/* The words scroll through a fixed highlight band, lighting up one at a time.
   Server-rendered — the whole effect is sticky positioning plus a fixed-
   attachment gradient clipped to the text. No JavaScript involved. */
const WORDS = [
  "Travel",
  "Reunion",
  "Road Trip",
  "Graduation",
  "Hangout",
  "Concert",
  "First Date",
  "Everyday Moments",
];

const STEPS = [
  {
    n: "01",
    title: "Shoot without looking",
    body: "A viewfinder, a shutter, a self-timer. No filters to preview, no grid of options — you frame it and you commit, the way a single-use camera makes you.",
  },
  {
    n: "02",
    title: "Wait for it to develop",
    body: "The photo goes dark and clears slowly while the film emulation runs. Seven seconds you can't skip. That pause is the point.",
  },
  {
    n: "03",
    title: "Keep what mattered",
    body: "File shots into folders you name yourself — Japan 2026, Nico Wedding — or save them straight to your device.",
  },
];

export default function Landing() {
  return (
    <div className="landing" style={{ ["--count" as string]: WORDS.length }}>
      <div className="landing-bg" aria-hidden="true">
        <AsciiBackground />
      </div>

      <header className="landing-hero">
        <div className="landing-hero-inner">
          <h1>
            <span aria-hidden="true">Capture your&nbsp;</span>
            <span className="sr-only">
              Capture your travel, reunion, road trip, graduation, hangout,
              concert, first date, and everyday moments.
            </span>
          </h1>
          <ul aria-hidden="true">
            {WORDS.map((word) => (
              <li key={word}>{word}</li>
            ))}
          </ul>
        </div>
      </header>

      <main className="landing-reveal">
        <section>
          <p className="landing-pitch">
            and it comes back looking like
            <br />
            it spent twenty years in a drawer.
          </p>
          <Link href="/camera" className="landing-cta">
            Open the camera
          </Link>
          <p className="landing-note">
            no account · nothing uploaded twice · works in the browser
          </p>
        </section>
      </main>

      <section className="landing-steps">
        <ol>
          {STEPS.map((step) => (
            <li key={step.n}>
              <span className="landing-step-n">{step.n}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="landing-footer">
        <p>
          Photos are developed by an image model and never stored on a server.
        </p>
        <Link href="/camera">Open the camera →</Link>
      </footer>
    </div>
  );
}
