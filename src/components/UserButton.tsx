"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  CreditCardIcon,
  KeyIcon,
  LogOutIcon,
  ShieldIcon,
  SparkIcon,
  TrashIcon,
  UserIcon,
} from "./Chrome";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/auth/actions";
import { Profile } from "@/lib/types";

/**
 * Account menu.
 *
 * Only renders inside /camera, which middleware gates to signed-in users — so
 * a session can be assumed present. Change password, Sign out, and the
 * photo/folder counts are real. Billing still isn't wired to anything,
 * because there's no payment provider; it says so when tapped rather than
 * silently doing nothing.
 */

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    current: true,
    features: [
      "1 photo",
      "Photos saved to your account",
      "Unlimited folders",
      "Save to your device",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$9",
    period: "per month",
    current: false,
    features: [
      "Unlimited photos",
      "Shared folders for events",
      "Full-resolution export",
    ],
  },
] as const;

type View = "menu" | "pricing" | "delete";

export function UserButton({
  photoCount,
  folderCount,
  profile,
}: {
  photoCount: number;
  folderCount: number;
  /** Owned by the page — a develop decrements it immediately, so this stays
   *  live instead of only refreshing whenever the sheet happens to open. */
  profile: Profile | null;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [pending, setPending] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // /camera is auth-gated by middleware, so a session is guaranteed to exist
  // by the time this mounts — this just fetches which one, from the Auth
  // server rather than trusting the local session's cached copy.
  useEffect(() => {
    if (!open || email) return;
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, [open, email]);

  function close() {
    setOpen(false);
    setView("menu");
    setPending(null);
    setDeleteError(null);
  }

  // Storage objects have no FK link to auth.users, so they're removed here
  // via the Storage API (direct SQL delete is blocked by a Supabase
  // protection trigger) before the account row — and everything it cascades
  // to — is dropped by the delete_own_account() RPC.
  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    const supabase = createClient();
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (uid) {
        const { data: rows } = await supabase
          .from("photos")
          .select("storage_path")
          .eq("user_id", uid);
        const paths = (rows ?? []).map((r) => r.storage_path);
        if (paths.length > 0) {
          await supabase.storage.from("photos").remove(paths);
        }
      }

      const { error } = await supabase.rpc("delete_own_account");
      if (error) throw error;

      await supabase.auth.signOut();
      window.location.assign("/");
    } catch (err) {
      setDeleting(false);
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Could not delete your account. Try again.",
      );
    }
  }

  const rows = [
    { id: "billing", label: "Billing & invoices", icon: <CreditCardIcon /> },
    { id: "privacy", label: "Privacy & data", icon: <ShieldIcon /> },
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
              {view !== "menu" && (
                <button
                  type="button"
                  onClick={() => {
                    setView("menu");
                    setDeleteError(null);
                  }}
                  aria-label="Back"
                  className="-ml-2 grid h-8 w-8 place-items-center rounded-md text-[var(--color-on-surface-variant)]"
                >
                  <ChevronLeftIcon />
                </button>
              )}
              <h2 className="flex-1 text-[15px] font-semibold">
                {view === "pricing"
                  ? "Plans"
                  : view === "delete"
                    ? "Delete account"
                    : "Account"}
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
                  Prices are a sketch — nothing is charged, and no payment
                  provider is connected.
                </p>
              </div>
            ) : view === "delete" ? (
              <div className="space-y-4 px-5 py-5">
                <p className="type-body-md">
                  This deletes your account, every photo in your library, and
                  every folder — permanently. There&apos;s no way to undo this.
                </p>
                {deleteError && (
                  <p className="type-timestamp-sm text-[var(--color-error)]">
                    {deleteError}
                  </p>
                )}
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleDeleteAccount}
                    className="type-button-text w-full rounded-md bg-[var(--color-error)] px-4 py-3 text-white disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Yes, delete my account"}
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setView("menu")}
                    className="type-button-text w-full rounded-md border border-[var(--color-outline-variant)] px-4 py-3 text-[var(--color-on-surface)] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 px-5 py-5">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)]">
                    <UserIcon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="type-body-md truncate">{email ?? "…"}</p>
                    <p className="type-viewfinder-label mt-1 text-[var(--color-on-surface-variant)]">
                      signed in
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-3 gap-3 px-5 pb-4">
                  {[
                    ["photos", photoCount],
                    ["folders", folderCount],
                    [
                      "left",
                      profile ? (profile.is_pro ? "∞" : profile.photo_quota) : "…",
                    ],
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

                {!profile?.is_pro && (
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
                        on Free — {profile?.photo_quota ?? "…"} photos left
                      </span>
                    </span>
                    <ChevronRightIcon />
                  </button>
                )}

                <ul className="px-3 py-1">
                  <li>
                    <Link
                      href="/update-password"
                      className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-[var(--color-surface-container)]"
                    >
                      <span className="text-[var(--color-on-surface-variant)]">
                        <KeyIcon />
                      </span>
                      <span className="type-body-md flex-1">
                        Change password
                      </span>
                      <ChevronRightIcon />
                    </Link>
                  </li>

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
                      disabled={signingOut}
                      onClick={() => {
                        setSigningOut(true);
                        signOut();
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-[var(--color-surface-container)] disabled:opacity-50"
                    >
                      <span className="text-[var(--color-on-surface-variant)]">
                        <LogOutIcon />
                      </span>
                      <span className="type-body-md flex-1">
                        {signingOut ? "Signing out…" : "Sign out"}
                      </span>
                    </button>
                  </li>

                  <li>
                    <button
                      type="button"
                      onClick={() => setView("delete")}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-[var(--color-error)] transition-colors hover:bg-[var(--color-surface-container)]"
                    >
                      <span>
                        <TrashIcon />
                      </span>
                      <span className="type-body-md flex-1">
                        Delete account
                      </span>
                      <ChevronRightIcon />
                    </button>
                  </li>
                </ul>
              </>
            )}

            {pending && (
              <p className="mx-5 mt-3 rounded-md bg-[var(--color-surface-container)] px-4 py-3 text-[13px] leading-5 text-[var(--color-on-surface-variant)]">
                {pending === "billing"
                  ? "No payment provider is connected, so nothing can be charged. Plans are a sketch, not an offer."
                  : "Your email and password are stored by Supabase Auth. Developed photos are stored in your private library — only you can access them."}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
