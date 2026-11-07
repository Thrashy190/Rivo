import { useState } from "react";
import { Input } from "../../components/Input/Input";
import { EyeIcon, EyeOffIcon } from "../../components/icons";

export function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  error?: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      label={label}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      hint={hint}
      required
      rightElement={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="text-ink-dim hover:text-ink transition-colors"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  );
}
