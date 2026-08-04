"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/auth/actions";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState(updatePassword, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormField
        label="New password"
        type="password"
        name="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <FormField
        label="Confirm new password"
        type="password"
        name="confirm"
        autoComplete="new-password"
        minLength={8}
        required
      />

      {state?.error && (
        <p className="type-body-md text-[var(--color-error)]">
          {state.error}
        </p>
      )}

      <SubmitButton pendingLabel="Saving…">Save password</SubmitButton>
    </form>
  );
}
