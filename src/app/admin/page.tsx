import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/admin";
import { addPhotoQuota, setPro } from "./actions";

const AI_DEVELOP_COST_USD = 0.06;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  // Belt-and-suspenders with the proxy redirect — this is what actually
  // decides what renders, the proxy just avoids a wasted round-trip.
  if (claims?.claims?.email !== ADMIN_EMAIL) redirect("/camera");

  // A narrow RPC rather than a `photos` select — this app has no service
  // role key, and admin has no SELECT policy on `photos` (deliberately,
  // photo content stays private even from the admin's own client). The RPC
  // hands back counts only, self-checking admin status server-side.
  const [{ data: stats, error: statsError }, profilesQuery] = await Promise.all([
    supabase.rpc("admin_stats").single(),
    (() => {
      let query = supabase
        .from("profiles")
        .select()
        .order("created_at", { ascending: false });
      if (q) query = query.ilike("email", `%${q}%`);
      return query;
    })(),
  ]);
  if (statsError) throw statsError;
  const { data: profiles, error } = profilesQuery;
  if (error) throw error;

  const estimatedCost = (stats?.ai_photos ?? 0) * AI_DEVELOP_COST_USD;

  return (
    <main className="min-h-dvh bg-[var(--color-surface)] px-6 py-10 text-[var(--color-on-surface)]">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-[22px] font-semibold">Admin</h1>
        <p className="type-body-md mt-1 text-[var(--color-on-surface-variant)]">
          {stats?.total_users ?? 0} account{stats?.total_users === 1 ? "" : "s"}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["users", stats?.total_users ?? 0],
            ["pro", stats?.pro_users ?? 0],
            ["AI photos", stats?.ai_photos ?? 0],
            ["est. cost", `$${estimatedCost.toFixed(2)}`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-md border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-low)] px-4 py-3"
            >
              <dt className="type-viewfinder-label text-[var(--color-on-surface-variant)]">
                {label}
              </dt>
              <dd className="text-[20px] font-semibold">{value}</dd>
            </div>
          ))}
        </dl>

        <form method="get" className="mt-6">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by email…"
            className="w-full rounded-md border border-[var(--color-outline-variant)] bg-transparent px-3 py-2 text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]"
          />
        </form>

        <ul className="mt-6 space-y-3">
          {profiles.length === 0 && (
            <p className="type-body-md text-center text-[var(--color-on-surface-variant)]">
              No accounts match &ldquo;{q}&rdquo;.
            </p>
          )}
          {profiles.map((p) => (
            <li
              key={p.user_id}
              className="rounded-md border border-[var(--color-outline-variant)] bg-[var(--color-surface-container-low)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="type-body-md truncate">{p.email}</p>
                <form
                  action={async () => {
                    "use server";
                    await setPro(p.user_id, !p.is_pro);
                  }}
                >
                  <button
                    type="submit"
                    className={`type-viewfinder-label rounded-sm px-3 py-1.5 ${
                      p.is_pro
                        ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                        : "border border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)]"
                    }`}
                  >
                    {p.is_pro ? "Pro" : "Free"}
                  </button>
                </form>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="type-viewfinder-label text-[var(--color-on-surface-variant)]">
                  {p.photo_quota} photo{p.photo_quota === 1 ? "" : "s"} left
                </p>

                <form
                  action={async (formData) => {
                    "use server";
                    const amount = Number(formData.get("amount"));
                    await addPhotoQuota(p.user_id, amount);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="number"
                    name="amount"
                    defaultValue={10}
                    aria-label="Photos to add"
                    className="w-20 rounded-md border border-[var(--color-outline-variant)] bg-transparent px-2 py-1.5 text-[var(--color-on-surface)]"
                  />
                  <button
                    type="submit"
                    className="type-viewfinder-label rounded-md border border-[var(--color-outline-variant)] px-3 py-1.5 text-[var(--color-on-surface)] transition-colors hover:bg-[var(--color-surface-container)]"
                  >
                    Add photos
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
