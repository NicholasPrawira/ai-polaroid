"use client";

import { useState } from "react";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  CreditCardIcon,
  KeyIcon,
  LogOutIcon,
  MoonIcon,
  ShieldIcon,
  SparkIcon,
  SunIcon,
  UserIcon,
} from "./Chrome";
import { useTheme } from "@/lib/useTheme";

/**
 * Account menu.
 *
 * The structure is real; most of it is not wired to anything, because there are
 * no accounts and no billing yet. Rows that can't work say so when tapped
 * rather than silently doing nothing — a dead control reads as a bug, and this
 * one at least tells you what it's waiting on.
 */

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    current: true,
    features: [
      "10 AI develops per day",
      "Photos kept for the session only",
      "Unlimited folders",
      "Save to your device",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$4",
    period: "per month",
    current: false,
    features: [
      "Unlimited AI develops",
      "Photos backed up and synced",
      "Shared folders for events",
      "Full-resolution export",
    ],
  },
] as const;

type View = "menu" | "pricing";

export function UserButton({
  photoCount,
  folderCount,
}: {
  photoCount: number;
  folderCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [pending, setPending] = useState<string | null>(null);
  const { theme, toggle } = useTheme();

  function close() {
    setOpen(false);
    setView("menu");
    setPending(null);
  }

  const rows = [
    { id: "password", label: "Change password", icon: <KeyIcon /> },
    { id: "billing", label: "Billing & invoices", icon: <CreditCardIcon /> },
    { id: "privacy", label: "Privacy & data", icon: <ShieldIcon /> },
    { id: "signout", label: "Sign out", icon: <LogOutIcon /> },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Account and settings"
        className="grid h-10 w-10 place-items-center rounded-full border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container)]"
      >
        <UserIcon />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute inset-0 bg-black/45"
          />

          <div className="relative max-h-[88dvh] overflow-y-auto rounded-t-xl bg-[var(--color-surface-container-low)] pb-[max(16px,env(safe-area-inset-bottom))]">
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--color-outline-variant)] bg-[var(--color-surface-container-low)] px-5 py-4">
              {view === "pricing" && (
                <button
                  type="button"
                  onClick={() => setView("menu")}
                  aria-label="Back"
                  className="-ml-2 grid h-8 w-8 place-items-center rounded-md text-[var(--color-on-surface-variant)]"
                >
                  <ChevronLeftIcon />
                </button>
              )}
              <h2 className="flex-1 text-[15px] font-semibold">
                {view === "pricing" ? "Plans" : "Account"}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-md text-[var(--color-on-surface-variant)]"
              >
                <CloseIcon />
              </button>
            </div>

            {view === "pricing" ? (
              <div className="space-y-3 px-5 py-5">
                {PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    className={`rounded-md border p-4 ${
                      plan.current
                        ? "border-[var(--color-on-surface)]"
                        : "border-[var(--color-outline-variant)]"
                    }`}
                  >
                    <div className="flex items-baseline justify-between">
                      <h3 className="type-body-md font-semibold">
                        {plan.name}
                        {plan.current && (
                          <span className="type-viewfinder-label ml-2 rounded-sm bg-[var(--color-surface-container-high)] px-1.5 py-0.5 align-middle text-[var(--color-on-surface-variant)]">
                            current
                          </span>
                        )}
                      </h3>
                      <p className="type-body-md">
                        {plan.price}
                        <span className="type-viewfinder-label ml-1 text-[var(--color-on-surface-variant)]">
                          {plan.period}
                        </span>
                      </p>
                    </div>

                    <ul className="mt-3 space-y-1.5">
                      {plan.features.map((f) => (
                        <li
                          key={f}
                          className="type-viewfinder-label flex items-start gap-2 text-[var(--color-on-surface-variant)]"
                        >
                          <span className="mt-px shrink-0">
                            <CheckIcon />
                          </span>
                          {f}
                        </li>
                      ))}
                    </ul>

                    {!plan.current && (
                      <button
                        type="button"
                        onClick={() => setPending("billing")}
                        className="type-button-text mt-4 w-full rounded-md bg-[var(--color-primary)] px-4 py-3 text-[var(--color-on-primary)]"
                      >
                        Upgrade to {plan.name}
                      </button>
                    )}
                  </div>
                ))}

                <p className="type-viewfinder-label pt-1 leading-4 text-[var(--color-on-surface-variant)] opacity-60">
                  Prices and limits are placeholders — nothing is charged, and no
                  payment provider is connected.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 px-5 py-5">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)]">
                    <UserIcon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="type-body-md">Not signed in</p>
                    <p className="type-viewfinder-label mt-1 text-[var(--color-on-surface-variant)]">
                      photos live on this device only
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPending("auth")}
                    className="type-button-text shrink-0 rounded-md border border-[var(--color-outline-variant)] px-3.5 py-2.5"
                  >
                    Sign in
                  </button>
                </div>

                <dl className="grid grid-cols-2 gap-3 px-5 pb-4">
                  {[
                    ["photos", photoCount],
                    ["folders", folderCount],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-md bg-[var(--color-surface-container)] px-4 py-3"
                    >
                      <dt className="type-viewfinder-label text-[var(--color-on-surface-variant)]">
                        {label}
                      </dt>
                      <dd className="type-headline-lg mt-0.5">{value}</dd>
                    </div>
                  ))}
                </dl>

                <button
                  type="button"
                  onClick={() => setView("pricing")}
                  className="mx-5 mb-2 flex w-[calc(100%-40px)] items-center gap-3 rounded-md border border-[var(--color-outline-variant)] px-4 py-3.5 text-left transition-colors hover:bg-[var(--color-surface-container)]"
                >
                  <span className="text-[var(--color-film-amber)]">
                    <SparkIcon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="type-body-md block">Upgrade to Pro</span>
                    <span className="type-viewfinder-label text-[var(--color-on-surface-variant)]">
                      on Free — 10 develops a day
                    </span>
                  </span>
                  <ChevronRightIcon />
                </button>

                <ul className="px-3 py-1">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => setPending(row.id)}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-[var(--color-surface-container)]"
                      >
                        <span className="text-[var(--color-on-surface-variant)]">
                          {row.icon}
                        </span>
                        <span className="type-body-md flex-1">{row.label}</span>
                        <ChevronRightIcon />
                      </button>
                    </li>
                  ))}

                  <li>
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
                  </li>
                </ul>
              </>
            )}

            {pending && (
              <p className="mx-5 mt-3 rounded-md bg-[var(--color-surface-container)] px-4 py-3 text-[13px] leading-5 text-[var(--color-on-surface-variant)]">
                {pending === "auth"
                  ? "Accounts aren't built yet. Until they are, photos and folders live in this browser tab and clear on refresh."
                  : pending === "billing"
                    ? "No payment provider is connected, so nothing can be charged. Plans are a sketch, not an offer."
                    : pending === "password"
                      ? "There's no password to change — sign-in doesn't exist yet."
                      : pending === "privacy"
                        ? "Nothing leaves this device except the photo sent for developing, which isn't stored anywhere."
                        : "You aren't signed in, so there's nothing to sign out of."}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
