import { session } from "./session";

// The API's base URL. In development it is /api, which Vite forwards to the API
// in RIVO_API_URL (see vite.config.ts). A hosted build sets VITE_API_URL.
const BASE_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, message: string, code = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  // Public routes (sign-in) send no token and never try to refresh one.
  auth?: boolean;
}

async function parseError(res: Response): Promise<ApiError> {
  let message = `The API answered ${res.status}`;
  let code = "";
  try {
    const data = (await res.json()) as { error?: { code?: string; message?: string }; message?: string };
    if (data.error?.message) {
      message = data.error.message;
      code = data.error.code ?? "";
    } else if (data.message) {
      // API Gateway's own answers, such as the authorizer's 401.
      message = data.message;
    }
  } catch {
    // The body was not JSON: keep the status message.
  }
  return new ApiError(res.status, message, code);
}

let refreshing: Promise<boolean> | null = null;

// Gets a new ID token once, however many requests are waiting for it.
function refreshSession(): Promise<boolean> {
  const token = session.refreshToken();
  if (!token) return Promise.resolve(false);
  refreshing ??= fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: token }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const data = (await res.json()) as { idToken?: string };
      if (!data.idToken) return false;
      session.store({ idToken: data.idToken });
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function send(method: string, path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const token = session.idToken();
  if (options.auth !== false && token) headers["Authorization"] = token;

  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the Rivo API. Check your connection and try again.");
  }
}

export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const authenticated = options.auth !== false;
  if (authenticated && session.isExpiring()) await refreshSession();

  let res = await send(method, path, options);
  if (res.status === 401 && authenticated && (await refreshSession())) {
    res = await send(method, path, options);
  }
  if (res.status === 401 && authenticated) {
    session.clear();
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("PUT", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("PATCH", path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, options),
};

export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
