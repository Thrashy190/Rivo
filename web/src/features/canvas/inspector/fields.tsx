import type { ConfigField } from "../service-config-schemas";
import { inputClass } from "./styles";

function Label({ field, htmlFor }: { field: ConfigField; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="text-[11px] font-medium text-ink-dim">
      {field.label}
      {field.required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function Hint({ text }: { text?: string }) {
  return text ? <p className="text-[11px] leading-snug text-ink-dim/80">{text}</p> : null;
}

interface FieldProps {
  id: string;
  field: ConfigField;
  value: unknown;
  disabled?: boolean;
  onChange: (value: unknown) => void;
}

export function ConfigFieldInput({ id, field, value, disabled = false, onChange }: FieldProps) {
  switch (field.type) {
    case "boolean":
      return (
        <div className="flex items-start justify-between gap-3 py-0.5">
          <div className="min-w-0">
            <Label field={field} htmlFor={id} />
            <Hint text={field.hint} />
          </div>
          <button
            id={id}
            type="button"
            role="switch"
            aria-checked={Boolean(value)}
            disabled={disabled}
            onClick={() => onChange(!value)}
            className={[
              "relative w-8 h-[18px] rounded-full shrink-0 transition-colors disabled:opacity-50",
              value ? "bg-indigo-500" : "bg-raised",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-[3px] w-3 h-3 rounded-full bg-page shadow transition-transform",
                value ? "translate-x-[17px]" : "translate-x-[3px]",
              ].join(" ")}
            />
          </button>
        </div>
      );

    case "select":
      return (
        <div className="flex flex-col gap-1">
          <Label field={field} htmlFor={id} />
          <div className="relative">
            <select
              id={id}
              value={String(value ?? field.options?.[0] ?? "")}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
              className={`${inputClass} w-full appearance-none pr-7`}
            >
              {/* Keep a value from an older diagram visible even if it is no longer offered. */}
              {value !== undefined && !field.options?.includes(String(value)) && <option value={String(value)}>{String(value)}</option>}
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <svg viewBox="0 0 10 10" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-ink-dim" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 3.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <Hint text={field.hint} />
        </div>
      );

    case "number":
      return (
        <div className="flex flex-col gap-1">
          <Label field={field} htmlFor={id} />
          <input
            id={id}
            type="number"
            value={value === undefined || value === null ? "" : String(value)}
            min={field.min}
            max={field.max}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
            className={`${inputClass} w-full tabular-nums`}
          />
          <Hint text={field.hint} />
        </div>
      );

    case "textarea":
      return (
        <div className="flex flex-col gap-1">
          <Label field={field} htmlFor={id} />
          <textarea
            id={id}
            value={String(value ?? "")}
            placeholder={field.placeholder}
            disabled={disabled}
            rows={4}
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClass} w-full h-auto py-2 font-mono leading-relaxed resize-y`}
          />
          <Hint text={field.hint} />
        </div>
      );

    case "color": {
      const text = String(value ?? "");
      return (
        <div className="flex flex-col gap-1">
          <Label field={field} htmlFor={id} />
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={field.label}
              value={/^#[0-9a-fA-F]{6}$/.test(text) ? text : "#888888"}
              disabled={disabled}
              onChange={(e) => onChange(e.target.value)}
              className="w-8 h-8 rounded-lg border border-edge bg-page cursor-pointer p-0.5"
            />
            <input id={id} type="text" value={text} placeholder="#8C4FFF" disabled={disabled} onChange={(e) => onChange(e.target.value)} className={`${inputClass} flex-1 font-mono`} />
          </div>
        </div>
      );
    }

    default:
      return (
        <div className="flex flex-col gap-1">
          <Label field={field} htmlFor={id} />
          <input
            id={id}
            type="text"
            value={String(value ?? "")}
            placeholder={field.placeholder}
            disabled={disabled}
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClass} w-full`}
          />
          <Hint text={field.hint} />
        </div>
      );
  }
}
