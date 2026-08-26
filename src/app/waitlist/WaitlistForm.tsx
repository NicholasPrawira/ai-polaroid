"use client";

import { useActionState } from "react";
import { joinWaitlist } from "./actions";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";

export function WaitlistForm({ source }: { source?: string }) {
  const [state, formAction] = useActionState(joinWaitlist, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="source" value={source ?? "landing"} />
      <FormField
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
      />

      {state?.error && (
        <p className="type-body-md text-[var(--color-error)]">{state.error}</p>
      )}

      <SubmitButton pendingLabel="Adding you…">Join the waitlist</SubmitButton>

      <p className="type-viewfinder-label text-[var(--color-on-surface-variant)] opacity-70">
        One email when it opens. Nothing else.
      </p>
    </form>
  );
}
