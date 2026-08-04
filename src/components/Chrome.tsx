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

export const WandIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <path d="M15 4l1.2 2.8L19 8l-2.8 1.2L15 12l-1.2-2.8L11 8l2.8-1.2z" />
    <path d="M6.5 13.5l4 4M4 20l7-7" />
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

export const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...s}>
    <path d="M4 10a8 8 0 0113.7-4.9L20 7M20 14a8 8 0 01-13.7 4.9L4 17" />
    <path d="M20 3v4h-4M4 21v-4h4" />
  </svg>
);

export const FolderIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
    <path d="M3 7.5A1.5 1.5 0 014.5 6h4L10 8h9.5A1.5 1.5 0 0121 9.5v8a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5z" />
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

/** Bottom mode switcher. 3-column grid per the design system control bar. */
export function TabBar({
  screen,
  onSelect,
  hasResult,
}: {
  screen: Screen;
  onSelect: (s: Screen) => void;
  hasResult: boolean;
}) {
  const tabs: Array<{ id: Screen; label: string; icon: React.ReactNode }> = [
    { id: "camera", label: "Camera", icon: <CameraIcon /> },
    { id: "result", label: "Develop", icon: <WandIcon /> },
    { id: "gallery", label: "Gallery", icon: <StackIcon /> },
  ];

  return (
    <nav className="grid grid-cols-3 items-center justify-items-center border-t border-[var(--color-outline-variant)] bg-[var(--color-surface-container-low)] px-6 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      {tabs.map((t) => {
        const disabled = t.id === "result" && !hasResult;
        return (
          <button
            key={t.id}
            type="button"
            aria-label={t.label}
            aria-current={screen === t.id}
            disabled={disabled}
            onClick={() => onSelect(t.id)}
            className={`grid h-10 w-10 place-items-center rounded-full transition-colors disabled:opacity-25 ${
              screen === t.id
                ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                : "text-[var(--color-on-surface-variant)]"
            }`}
          >
            {t.icon}
          </button>
        );
      })}
    </nav>
  );
}
