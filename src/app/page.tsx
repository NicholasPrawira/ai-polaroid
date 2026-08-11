import Link from "next/link";
import { AsciiBackground } from "@/components/AsciiBackground";
import { CoverflowCarousel } from "@/components/CoverflowCarousel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Capture Memory",
  description:
    "Point, shoot, wait. Whatever you capture becomes memory.",
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

/* Same set the hero words point at — reusing them here ties the carousel
   back to the word list instead of introducing a fresh set of images. */
const SCENES = [
  { src: "/scene-travel1.jpg", label: "Travel" },
  { src: "/scene-reunion2.jpg", label: "Reunion" },
  { src: "/scene-road-trip.png", label: "Road Trip" },
  { src: "/scene-graduation.jpg", label: "Graduation" },
  { src: "/scene-hangout.jpg", label: "Hangout" },
  { src: "/scene-concert.jpg", label: "Concert" },
  { src: "/scene-first-date.jpg", label: "First Date" },
  { src: "/scene-everyday.jpg", label: "Everyday Moments" },
];

const STEPS = [
  {
    n: "01",
    title: "Capture",
    body: "Point, shoot. Your photo develops into the disposable-camera look, right on your device.",
  },
  {
    n: "02",
    title: "Flip it over",
    body: "Swipe the print and it turns over, ready for a caption about what the moment was.",
  },
  {
    n: "03",
    title: "Add a voice",
    body: "Record a short voice note alongside it, so the memory isn't just the words you typed.",
  },
];

const FAQ = [
  {
    q: "Is my photo safe?",
    a: "Yes. Photos are stored privately in your account's library, so only you can see them and they're still there the next time you open the app.",
  },
  {
    q: "Is this AI generated?",
    a: "No. Every photo gets the same disposable-camera preset — grain, color, vignette, flash — applied straight on your device. It doesn't change the moment, just the look, and nothing leaves your library to be generated anywhere else.",
  },
  {
    q: "Do I need an account?",
    a: "Yes. Signing in is what keeps your photos and folders private to you instead of anyone else who opens the app.",
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
            Whatever you capture
            <br />
            it becomes memory.
          </p>
          <Link href="/camera" className="landing-cta">
            Capture your memory
          </Link>
          <p className="landing-signin">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>

          <div className="landing-showcase">
            <CoverflowCarousel
              slides={SCENES.map((scene) => ({
                src: scene.src,
                alt: scene.label,
              }))}
              label="Photos developed with Capture Memory"
            />
          </div>
        </section>

        <section className="landing-how">
          <h2 className="landing-how-heading">How it works</h2>
          <ol className="landing-how-list">
            {STEPS.map((step) => (
              <li key={step.n} className="landing-how-item">
                <span className="landing-how-n">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-faq">
          <div className="landing-faq-list">
            {FAQ.map((item) => (
              <details key={item.q} className="landing-faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>
          “Therefore do not worry about tomorrow, for tomorrow will worry
          about itself. Each day has enough trouble of its own.”
          <cite>Matthew 6:34</cite>
        </p>
        <a
          href="https://instagram.com/capturememory.app"
          target="_blank"
          rel="noopener noreferrer"
        >
          @capturememory.app
        </a>
      </footer>
    </div>
  );
}
