import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { WaitlistForm } from "./WaitlistForm";

export const metadata: Metadata = {
  title: "Join the waitlist — Capture Memory",
  description:
    "Capture Memory is opening soon. Leave your email and we'll tell you the moment it does.",
};

export default async function WaitlistPage({
  searchParams,
}: {
  // Next 16: `searchParams` is a promise and has to be awaited.
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;

  return (
    <AuthShell title="Join the waitlist" image="/scene-first-date.jpg">
      <WaitlistForm source={from} />
    </AuthShell>
  );
}
