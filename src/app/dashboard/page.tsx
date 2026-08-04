import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/data";
import { CreateCodeForm, GrantForm } from "./Forms";
import { deleteCode, setCodeActive } from "./actions";

export const metadata: Metadata = { title: "Dashboard — AI Disposable Camera" };
export const dynamic = "force-dynamic";

type CodeRow = {
  id: string;
  code: string;
  credits: number;
  max_redemptions: number | null;
  redeemed_count: number;
  expires_at: string | null;
  active: boolean;
  target_email: string | null;
  note: string | null;
  created_at: string;
};

function describe(code: CodeRow): { label: string; spent: boolean } {
  if (!code.active) return { label: "off", spent: true };
  if (code.expires_at && new Date(code.expires_at) < new Date()) {
    return { label: "expired", spent: true };
  }
  if (
    code.max_redemptions !== null &&
    code.redeemed_count >= code.max_redemptions
  ) {
    return { label: "claimed out", spent: true };
  }
  return { label: "live", spent: false };
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg bg-[var(--color-surface-container-low)] p-5">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {description && (
        <p className="type-viewfinder-label mt-1 mb-4 text-[var(--color-on-surface-variant)]">
          {description}
        </p>
      )}
      <div className={description ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

export default async function DashboardPage() {
  const profile = await getProfile();

  // 404 rather than 403: a non-admin has no reason to learn this page exists.
  if (!profile?.isAdmin) notFound();

  const supabase = await createClient();

  const [{ data: codes }, { data: people }, { data: claims }] =
    await Promise.all([
      supabase
        .from("promo_codes")
        .select(
          "id, code, credits, max_redemptions, redeemed_count, expires_at, active, target_email, note, created_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, email, credits, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("redemptions")
        .select("id, credits, redeemed_at, promo_codes(code), profiles(email)")
        .order("redeemed_at", { ascending: false })
        .limit(25),
    ]);

  const rows = (codes ?? []) as CodeRow[];

  return (
    <main className="paper grain min-h-dvh">
      <div className="grain-layer" />
      <div className="relative z-2 mx-auto max-w-3xl px-5 py-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="type-headline-lg">Dashboard</h1>
            <p className="type-viewfinder-label mt-1 text-[var(--color-on-surface-variant)]">
              {profile.email}
            </p>
          </div>
          <Link
            href="/"
            className="type-viewfinder-label rounded-md border border-[var(--color-outline-variant)] px-3.5 py-2.5 transition-colors hover:bg-[var(--color-surface-container)]"
          >
            back to camera
          </Link>
        </header>

        <div className="space-y-4">
          <Card
            title="New promo code"
            description="One credit is one developed photo. Add an address to make it a voucher only that person can claim."
          >
            <CreateCodeForm />
          </Card>

          <Card
            title="Give credits directly"
            description="For when you would rather not make somebody type a code."
          >
            <GrantForm />
          </Card>

          <Card title="Codes">
            {rows.length === 0 ? (
              <p className="type-body-md text-[var(--color-on-surface-variant)]">
                No codes yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-outline-variant)]">
                {rows.map((code) => {
                  const status = describe(code);
                  return (
                    <li
                      key={code.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="type-timestamp-sm flex items-center gap-2">
                          <span className="font-bold tracking-wider">
                            {code.code}
                          </span>
                          <span
                            className={`type-viewfinder-label rounded-sm px-1.5 py-0.5 ${
                              status.spent
                                ? "bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)]"
                                : "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                            }`}
                          >
                            {status.label}
                          </span>
                        </p>
                        <p className="type-viewfinder-label mt-1 text-[var(--color-on-surface-variant)]">
                          {code.credits} credits · claimed{" "}
                          {code.redeemed_count}
                          {code.max_redemptions !== null
                            ? `/${code.max_redemptions}`
                            : ""}
                          {code.target_email ? ` · for ${code.target_email}` : ""}
                          {code.expires_at
                            ? ` · until ${new Date(code.expires_at).toLocaleDateString()}`
                            : ""}
                        </p>
                        {code.note && (
                          <p className="type-viewfinder-label mt-0.5 text-[var(--color-on-surface-variant)] opacity-70">
                            {code.note}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <form action={setCodeActive.bind(null, code.id, !code.active)}>
                          <button
                            type="submit"
                            className="type-viewfinder-label rounded-md border border-[var(--color-outline-variant)] px-3 py-2 transition-colors hover:bg-[var(--color-surface-container)]"
                          >
                            {code.active ? "turn off" : "turn on"}
                          </button>
                        </form>

                        {code.redeemed_count === 0 && (
                          <form action={deleteCode.bind(null, code.id)}>
                            <button
                              type="submit"
                              className="type-viewfinder-label rounded-md px-3 py-2 text-[var(--color-error)] transition-colors hover:bg-[var(--color-surface-container)]"
                            >
                              delete
                            </button>
                          </form>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Recent claims">
            {(claims ?? []).length === 0 ? (
              <p className="type-body-md text-[var(--color-on-surface-variant)]">
                Nobody has redeemed anything yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-outline-variant)]">
                {(claims ?? []).map((claim) => {
                  // PostgREST returns embedded rows as objects here, but its
                  // generated types allow arrays for to-many shapes.
                  const code = Array.isArray(claim.promo_codes)
                    ? claim.promo_codes[0]
                    : claim.promo_codes;
                  const who = Array.isArray(claim.profiles)
                    ? claim.profiles[0]
                    : claim.profiles;
                  return (
                    <li
                      key={claim.id}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="type-body-md truncate">
                          {who?.email ?? "unknown"}
                        </p>
                        <p className="type-viewfinder-label mt-0.5 text-[var(--color-on-surface-variant)]">
                          {code?.code ?? "—"} ·{" "}
                          {new Date(claim.redeemed_at).toLocaleString()}
                        </p>
                      </div>
                      <span className="type-timestamp-sm shrink-0">
                        +{claim.credits}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Accounts">
            <ul className="divide-y divide-[var(--color-outline-variant)]">
              {(people ?? []).map((person) => (
                <li
                  key={person.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="type-body-md truncate">
                      {person.email ?? person.id}
                    </p>
                    <p className="type-viewfinder-label mt-0.5 text-[var(--color-on-surface-variant)]">
                      joined {new Date(person.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="type-timestamp-sm shrink-0">
                    {person.credits}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </main>
  );
}
