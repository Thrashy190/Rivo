import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/auth";
import { errorMessage } from "../../services/api";
import { PasswordInput } from "./PasswordInput";
import { passwordProblem } from "./passwordPolicy";

export function ForgotPasswordForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState(() => (location.state as { email?: string } | null)?.email ?? "");
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  const requestCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { message } = await authService.forgotPassword(email.trim());
      setSentMessage(message);
    } catch (err) {
      setError(errorMessage(err, "Could not send the code."));
    } finally {
      setLoading(false);
    }
  };

  const problem = newPassword ? passwordProblem(newPassword) : null;
  const mismatch = confirmPassword !== "" && confirmPassword !== newPassword;

  const reset = async (e: FormEvent) => {
    e.preventDefault();
    if (problem || mismatch) return;
    setError(null);
    setLoading(true);
    try {
      await authService.resetPassword(email.trim(), code.trim(), newPassword);
      // Sign straight in with the new password; the effect above leaves the page.
      await login(email.trim(), newPassword);
    } catch (err) {
      setError(errorMessage(err, "Could not change the password."));
      setLoading(false);
    }
  };

  if (!sentMessage) {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
          <p className="text-sm text-ink-dim mt-1">We'll email you a code to choose a new one.</p>
        </div>
        <form className="flex flex-col gap-4" onSubmit={requestCode}>
          <Input
            label="Email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
          />
          {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
          <Button type="submit" fullWidth className="mt-2" disabled={loading || !email.trim()}>
            {loading ? "Sending…" : "Send code"}
          </Button>
        </form>
        <p className="text-center text-sm text-ink-dim mt-6">
          <Link to="/login" className="hover:text-ink transition-colors">Back to sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-sm text-ink-dim mt-1 leading-relaxed">{sentMessage}</p>
      </div>
      <form className="flex flex-col gap-4" onSubmit={reset}>
        <Input
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          required
        />
        <PasswordInput
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          error={problem ?? undefined}
          hint="At least 8 characters, with uppercase, lowercase and a number."
        />
        <PasswordInput
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          error={mismatch ? "The passwords don't match." : undefined}
        />
        {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
        <Button
          type="submit"
          fullWidth
          className="mt-2"
          disabled={loading || !code.trim() || !!problem || mismatch || !confirmPassword}
        >
          {loading ? "Saving…" : "Change password and sign in"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          fullWidth
          onClick={() => {
            setSentMessage(null);
            setCode("");
            setError(null);
          }}
        >
          Send a new code
        </Button>
      </form>
    </div>
  );
}
