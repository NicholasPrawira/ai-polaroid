"use client";

import { useState } from "react";
import Image from "next/image";
import { PolaroidFrame } from "./PolaroidFrame";
import {
  DownloadIcon,
  PrimaryButton,
  RefreshIcon,
  SecondaryButton,
} from "./Chrome";
import { ThemeToggle } from "./ThemeToggle";
import { Shot } from "@/lib/types";
import { downloadShot } from "@/lib/export";

export function ResultScreen({
  shot,
  onNewPhoto,
}: {
  shot: Shot;
  onNewPhoto: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await downloadShot(shot);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="grid grid-cols-[40px_1fr_40px] items-center px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2">
        <ThemeToggle />
        <h1 className="text-center text-[17px] font-semibold">AI Polaroid</h1>
        <span />
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-8">
        <div className="w-full max-w-[300px]">
          <PolaroidFrame lifted>
            <Image
              src={shot.imageUrl}
              alt="Developed polaroid"
              fill
              unoptimized
              sizes="300px"
              className="object-cover"
            />
          </PolaroidFrame>
        </div>
      </div>

      <div className="space-y-3 px-6 pb-5">
        {saveError && (
          <p className="type-timestamp-sm text-center text-[var(--color-error)]">
            {saveError}
          </p>
        )}
        <PrimaryButton onClick={handleSave} icon={<DownloadIcon />}>
          {saving ? "Saving…" : "Save to Gallery"}
        </PrimaryButton>
        <SecondaryButton onClick={onNewPhoto} icon={<RefreshIcon />}>
          New Photo
        </SecondaryButton>
      </div>
    </div>
  );
}
