import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export const metadata: Metadata = { title: "Set a new password — Capture Memory" };

export default function UpdatePasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a password you haven't used before."
    >
      <UpdatePasswordForm />
    </AuthShell>
  );
}
