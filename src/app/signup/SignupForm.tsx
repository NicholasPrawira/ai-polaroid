"use client";

import { useActionState } from "react";
import { signup } from "@/app/auth/actions";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";

export function SignupForm() {
  const [state, formAction] = useActionState(signup, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormField
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        required
      />
      <FormField
        label="Password"
        type="password"
        name="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <p className="type-viewfinder-label -mt-2 text-[var(--color-on-surface-variant)] opacity-70">
        at least 8 characters
      </p>

      {state?.error && (
        <p className="type-body-md text-[var(--color-error)]">
          {state.error}
        </p>
      )}

      <SubmitButton pendingLabel="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
