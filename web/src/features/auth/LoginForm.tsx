import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { GitHubIcon, GoogleIcon, EyeIcon, EyeOffIcon } from "../../components/icons";
import { useAuth } from "../../context/AuthContext";
import { useSnackbar } from "../../context/SnackbarContext";
import { ApiError } from "../../services/api";

export function LoginForm() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const { push } = useSnackbar();

  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);

  // Navigate only after React has committed the auth state update
  useEffect(() => {
    if (isAuthenticated) navigate("/projects", { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      // navigation happens via the useEffect above once isAuthenticated flips to true
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        push("Your account isn't confirmed yet — check your inbox.", "warning");
        navigate(`/auth/confirm?email=${encodeURIComponent(email)}`);
      } else {
        push(err instanceof Error ? err.message : "Login failed.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-ink-dim mt-1">Sign in to your account</p>
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
          label="Email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div className="flex flex-col gap-1.5">
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
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
          <div className="flex justify-end">
            <a href="#" className="text-xs text-ink-dim hover:text-ink transition-colors">
              Forgot password?
            </a>
          </div>
        </div>

        <Button type="submit" fullWidth className="mt-2" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-ink-dim mt-6">
        No account?{" "}
        <Link to="/register" className="text-ink hover:text-ink transition-colors">
          Sign up
        </Link>
      </p>
    </div>
  );
}
