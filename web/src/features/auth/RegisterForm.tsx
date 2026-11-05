import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { GitHubIcon, GoogleIcon, EyeIcon, EyeOffIcon } from "../../components/icons";
import { useAuth } from "../../context/AuthContext";
import { useSnackbar } from "../../context/SnackbarContext";

export function RegisterForm() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { push } = useSnackbar();

  const [name,         setName]         = useState("");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      push("Password must be at least 8 characters.", "warning");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name);
      push("Account created! Check your email for a confirmation code.", "success");
      navigate(`/auth/confirm?email=${encodeURIComponent(email)}`);
    } catch (err) {
      push(err instanceof Error ? err.message : "Registration failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Create an account</h1>
        <p className="text-sm text-ink-dim mt-1">Start building infrastructure visually</p>
      </div>

      {/* OAuth — not wired to Cognito yet */}
      <div className="flex flex-col gap-2.5 mb-6">
        <Button variant="secondary" fullWidth disabled>
          <GitHubIcon className="w-4 h-4" />
          Continue with GitHub
        </Button>
        <Button variant="secondary" fullWidth disabled>
          <GoogleIcon className="w-4 h-4" />
          Continue with Google
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-raised" />
        <span className="text-xs text-ink-dim">or</span>
        <div className="flex-1 h-px bg-raised" />
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          label="Full name"
          type="text"
          placeholder="Jane Smith"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Work email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          autoComplete="new-password"
          hint="Minimum 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-ink-dim hover:text-ink-dim transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          }
        />

        <Button type="submit" fullWidth className="mt-2" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>

        <p className="text-xs text-ink-dim text-center leading-relaxed">
          By continuing you agree to our{" "}
          <a href="#" className="text-ink-dim hover:text-ink transition-colors">Terms</a>
          {" "}and{" "}
          <a href="#" className="text-ink-dim hover:text-ink transition-colors">Privacy Policy</a>
        </p>
      </form>

      <p className="text-center text-sm text-ink-dim mt-6">
        Have an account?{" "}
        <Link to="/login" className="text-ink hover:text-ink transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
