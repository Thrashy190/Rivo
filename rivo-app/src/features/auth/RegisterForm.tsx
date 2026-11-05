import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { GitHubIcon, GoogleIcon, EyeIcon, EyeOffIcon } from "../../components/icons";

export function RegisterForm() {
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
        <h1 className="text-xl font-semibold tracking-tight">Create an account</h1>
        <p className="text-sm text-zinc-500 mt-1">Start building infrastructure visually</p>
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
          label="Full name"
          type="text"
          placeholder="Jane Smith"
          autoComplete="name"
        />
        <Input
          label="Work email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
        />
        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          placeholder="••••••••"
          autoComplete="new-password"
          hint="Minimum 8 characters"
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

        <Button type="submit" fullWidth className="mt-2">
          Create account
        </Button>

        <p className="text-xs text-zinc-600 text-center leading-relaxed">
          By continuing you agree to our{" "}
          <a href="#" className="text-zinc-400 hover:text-white transition-colors">Terms</a>
          {" "}and{" "}
          <a href="#" className="text-zinc-400 hover:text-white transition-colors">Privacy Policy</a>
        </p>
      </form>

      <p className="text-center text-sm text-zinc-600 mt-6">
        Have an account?{" "}
        <Link to="/login" className="text-white hover:text-zinc-300 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
