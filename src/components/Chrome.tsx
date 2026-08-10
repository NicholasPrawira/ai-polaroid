"use client";

import { Screen } from "@/lib/types";

/** Double-ringed physical shutter. Inner disc depresses on tap. */
export function ShutterButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Take photo"
      className="group relative grid h-[76px] w-[76px] place-items-center rounded-full border-2 border-[var(--color-on-surface)] transition-opacity disabled:opacity-40"
    >
      <span
        className="block h-[60px] w-[60px] rounded-full bg-gradient-to-b from-white to-[var(--color-surface-container-high)] transition-transform duration-100 group-active:scale-90"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.18)" }}
      />
    </button>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`grid h-10 w-10 place-items-center rounded-md transition-colors ${
        active
          ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
          : "text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
      }`}
    >
      {children}
    </button>
  );
}

/** Charcoal-filled pill for toggles that carry a value, per the design system. */
export function ActionChip({
  label,
  value,
  onClick,
  active,
  children,
}: {
  label: string;
  value: string;
  onClick: () => void;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value}`}
      className={`type-viewfinder-label flex h-10 items-center gap-1.5 rounded-md px-2.5 transition-colors ${
        active
          ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
          : "text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container)]"
      }`}
    >
      {children}
      <span>{value}</span>
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
  icon,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="type-button-text flex w-full items-center justify-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-4 text-[var(--color-on-primary)] transition-transform active:scale-[0.98] disabled:opacity-50"
    >
      {icon}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="type-button-text flex w-full items-center justify-center gap-2 rounded-md border border-[var(--color-outline-variant)] px-4 py-4 text-[var(--color-on-surface)] transition-transform active:scale-[0.98]"
    >
      {icon}
      {children}
    </button>
  );
}

/* --- Icons: 1.5px stroke, matching the hairline HUD language --- */

const s = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <path d="M3 8.5A1.5 1.5 0 014.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0121 8.5v9A1.5 1.5 0 0119.5 19h-15A1.5 1.5 0 013 17.5z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

export const StackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <rect x="7" y="4" width="12" height="15" rx="1.5" />
    <path d="M4.5 7v11.5A1.5 1.5 0 006 20h9" />
  </svg>
);

export const FlashIcon = ({ on }: { on: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <path d="M13 3L5 14h6l-1 7 8-11h-6z" fill={on ? "currentColor" : "none"} />
    {!on && <path d="M4 4l16 16" />}
  </svg>
);

export const TimerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 10v3.5l2 2M9.5 2.5h5" />
  </svg>
);

export const FlipIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <path d="M4 9a7 7 0 0111.9-4.9M20 15A7 7 0 018.1 19.9" />
    <path d="M4 4.5V9h4.5M20 19.5V15h-4.5" />
  </svg>
);

export const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...s}>
    <path d="M12 4v11m0 0l-4-4m4 4l4-4M4 19h16" />
  </svg>
);

export const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <path d="M12 15V4m0 0l-4 4m4-4l4 4M4 19h16" />
  </svg>
);

export const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...s}>
    <path d="M4 10a8 8 0 0113.7-4.9L20 7M20 14a8 8 0 01-13.7 4.9L4 17" />
    <path d="M20 3v4h-4M4 21v-4h4" />
  </svg>
);

export const ChevronRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...s} className="opacity-40">
    <path d="M9.5 5L16 12l-6.5 7" />
  </svg>
);

export const KeyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <circle cx="8" cy="12" r="3.5" />
    <path d="M11.5 12H21m-3 0v3m-3-3v2.5" />
  </svg>
);

export const CreditCardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <rect x="3" y="6" width="18" height="12" rx="1.5" />
    <path d="M3 10h18M6.5 14.5h3" />
  </svg>
);

export const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <path d="M12 3l7 3v5.5c0 4-3 7.5-7 8.5-4-1-7-4.5-7-8.5V6z" />
  </svg>
);

export const LogOutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <path d="M14 6.5V5a1.5 1.5 0 00-1.5-1.5h-7A1.5 1.5 0 004 5v14a1.5 1.5 0 001.5 1.5h7A1.5 1.5 0 0014 19v-1.5" />
    <path d="M10 12h11m-3-3l3 3-3 3" />
  </svg>
);

export const SparkIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
    <path d="M18 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" />
  </svg>
);

export const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <circle cx="12" cy="8.5" r="3.75" />
    <path d="M4.5 20a7.5 7.5 0 0115 0" />
  </svg>
);

export const FolderIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <path d="M3 7.5A1.5 1.5 0 014.5 6h4L10 8h9.5A1.5 1.5 0 0121 9.5v8a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5z" />
  </svg>
);

export const EditIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z" />
  </svg>
);

export const TrashIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" />
  </svg>
);

export const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...s}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

export const ChevronLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <path d="M14.5 5L8 12l6.5 7" />
  </svg>
);

export const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...s}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const HourglassIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
    <path d="M7 3h10M7 21h10M8 3v3.5c0 2 4 3.5 4 5.5s-4 3.5-4 5.5V21M16 3v3.5c0 2-4 3.5-4 5.5s4 3.5 4 5.5V21" />
  </svg>
);

export const MicIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21M9 21h6" />
  </svg>
);

export const StopIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </svg>
);

export const PlayIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s} fill="currentColor">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
);

export const PauseIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...s} fill="currentColor">
    <rect x="7" y="5" width="4" height="14" rx="1" />
    <rect x="13" y="5" width="4" height="14" rx="1" />
  </svg>
);

/** Bottom mode switcher. A develop finishes straight into the gallery — no
 *  separate "Develop" tab to hold a single in-progress result. */
export function TabBar({
  screen,
  onSelect,
}: {
  screen: Screen;
  onSelect: (s: Screen) => void;
}) {
  const tabs: Array<{ id: Screen; label: string; icon: React.ReactNode }> = [
    { id: "camera", label: "Camera", icon: <CameraIcon /> },
    { id: "gallery", label: "Gallery", icon: <StackIcon /> },
  ];

  return (
    <nav className="grid grid-cols-2 items-center justify-items-center border-t border-[var(--color-outline-variant)] bg-[var(--color-surface-container-low)] px-6 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-label={t.label}
          aria-current={screen === t.id}
          onClick={() => onSelect(t.id)}
          className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${
            screen === t.id
              ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
              : "text-[var(--color-on-surface-variant)]"
          }`}
        >
          {t.icon}
        </button>
      ))}
    </nav>
  );
}
