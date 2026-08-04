import Link from "next/link";
import { AsciiBackground } from "@/components/AsciiBackground";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Disposable Camera",
  description:
    "Point, shoot, wait. Whatever you point it at comes back on film.",
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
    title: "Point and commit",
    body: "A viewfinder, a shutter, a self-timer — and nothing else. No filter to preview, no shot to retake. You frame it once, the way a single-use camera makes you.",
  },
  {
    n: "02",
    title: "Wait for it to develop",
    body: "The frame sits dark and clears slowly while the film runs. A few seconds you can't skip. Every camera worth using made you wait for something.",
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
            Whatever you point it at,
            <br />
            it comes back on film.
          </p>
          <Link href="/camera" className="landing-cta">
            Capture your moment
          </Link>
          <p className="landing-signin">
            Already have an account? <Link href="/camera">Sign in</Link>
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
    </div>
  );
}
