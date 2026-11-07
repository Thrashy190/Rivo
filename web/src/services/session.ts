// Keeps the Cognito tokens for this browser. The ID token goes in the
// Authorization header and lasts an hour; the refresh token gets a new one
// without asking for the password again.
const ID_TOKEN_KEY = "rivo_id_token";
const REFRESH_TOKEN_KEY = "rivo_refresh_token";

export interface Claims {
  sub: string;
  email: string;
  exp: number;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage is blocked: the session lasts until the page reloads.
  }
}

let idToken = read(ID_TOKEN_KEY);
let refreshToken = read(REFRESH_TOKEN_KEY);
const listeners = new Set<() => void>();

export function decodeClaims(token: string | null): Claims | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      Array.from(atob(payload), (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""),
    );
    const claims = JSON.parse(json) as Partial<Claims>;
    return { sub: claims.sub ?? "", email: claims.email ?? "", exp: claims.exp ?? 0 };
  } catch {
    return null;
  }
}

export const session = {
  idToken: () => idToken,
  refreshToken: () => refreshToken,
  claims: () => decodeClaims(idToken),

  // True when the ID token is missing or expires within a minute.
  isExpiring(): boolean {
    const claims = decodeClaims(idToken);
    return !claims || claims.exp * 1000 - Date.now() < 60_000;
  },

  store(tokens: { idToken: string; refreshToken?: string }) {
    idToken = tokens.idToken;
    write(ID_TOKEN_KEY, idToken);
    if (tokens.refreshToken) {
      refreshToken = tokens.refreshToken;
      write(REFRESH_TOKEN_KEY, refreshToken);
    }
    listeners.forEach((l) => l());
  },

  clear() {
    idToken = null;
    refreshToken = null;
    write(ID_TOKEN_KEY, null);
    write(REFRESH_TOKEN_KEY, null);
    listeners.forEach((l) => l());
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
