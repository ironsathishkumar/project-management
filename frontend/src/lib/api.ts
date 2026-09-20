const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export function getWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('workspaceId');
}

export function setSession(input: { accessToken: string; refreshToken: string; workspaceId?: string }) {
  localStorage.setItem('accessToken', input.accessToken);
  localStorage.setItem('refreshToken', input.refreshToken);
  if (input.workspaceId) {
    localStorage.setItem('workspaceId', input.workspaceId);
  }
}

export function clearSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('workspaceId');
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const workspaceId = getWorkspaceId();
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = new Headers(options.headers);
  if (!isForm && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (workspaceId) headers.set('x-workspace-id', workspaceId);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const json = await response.json().catch(() => null);

  if (response.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return api<T>(path, options);
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

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const json = await response.json();
    if (!response.ok) {
      clearSession();
      return false;
    }
    localStorage.setItem('accessToken', json.data.accessToken);
    localStorage.setItem('refreshToken', json.data.refreshToken);
    return true;
  } catch {
    clearSession();
    return false;
  }
}
