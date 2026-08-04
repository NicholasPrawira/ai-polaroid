import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Sign up — AI Disposable Camera" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create an account"
      image="/scene-travel1.jpg"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--color-on-surface)] underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
