import Link from "next/link";

/** Shared frame for every auth page: logo mark, title, and a centred card. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="paper grain flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="grain-layer" />
      <div className="relative z-2 w-full max-w-sm">
        <Link
          href="/"
          className="type-viewfinder-label mb-8 block text-center text-[var(--color-on-surface-variant)] opacity-70 hover:opacity-100"
        >
          AI Disposable Camera
        </Link>

        <h1 className="type-headline-lg text-center">{title}</h1>
        {subtitle && (
          <p className="type-body-md mt-2 text-center text-[var(--color-on-surface-variant)]">
            {subtitle}
          </p>
        )}

        <div className="mt-8">{children}</div>

        {footer && (
          <p className="type-body-md mt-6 text-center text-[var(--color-on-surface-variant)]">
            {footer}
          </p>
        )}
      </div>
    </main>
  );
}
