"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/auth/actions";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(login, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <FormField
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        required
      />

      <div>
        <FormField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
        <Link
          href="/forgot-password"
          className="type-viewfinder-label mt-1.5 block text-right text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
        >
          Forgot password?
        </Link>
      </div>

      {state?.error && (
        <p className="type-body-md text-[var(--color-error)]">
          {state.error}
        </p>
      )}

      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
