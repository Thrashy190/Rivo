import { api } from "./api";

interface LoginOutput {
  idToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  challenge?: string;
  session?: string;
}

export type LoginResult =
  | { kind: "signed-in"; idToken: string; refreshToken?: string }
  // First sign-in with the temporary password from the invitation email.
  | { kind: "new-password"; session: string };

function toResult(out: LoginOutput): LoginResult {
  if (out.idToken) return { kind: "signed-in", idToken: out.idToken, refreshToken: out.refreshToken };
  if (out.challenge === "NEW_PASSWORD_REQUIRED" && out.session) return { kind: "new-password", session: out.session };
  throw new Error(`Sign-in needs a step Rivo does not support yet (${out.challenge ?? "unknown"}).`);
}

export const authService = {
  login: async (email: string, password: string) =>
    toResult(await api.post<LoginOutput>("/auth/login", { email, password }, { auth: false })),

  // Emails a code. The answer is the same whether or not the address has an account.
  forgotPassword: (email: string) =>
    api.post<{ message: string }>("/auth/forgot-password", { email }, { auth: false }),

  resetPassword: (email: string, code: string, newPassword: string) =>
    api.post<{ message: string }>("/auth/reset-password", { email, code, newPassword }, { auth: false }),

  newPassword: async (email: string, session: string, newPassword: string) =>
    toResult(await api.post<LoginOutput>("/auth/new-password", { email, session, newPassword }, { auth: false })),
};
