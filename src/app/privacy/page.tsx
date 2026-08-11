import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeftIcon } from "@/components/Chrome";

export const metadata: Metadata = { title: "Privacy & data | Capture Memory" };

const SECTIONS = [
  {
    heading: "What we store",
    body: "Your email and password are handled entirely by Supabase Auth, so we never see or store your password ourselves. Everything else you create in the app, including photos, captions, voice notes, and folders, is stored under your account.",
  },
  {
    heading: "Who can see your photos",
    body: "Only you. Photos and voice notes live in a private storage bucket, gated by row-level security tied to your account. It's not a shared folder and not a public link. Nothing is indexed, listed, or served to anyone else, including us browsing casually.",
  },
  {
    heading: "How photos are developed",
    body: "The disposable-camera look, including grain, color, and vignette, is applied on your device using a fixed color-grading preset. No photo is sent to a third-party AI service or external server to be processed; the pixels never leave your library.",
  },
  {
    heading: "Third parties",
    body: "None. There's no analytics, no tracking pixels, no ad network, and no third-party processor with access to your photos. The only infrastructure involved is Supabase, which hosts the database and file storage this app runs on.",
  },
  {
    heading: "Deleting your data",
    body: "Deleting a photo removes it immediately, storage object included. Deleting your account removes every photo, voice note, folder, and the account itself, permanently, with nothing held back. Both are available from the account menu.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-[var(--color-surface)] text-[var(--color-on-surface)]">
      <div className="mx-auto max-w-xl px-6 py-10 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[var(--color-on-surface-variant)] transition-colors hover:text-[var(--color-on-surface)]"
        >
          <ChevronLeftIcon />
          <span className="type-viewfinder-label">Back</span>
        </Link>

        <h1 className="type-headline-lg mt-6 text-[28px]">Privacy &amp; data</h1>
        <p className="type-body-md mt-2 text-[var(--color-on-surface-variant)]">
          A short, plain-language account of what Capture Memory stores and
          who can see it.
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="type-body-md font-semibold">{section.heading}</h2>
              <p className="type-body-md mt-1.5 text-[var(--color-on-surface-variant)]">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        <p className="type-timestamp-sm mt-12 text-[var(--color-on-surface-variant)] opacity-60">
          Questions about your data? Reach out at{" "}
          <a
            href="https://instagram.com/capturememory.app"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            @capturememory.app
          </a>
          .
        </p>
      </div>
    </main>
  );
}
