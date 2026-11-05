import { createContext, useContext, useState, type ReactNode } from "react";
import { authService } from "../services/auth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface User {
  sub:    string;
  email:  string;
  name?:  string;
}

interface AuthContextValue {
  user:            User | null;
  isAuthenticated: boolean;
  token:           string | null;
  login:           (email: string, password: string) => Promise<void>;
  register:        (email: string, password: string, name: string) => Promise<void>;
  logout:          () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function userFromToken(idToken: string): User {
  const claims = decodeJwt(idToken);
  return {
    sub:   (claims["sub"]   as string) ?? "",
    email: (claims["email"] as string) ?? "",
    name:  (claims["name"]  as string) ?? undefined,
  };
}

function loadStoredUser(): { user: User | null; token: string | null } {
  const token   = localStorage.getItem("rivo_token");
  const idToken = localStorage.getItem("rivo_id_token");
  if (!token || !idToken) return { user: null, token: null };
  return { user: userFromToken(idToken), token };
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = loadStoredUser();
  const [user,  setUser]  = useState<User | null>(stored.user);
  const [token, setToken] = useState<string | null>(stored.token);

  const login = async (email: string, password: string) => {
    const tokens = await authService.login(email, password);
    localStorage.setItem("rivo_token",    tokens.accessToken);
    localStorage.setItem("rivo_id_token", tokens.idToken);
    setToken(tokens.accessToken);
    setUser(userFromToken(tokens.idToken));
  };

  const register = async (email: string, password: string, name: string) => {
    await authService.register(email, password, name);
    // Cognito requires email confirmation before login — caller redirects to /auth/confirm
  };

  const logout = () => {
    localStorage.removeItem("rivo_token");
    localStorage.removeItem("rivo_id_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!token, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
