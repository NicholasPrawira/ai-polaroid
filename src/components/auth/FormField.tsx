export function FormField({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="type-viewfinder-label mb-1.5 block text-[var(--color-on-surface-variant)]">
        {label}
      </span>
      <input
        {...props}
        className="type-body-md w-full rounded-md border border-[var(--color-outline-variant)] bg-transparent px-3.5 py-3 text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] focus:border-[var(--color-on-surface)] focus:outline-none"
      />
    </label>
  );
}
