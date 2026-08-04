import { redirect } from "next/navigation";
import { CameraApp } from "@/components/CameraApp";
import { getFolders, getProfile, getShots } from "@/lib/data";

// Photos and credits are per-account and change on every capture, so there is
// nothing here worth caching between requests.
export const dynamic = "force-dynamic";

export default async function Home() {
  const profile = await getProfile();

  // The proxy redirects signed-out visitors already. This is the check that
  // actually guards the data — the proxy is only an optimistic shortcut.
  if (!profile) redirect("/login");

  const [shots, folders] = await Promise.all([getShots(), getFolders()]);

  return (
    <CameraApp
      initialShots={shots}
      initialFolders={folders}
      profile={profile}
    />
  );
}
