import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { GitHubIcon, GoogleIcon, EyeIcon, EyeOffIcon } from "../../components/icons";

export function LoginForm() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    navigate("/projects");
  };

  const handleOAuth = () => {
    navigate("/projects");
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-zinc-500 mt-1">Sign in to your account</p>
      </div>

      {/* OAuth */}
      <div className="flex flex-col gap-2.5 mb-6">
        <Button variant="secondary" fullWidth onClick={handleOAuth}>
          <GitHubIcon className="w-4 h-4" />
          Continue with GitHub
        </Button>
        <Button variant="secondary" fullWidth onClick={handleOAuth}>
          <GoogleIcon className="w-4 h-4" />
          Continue with Google
        </Button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-zinc-800" />
        <span className="text-xs text-zinc-600">or</span>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>

      {/* Form */}
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
        />
        <div className="flex flex-col gap-1.5">
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-zinc-600 hover:text-zinc-400 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }
          />
          <div className="flex justify-end">
            <a
              href="#"
              className="text-xs text-zinc-500 hover:text-white transition-colors"
            >
              Forgot password?
            </a>
          </div>
        </div>

        <Button type="submit" fullWidth className="mt-2">
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-zinc-600 mt-6">
        No account?{" "}
        <Link to="/register" className="text-white hover:text-zinc-300 transition-colors">
          Sign up
        </Link>
      </p>
    </div>
  );
}
