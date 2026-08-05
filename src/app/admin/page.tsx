import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/admin";
import { addPhotoQuota, setPro } from "./actions";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  // Belt-and-suspenders with the proxy redirect — this is what actually
  // decides what renders, the proxy just avoids a wasted round-trip.
  if (claims?.claims?.email !== ADMIN_EMAIL) redirect("/camera");

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select()
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (
    <main className="min-h-dvh bg-[var(--color-surface)] px-6 py-10 text-[var(--color-on-surface)]">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-[22px] font-semibold">Admin</h1>
        <p className="type-body-md mt-1 text-[var(--color-on-surface-variant)]">
          {profiles.length} account{profiles.length === 1 ? "" : "s"}
        </p>

        <ul className="mt-6 space-y-3">
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
                  {p.is_pro
                    ? "Unlimited photos"
                    : `${p.photo_quota} photo${p.photo_quota === 1 ? "" : "s"} left`}
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
