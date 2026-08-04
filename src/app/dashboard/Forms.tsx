"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createPromoCode,
  grantCredits,
  type CodeFormState,
  type GrantState,
} from "./actions";

const FIELD =
  "type-body-md w-full rounded-md border border-[var(--color-outline-variant)] bg-transparent px-3 py-2.5 text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] focus:border-[var(--color-on-surface)] focus:outline-none";

const LABEL = "type-viewfinder-label text-[var(--color-on-surface-variant)]";

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="type-body-md h-11 rounded-md bg-[var(--color-primary)] px-5 font-medium text-[var(--color-on-primary)] transition-opacity disabled:opacity-50"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

function Result({ state }: { state: { ok: boolean; message: string } }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`type-timestamp-sm ${
        state.ok
          ? "text-[var(--color-on-surface-variant)]"
          : "text-[var(--color-error)]"
      }`}
    >
      {state.message}
    </p>
  );
}

const NO_CODE: CodeFormState = { ok: false, message: "" };
const NO_GRANT: GrantState = { ok: false, message: "" };

export function CreateCodeForm() {
  const [state, action] = useActionState(createPromoCode, NO_CODE);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="code">
            code
          </label>
          <input
            id="code"
            name="code"
            placeholder="leave blank to generate"
            autoCapitalize="characters"
            autoComplete="off"
            className={`${FIELD} mt-1.5 uppercase`}
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="credits">
            photo credits
          </label>
          <input
            id="credits"
            name="credits"
            type="number"
            min={1}
            defaultValue={10}
            required
            className={`${FIELD} mt-1.5`}
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="max_redemptions">
            claim limit
          </label>
          <input
            id="max_redemptions"
            name="max_redemptions"
            type="number"
            min={1}
            placeholder="blank = unlimited"
            className={`${FIELD} mt-1.5`}
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="expires_at">
            expires
          </label>
          <input
            id="expires_at"
            name="expires_at"
            type="date"
            className={`${FIELD} mt-1.5`}
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="target_email">
            voucher for (optional)
          </label>
          <input
            id="target_email"
            name="target_email"
            type="email"
            placeholder="only this address can claim it"
            className={`${FIELD} mt-1.5`}
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="note">
            note
          </label>
          <input
            id="note"
            name="note"
            placeholder="what this is for"
            className={`${FIELD} mt-1.5`}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Submit>Create code</Submit>
        <Result state={state} />
      </div>
    </form>
  );
}

export function GrantForm() {
  const [state, action] = useActionState(grantCredits, NO_GRANT);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="grant-email">
            account
          </label>
          <input
            id="grant-email"
            name="email"
            type="email"
            required
            placeholder="them@example.com"
            className={`${FIELD} mt-1.5`}
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="grant-credits">
            credits to add
          </label>
          <input
            id="grant-credits"
            name="credits"
            type="number"
            defaultValue={10}
            required
            className={`${FIELD} mt-1.5`}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Submit>Give credits</Submit>
        <Result state={state} />
      </div>

      <p className="type-viewfinder-label text-[var(--color-on-surface-variant)] opacity-70">
        Lands straight in their balance — nothing to redeem. Use a negative
        number to take credits back.
      </p>
    </form>
  );
}
