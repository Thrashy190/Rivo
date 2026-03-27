import { useId, type InputHTMLAttributes, type ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  rightElement?: ReactNode;
}

export function Input({
  label,
  error,
  hint,
  rightElement,
  className = "",
  id: externalId,
  ...props
}: InputProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-ink-dim tracking-wide uppercase">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          className={[
            "h-10 w-full rounded-md border bg-card px-3 text-sm text-ink",
            "placeholder:text-ink-dim",
            "transition-colors duration-100",
            "focus:outline-none",
            "disabled:opacity-30 disabled:cursor-not-allowed",
            error
              ? "border-red-500/50 focus:border-red-500/80"
              : "border-edge focus:border-raised",
            rightElement ? "pr-10" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {rightElement}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-ink-dim">{hint}</p>}
    </div>
  );
}
