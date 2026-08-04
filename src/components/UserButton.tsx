"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { CloseIcon, MoonIcon, SunIcon, UserIcon } from "./Chrome";
import { useTheme } from "@/lib/useTheme";
import { redeemCode, signOut, type RedeemResult } from "@/app/actions";
import type { AccountSummary } from "@/lib/types";

const INITIAL: RedeemResult = { ok: false, message: "" };

/**
 * Account sheet: who you are, how many photos you have left, and where a promo
 * code gets redeemed. Settings live here too, which keeps the camera header
 * down to camera controls.
 */
export function UserButton({ account }: { account: AccountSummary }) {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const [redeemState, redeemAction] = useActionState(redeemCode, INITIAL);

  // The action returns the balance it wrote; lift it so the camera stops
  // refusing to shoot the moment a code lands.
  const { onCredits } = account;
  useEffect(() => {
    if (redeemState.ok && typeof redeemState.credits === "number") {
      onCredits(redeemState.credits);
    }
  }, [redeemState, onCredits]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Account and settings"
        className="relative grid h-10 w-10 place-items-center rounded-full border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container)]"
      >
        <UserIcon />
        {account.credits <= 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--color-error)]"
          />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/45"
          />

          <div className="relative max-h-[85dvh] overflow-y-auto rounded-t-xl bg-[var(--color-surface-container-low)] pb-[max(16px,env(safe-area-inset-bottom))]">
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--color-outline-variant)] bg-[var(--color-surface-container-low)] px-5 py-4">
              <h2 className="text-[15px] font-semibold">Account</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-on-surface-variant)]"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex items-center gap-4 px-5 py-5">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)]">
                <UserIcon />
              </span>
              <div className="min-w-0">
                <p className="type-body-md truncate">
                  {account.email ?? "Signed in"}
                </p>
                <p className="type-viewfinder-label mt-1 text-[var(--color-on-surface-variant)]">
                  photos are saved to your account
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-3 px-5 pb-5">
              {[
                ["credits", account.credits],
                ["photos", account.photoCount],
                ["folders", account.folderCount],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-md bg-[var(--color-surface-container)] px-3 py-3"
                >
                  <dt className="type-viewfinder-label text-[var(--color-on-surface-variant)]">
                    {label}
                  </dt>
                  <dd
                    className={`type-headline-lg mt-0.5 ${
                      label === "credits" && account.credits <= 0
                        ? "text-[var(--color-error)]"
                        : ""
                    }`}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            <form
              action={redeemAction}
              className="border-t border-[var(--color-outline-variant)] px-5 pt-4 pb-2"
            >
              <label
                htmlFor="promo-code"
                className="type-viewfinder-label text-[var(--color-on-surface-variant)]"
              >
                promo code
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  id="promo-code"
                  name="code"
                  autoCapitalize="characters"
                  autoComplete="off"
                  placeholder="e.g. FILMROLL"
                  className="type-body-md min-w-0 flex-1 rounded-md border border-[var(--color-outline-variant)] bg-transparent px-3 py-2.5 uppercase text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] focus:border-[var(--color-on-surface)] focus:outline-none"
                />
                <button
                  type="submit"
                  className="type-viewfinder-label h-11 shrink-0 rounded-md bg-[var(--color-primary)] px-4 text-[var(--color-on-primary)]"
                >
                  redeem
                </button>
              </div>
              {redeemState.message && (
                <p
                  role="status"
                  className={`type-timestamp-sm mt-2 ${
                    redeemState.ok
                      ? "text-[var(--color-on-surface-variant)]"
                      : "text-[var(--color-error)]"
                  }`}
                >
                  {redeemState.message}
                </p>
              )}
            </form>

            <div className="border-t border-[var(--color-outline-variant)] px-3 py-2">
              <button
                type="button"
                onClick={toggle}
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-[var(--color-surface-container)]"
              >
                <span className="text-[var(--color-on-surface-variant)]">
                  {theme === "dark" ? <SunIcon /> : <MoonIcon />}
                </span>
                <span className="type-body-md flex-1">
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </span>
              </button>

              {account.isAdmin && (
                <Link
                  href="/dashboard"
                  className="type-body-md flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-[var(--color-surface-container)]"
                >
                  Dashboard
                </Link>
              )}

              <form action={signOut}>
                <button
                  type="submit"
                  className="type-body-md w-full rounded-md px-3 py-3 text-left text-[var(--color-error)] transition-colors hover:bg-[var(--color-surface-container)]"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
