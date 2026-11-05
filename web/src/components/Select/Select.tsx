import { useId, type SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Select({
  label,
  error,
  hint,
  className = "",
  id: externalId,
  children,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-medium text-ink-dim tracking-wide uppercase"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          className={[
            "h-10 w-full rounded-md border bg-card px-3 pr-8 text-sm text-ink appearance-none",
            "transition-colors duration-100",
            "focus:outline-none",
            "disabled:opacity-30 disabled:cursor-not-allowed",
            error
              ? "border-red-500/50 focus:border-red-500/80"
              : "border-edge focus:border-raised",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <svg
            viewBox="0 0 12 12"
            className="w-3 h-3 text-ink-dim"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-ink-dim">{hint}</p>}
    </div>
  );
}
