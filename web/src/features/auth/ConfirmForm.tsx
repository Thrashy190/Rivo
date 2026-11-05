import { useState, useRef, type KeyboardEvent, type ClipboardEvent, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { useSnackbar } from "../../context/SnackbarContext";
import { authService } from "../../services/auth";

const CODE_LENGTH = 6;

function OtpInput({ onComplete }: { onComplete: (code: string) => void }) {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const focus = (i: number) => refs.current[i]?.focus();

  const update = (next: string[]) => {
    setDigits(next);
    const code = next.join("");
    if (code.length === CODE_LENGTH && !next.includes("")) {
      onComplete(code);
    }
  };

  const handleChange = (i: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = digit;
    update(next);
    if (digit && i < CODE_LENGTH - 1) focus(i + 1);
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) {
        next[i] = "";
        update(next);
      } else if (i > 0) {
        next[i - 1] = "";
        update(next);
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      focus(i - 1);
    } else if (e.key === "ArrowRight" && i < CODE_LENGTH - 1) {
      focus(i + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    update(next);
    const lastFilled = Math.min(pasted.length, CODE_LENGTH - 1);
    focus(lastFilled);
  };

  const filled = digits.filter(Boolean).length;

  return (
    <div className="flex gap-3 justify-center">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          className={[
            "w-12 h-14 text-center text-xl font-semibold rounded-lg outline-none transition-all duration-150",
            "bg-zinc-900 border text-white caret-transparent",
            digit
              ? "border-zinc-500 bg-zinc-800"
              : "border-zinc-700",
            "focus:border-white focus:ring-2 focus:ring-white/10",
          ].join(" ")}
        />
      ))}
      {/* hidden progress for submit tracking */}
      <input type="hidden" name="otp-filled" value={filled} />
    </div>
  );
}

export function ConfirmForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { push } = useSnackbar();

  const emailFromParams = searchParams.get("email") ?? "";

  const [email,     setEmail]     = useState(emailFromParams);
  const [code,      setCode]      = useState("");
  const [loading,   setLoading]   = useState(false);
  const [resending, setResending] = useState(false);

  const submit = async (codeToSubmit: string) => {
    if (codeToSubmit.length < CODE_LENGTH) {
      push("Enter all 6 digits of your confirmation code.", "warning");
      return;
    }
    setLoading(true);
    try {
      await authService.confirm(email, codeToSubmit);
      push("Account confirmed! You can now log in.", "success");
      navigate("/login");
    } catch (err) {
      push(err instanceof Error ? err.message : "Confirmation failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(code);
  };

  const handleResend = async () => {
    if (!email) {
      push("Enter your email address first.", "warning");
      return;
    }
    setResending(true);
    try {
      await authService.resend(email);
      push("Confirmation code resent. Check your email.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Could not resend code.", "error");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
          We sent a 6-digit code to{" "}
          {emailFromParams
            ? <span className="text-zinc-300 font-medium">{emailFromParams}</span>
            : "your email address"
          }
        </p>
      </div>

      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        {!emailFromParams && (
          <Input
            label="Email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        )}

        <OtpInput onComplete={(c) => { setCode(c); submit(c); }} />

        <Button type="submit" fullWidth disabled={loading || code.length < CODE_LENGTH}>
          {loading ? "Confirming…" : "Confirm account"}
        </Button>
      </form>

      <p className="text-center text-sm text-zinc-600 mt-6">
        Didn't receive a code?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="text-white hover:text-zinc-300 transition-colors disabled:opacity-50"
        >
          {resending ? "Sending…" : "Resend code"}
        </button>
      </p>

      <p className="text-center text-sm text-zinc-600 mt-3">
        Already confirmed?{" "}
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="text-white hover:text-zinc-300 transition-colors"
        >
          Sign in
        </button>
      </p>
    </div>
  );
}
