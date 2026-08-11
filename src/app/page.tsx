import Link from "next/link";
import Image from "next/image";
import { AsciiBackground } from "@/components/AsciiBackground";
import { CoverflowCarousel } from "@/components/CoverflowCarousel";
import { HeroWordList } from "@/components/HeroWordList";
import { LandingCta } from "@/components/LandingCta";
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
   back to the word list instead of introducing a fresh set of images.
   `memory` is what the centred card flips to show, a preview of the same
   flip the real app does after a develop. */
const SCENES = [
  {
    src: "/scene-travel1.jpg",
    label: "Travel",
    memory: "finally Bromo with my best friend, the trip we kept planning.",
  },
  {
    src: "/scene-reunion2.jpg",
    label: "Reunion",
    memory: "back at our old spot with the whole squad again.",
  },
  {
    src: "/scene-road-trip.png",
    label: "Road Trip",
    memory: "road trip with Bryant, still 3 hours to go.",
  },
  {
    src: "/scene-graduation.jpg",
    label: "Graduation",
    memory: "graduation day with fam, finally our first photoshoot together.",
  },
  {
    src: "/scene-hangout.jpg",
    label: "Hangout",
    memory: "finally going out with friends after weeks of no-shows.",
  },
  {
    src: "/scene-concert.jpg",
    label: "Concert",
    memory: "front row with Raka when the confetti dropped.",
  },
  {
    src: "/scene-first-date.jpg",
    label: "First Date",
    memory: "first date with Cindy, walking the beach after dinner.",
  },
  {
    src: "/scene-everyday.jpg",
    label: "Everyday Moments",
    memory: "just an ordinary bootcamp day. wanted to remember it anyway.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Capture or upload",
    body: "Take a photo or upload one from your camera roll.",
  },
  {
    n: "02",
    title: "Flip it over",
    body: "Add a little story behind the photo.",
  },
  {
    n: "03",
    title: "Add a voice",
    body: "Record your voice and keep the memory alive.",
  },
];

const FAQ = [
  {
    q: "Why did you build this?",
    a: "I love taking photos, and to me every photo is a memory. I built Capture Memory so those photos feel like something we actually want to see again, with our voice attached, instead of getting buried in a camera roll.",
  },
  {
    q: "Who is this for?",
    a: (
      <>
        Anyone who wants their photos to feel like memories, because we live
        in a world that constantly pushes us to do more,{" "}
        <em className="inline-flex items-center gap-1 align-middle not-italic">
          <Image
            src="/Capture Memory Transparant.png"
            alt=""
            width={16}
            height={16}
            className="inline-block h-4 w-4 align-middle brightness-0"
          />
          <span className="italic">Capture Memory</span>
        </em>{" "}
        helps us slow down, appreciate the moments we have, and remember that
        our lives are already full of memories.
      </>
    ),
  },
  {
    q: "Is my photo safe?",
    a: "Yes. Photos are stored privately in your account's library, so only you can see them and they're still there the next time you open the app.",
  },
  {
    q: "Do I need an account?",
    a: "Yes. Signing in is what keeps your photos and folders private to you instead of anyone else who opens the app.",
  },
  {
    q: "Anything else I should know?",
    a: "Capture Memory is free to use. You can also upload your own photos from your camera roll, and both photos and your account can be deleted any time from your profile menu.",
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
            <span aria-hidden="true" className="landing-hero-lead">
              <Image
                src="/Capture Memory Transparant.png"
                alt=""
                width={40}
                height={40}
                className="landing-hero-logo"
              />
              Capture your&nbsp;
            </span>
            <span className="sr-only">
              Capture your travel, reunion, road trip, graduation, hangout,
              concert, first date, and everyday moments.
            </span>
          </h1>
          <HeroWordList words={WORDS} />
        </div>
      </header>

      <main className="landing-reveal">
        <section className="landing-pitch-section">
          <p className="landing-pitch">
            Whatever you capture
            <br />
            it becomes memory.
          </p>
          <LandingCta href="/camera">Capture your memory</LandingCta>
          <p className="landing-signin">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </section>

        <section>
          <div className="landing-how">
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
          </div>

          <div className="landing-showcase">
            <CoverflowCarousel
              slides={SCENES.map((scene) => ({
                src: scene.src,
                alt: scene.label,
                memory: scene.memory,
              }))}
              label="Photos developed with Capture Memory"
            />
            <p className="landing-showcase-hint">Tap the photo to flip it</p>
          </div>
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
