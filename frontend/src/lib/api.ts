export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/** Fired when the session can no longer be refreshed (expired, signed out elsewhere, or revoked). */
export const SESSION_EXPIRED_EVENT = 'pt:session-expired';

/** Non-secret marker so a page load knows whether trying the refresh cookie is worthwhile. */
const SESSION_HINT_KEY = 'hasSession';
const LEGACY_TOKEN_KEYS = ['accessToken', 'refreshToken'];
/** Refresh slightly before expiry so a request never leaves with a token that dies in flight. */
const EXPIRY_SKEW_MS = 60 * 1000;
const PUBLIC_AUTH_PATHS = new Set(['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']);

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export interface SessionTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
}

// The access token is kept in memory only; the refresh token lives in an httpOnly cookie scripts cannot read.
let accessToken: string | null = null;
let accessTokenExpiresAt = 0;
let refreshInFlight: Promise<boolean> | null = null;

export function getWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('workspaceId');
}

export function hasSessionHint(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SESSION_HINT_KEY) === '1';
}

export function setSession(tokens: SessionTokens) {
  accessToken = tokens.accessToken;
  accessTokenExpiresAt = new Date(tokens.accessTokenExpiresAt).getTime();
  localStorage.setItem(SESSION_HINT_KEY, '1');
  for (const key of LEGACY_TOKEN_KEYS) localStorage.removeItem(key);
}

export function clearSession() {
  accessToken = null;
  accessTokenExpiresAt = 0;
  localStorage.removeItem(SESSION_HINT_KEY);
  localStorage.removeItem('workspaceId');
  for (const key of LEGACY_TOKEN_KEYS) localStorage.removeItem(key);
}

function expireSession() {
  clearSession();
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Serializes refreshes across tabs, which share the refresh cookie, so two tabs never rotate the same token at once. */
async function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('pt-session-refresh', task) as Promise<T>;
  }
  return task();
}

async function requestNewAccessToken(): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
    } catch {
      return false;
    }
    const json = await response.json().catch(() => null);
    if (response.ok && json?.data?.accessToken) {
      setSession(json.data as SessionTokens);
      return true;
    }
    if (json?.error?.code === 'REFRESH_TOKEN_ROTATED' && attempt === 0) {
      await sleep(400);
      continue;
    }
    if (response.status === 401) expireSession();
    return false;
  }
  return false;
}

/** Gets a new access token from the refresh cookie. Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= withRefreshLock(requestNewAccessToken).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function accessTokenIsFresh() {
  return Boolean(accessToken) && accessTokenExpiresAt - Date.now() > EXPIRY_SKEW_MS;
}

export async function api<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const needsAuth = !PUBLIC_AUTH_PATHS.has(path);
  if (needsAuth && !accessTokenIsFresh() && hasSessionHint()) {
    await refreshSession();
  }

  const workspaceId = getWorkspaceId();
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = new Headers(options.headers);
  if (!isForm && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (needsAuth && accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (workspaceId) headers.set('x-workspace-id', workspaceId);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' });
  const json = await response.json().catch(() => null);

  if (response.status === 401 && needsAuth && !isRetry && hasSessionHint()) {
    if (await refreshSession()) {
      return api<T>(path, options, true);
    }
  }

  if (!response.ok) {
    throw new ApiClientError(
      json?.error?.code ?? 'REQUEST_FAILED',
      json?.error?.message ?? 'Request failed',
      response.status
    );
  }

  return json.data as T;
}
