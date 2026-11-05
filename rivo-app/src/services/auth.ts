import { delay } from "./mockStore";

export interface AuthTokens {
  accessToken: string;
  idToken:     string;
  refreshToken: string;
  expiresIn:   number;
}

function toBase64Url(value: unknown): string {
  const json = JSON.stringify(value);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Builds a decodable (but unsigned) JWT-shaped ID token so AuthContext's
// client-side `decodeJwt` keeps working against dummy logins.
function makeIdToken(email: string): string {
  const header  = toBase64Url({ alg: "none", typ: "JWT" });
  const payload = toBase64Url({
    sub:   `mock-${email}`,
    email,
    name:  email.split("@")[0],
  });
  return `${header}.${payload}.mock-signature`;
}

export const authService = {
  login: (email: string, password: string) =>
    delay<AuthTokens>({
      accessToken:  `mock-access-${email}-${password.length}`,
      idToken:      makeIdToken(email),
      refreshToken: `mock-refresh-${email}`,
      expiresIn:    3600,
    }),

  register: (email: string, password: string, name: string) =>
    delay({ message: `Account created for ${name} (${password.length}-char password).`, email }),

  confirm: (email: string, code: string) =>
    delay({ message: `Account ${email} confirmed with code ${code}.` }),

  resend: (email: string) =>
    delay({ message: `Confirmation code resent to ${email}.` }),
};
