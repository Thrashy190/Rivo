import { useState, useEffect, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { EyeIcon, EyeOffIcon } from "../../components/icons";
import { useAuth } from "../../context/AuthContext";
import { errorMessage } from "../../services/api";

// Cognito's password policy (infra/api/modules/cognito).
function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[a-z]/.test(password)) return "Add a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Add an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Add a number.";
  return null;
}

function PasswordInput({
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

export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const { login, completeNewPassword, isAuthenticated } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, navigate, from]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (result.kind === "new-password") setChallenge(result.session);
    } catch (err) {
      setError(errorMessage(err, "Sign-in failed."));
    } finally {
      setLoading(false);
    }
  };

  const problem = newPassword ? passwordProblem(newPassword) : null;
  const mismatch = confirmPassword !== "" && confirmPassword !== newPassword;

  const handleNewPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!challenge || problem || mismatch) return;
    setError(null);
    setLoading(true);
    try {
      const result = await completeNewPassword(email.trim(), challenge, newPassword);
      if (result.kind === "new-password") setChallenge(result.session);
    } catch (err) {
      setError(errorMessage(err, "Could not set the password."));
    } finally {
      setLoading(false);
    }
  };

  if (challenge) {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-xl font-semibold tracking-tight">Choose a password</h1>
          <p className="text-sm text-ink-dim mt-1">
            You signed in with a temporary password. Choose your own to finish setting up {email}.
          </p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleNewPassword}>
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

          <Button type="submit" fullWidth className="mt-2" disabled={loading || !!problem || mismatch || !confirmPassword}>
            {loading ? "Saving…" : "Set password and sign in"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            fullWidth
            onClick={() => {
              setChallenge(null);
              setPassword("");
              setError(null);
            }}
          >
            Back
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-ink-dim mt-1">Sign in to your account</p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSignIn}>
        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <PasswordInput label="Password" value={password} onChange={setPassword} autoComplete="current-password" />

        {error && <p role="alert" className="text-xs text-red-500">{error}</p>}

        <Button type="submit" fullWidth className="mt-2" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-xs text-ink-dim mt-6 leading-relaxed">
        Rivo accounts are by invitation. Ask your workspace owner or administrator for one.
      </p>
    </div>
  );
}
