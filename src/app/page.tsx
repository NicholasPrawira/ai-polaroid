import { CameraApp } from "@/components/CameraApp";
import { Landing } from "@/components/Landing";
import { getFolders, getProfile, getShots } from "@/lib/data";

// Photos and credits are per-account and change on every capture, so there is
// nothing here worth caching between requests.
export const dynamic = "force-dynamic";

export default async function Home() {
  const profile = await getProfile();

  // Signed out, this is the front door rather than a redirect to a form. The
  // absence of a profile is also what guards the app below — the proxy is only
  // an optimistic shortcut, this is the check that counts.
  if (!profile) return <Landing />;

  const [shots, folders] = await Promise.all([getShots(), getFolders()]);

  return (
    <CameraApp
      initialShots={shots}
      initialFolders={folders}
      profile={profile}
    />
  );
}
