"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/auth/actions";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormField
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        required
      />

      {state?.error && (
        <p className="type-body-md text-[var(--color-error)]">
          {state.error}
        </p>
      )}

      <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
    </form>
  );
}
