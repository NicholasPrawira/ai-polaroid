import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = { title: "You're on the list — Capture Memory" };

export default function WaitlistThanksPage() {
  return (
    <AuthShell
      title="You're on the list"
      subtitle="That's it — nothing else to do. We'll email you once there's a camera to hand you."
      image="/scene-everyday.jpg"
      footer={
        <Link href="/" className="text-[var(--color-on-surface)] underline">
          Back to home
        </Link>
      }
    />
  );
}
