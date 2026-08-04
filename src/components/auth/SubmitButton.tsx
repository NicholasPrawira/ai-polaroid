"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="type-button-text w-full rounded-md bg-[var(--color-primary)] px-4 py-3.5 text-[var(--color-on-primary)] transition-transform active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
