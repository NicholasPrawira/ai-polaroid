import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in — Capture Memory" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <AuthShell
      title="Sign in"
      image="/scene-everyday.jpg"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[var(--color-on-surface)] underline">
            Sign up
          </Link>
        </>
      }
    >
      {error === "link-expired" && (
        <p className="type-body-md mb-4 rounded-md bg-[var(--color-surface-container)] px-3.5 py-3 text-[var(--color-on-surface-variant)]">
          That link expired or was already used. Sign in, or request a fresh
          one from{" "}
          <Link href="/forgot-password" className="text-[var(--color-on-surface)] underline">
            reset password
          </Link>
          .
        </p>
      )}
      <LoginForm next={next ?? "/camera"} />
    </AuthShell>
  );
}
