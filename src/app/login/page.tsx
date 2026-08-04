import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in — AI Disposable Camera" };

export default function LoginPage() {
  return (
    <main className="paper grain flex min-h-dvh flex-col">
      <div className="grain-layer" />
      <div className="relative z-2 flex min-h-dvh flex-col items-center justify-center px-8">
        <h1 className="type-headline-lg text-center">AI Disposable Camera</h1>
        <p className="type-body-md mt-2 mb-8 max-w-[280px] text-center text-[var(--color-on-surface-variant)]">
          Sign in so your photos are still here tomorrow.
        </p>

        <LoginForm />

        <p className="type-viewfinder-label mt-8 max-w-[280px] text-center leading-4 text-[var(--color-on-surface-variant)] opacity-60">
          No password. We email you a link that signs you in.
        </p>
      </div>
    </main>
  );
}
