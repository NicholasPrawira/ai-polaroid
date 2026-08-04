"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestMagicLink, type LoginState } from "./actions";

const INITIAL: LoginState = { status: "idle", message: "" };

function Submit({ sent }: { sent: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="type-body-md h-12 w-full rounded-md bg-[var(--color-primary)] font-medium text-[var(--color-on-primary)] transition-opacity disabled:opacity-50"
    >
      {pending ? "Sending…" : sent ? "Send another link" : "Send sign-in link"}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(requestMagicLink, INITIAL);

  return (
    <form action={action} className="w-full max-w-[320px] space-y-3">
      <input
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        aria-label="Email address"
        className="type-body-md h-12 w-full rounded-md border border-[var(--color-outline-variant)] bg-transparent px-4 text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] focus:border-[var(--color-on-surface)] focus:outline-none"
      />

      <Submit sent={state.status === "sent"} />

      {state.message && (
        <p
          role="status"
          className={`type-timestamp-sm text-center ${
            state.status === "error"
              ? "text-[var(--color-error)]"
              : "text-[var(--color-on-surface-variant)]"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
