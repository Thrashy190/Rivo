import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { ApiError } from "../services/api";
import { authService, type LoginResult } from "../services/auth";
import { session } from "../services/session";
import { usersService, type Profile } from "../services/users";
import { workspacesCache } from "../services/workspaces";

interface AuthContextValue {
  isAuthenticated: boolean;
  email: string;
  // Who the API says you are. Null while it loads, or if it failed.
  profile: Profile | null;
  profileError: string | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  completeNewPassword: (email: string, challengeSession: string, newPassword: string) => Promise<LoginResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const refreshToken = useSyncExternalStore(session.subscribe, session.refreshToken);
  const idToken = useSyncExternalStore(session.subscribe, session.idToken);
  const isAuthenticated = !!refreshToken || !!idToken;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    usersService
      .me()
      .then((me) => {
        if (!active) return;
        setProfile(me);
        setProfileError(null);
      })
      .catch((err: unknown) => {
        // Only an answer about the account itself blocks the app. A network
        // failure shows up on each page instead.
        if (active && err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          setProfileError(err.message);
        }
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const accept = (result: LoginResult) => {
    if (result.kind === "signed-in") session.store(result);
    return result;
  };

  const login = async (email: string, password: string) => accept(await authService.login(email, password));

  const completeNewPassword = async (email: string, challengeSession: string, newPassword: string) =>
    accept(await authService.newPassword(email, challengeSession, newPassword));

  const logout = () => {
    session.clear();
    workspacesCache.invalidate();
    setProfile(null);
    setProfileError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        email: session.claims()?.email ?? profile?.email ?? "",
        profile: isAuthenticated ? profile : null,
        profileError: isAuthenticated ? profileError : null,
        login,
        completeNewPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
