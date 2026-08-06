import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = { title: "Check your email — Capture Memory" };

export default function CheckEmailPage() {
  return (
    <AuthShell
      title="Check your email"
      subtitle="If an account exists for that address, a reset link is on its way. It's valid for a limited time."
    />
  );
}
