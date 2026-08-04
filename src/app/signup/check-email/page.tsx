import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = { title: "Check your email — AI Disposable Camera" };

export default function CheckEmailPage() {
  return (
    <AuthShell
      title="Check your email"
      subtitle="We sent a confirmation link to finish creating your account. It's valid for a limited time — if it's expired, sign up again to get a fresh one."
    />
  );
}
