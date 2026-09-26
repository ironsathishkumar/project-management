'use client';

import { AuthUser, Workspace } from '@/types';
import {
  ApiClientError,
  SESSION_EXPIRED_EVENT,
  SessionTokens,
  api,
  clearSession,
  getWorkspaceId,
  hasSessionHint,
  setSession,
} from '@/lib/api';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextValue {
  user: AuthUser | null;
  workspaces: Workspace[];
  workspace: Workspace | null;
  loading: boolean;
  setWorkspaceId: (id: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { firstName: string; lastName: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  logoutEverywhere: () => Promise<void>;
}

type SessionResponse = SessionTokens & { user: AuthUser };

export const SESSION_ENDED_FLAG = 'pt:sessionEnded';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function resetState() {
    setUser(null);
    setWorkspaces([]);
    setWorkspaceIdState(null);
  }

  async function bootstrap() {
    if (!hasSessionHint()) {
      clearSession();
      setLoading(false);
      return;
    }
    try {
      const [me, list] = await Promise.all([api<AuthUser>('/auth/me'), api<Workspace[]>('/workspaces')]);
      setUser(me);
      setWorkspaces(list);
      const stored = getWorkspaceId() ?? list[0]?.id ?? null;
      if (stored) {
        localStorage.setItem('workspaceId', stored);
        setWorkspaceIdState(stored);
      }
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) clearSession();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void bootstrap();

    const onExpired = () => {
      sessionStorage.setItem(SESSION_ENDED_FLAG, '1');
      resetState();
      router.replace('/login');
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'hasSession' && event.newValue === null) onExpired();
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
      window.removeEventListener('storage', onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    async function signOut(path: '/auth/logout' | '/auth/logout-all') {
      try {
        await api(path, { method: 'POST' });
      } catch {
        // Local sign-out still happens if the server is unreachable.
      }
      clearSession();
      resetState();
      router.push('/login');
    }

    return {
      user,
      workspaces,
      workspace: workspaces.find((item) => item.id === workspaceId) ?? null,
      loading,
      setWorkspaceId: (id: string) => {
        localStorage.setItem('workspaceId', id);
        setWorkspaceIdState(id);
        window.location.reload();
      },
      login: async (email, password) => {
        const result = await api<SessionResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setSession(result);
        const list = await api<Workspace[]>('/workspaces');
        if (list[0]) {
          localStorage.setItem('workspaceId', list[0].id);
        }
        setUser(result.user);
        setWorkspaces(list);
        setWorkspaceIdState(list[0]?.id ?? null);
        router.push('/home');
      },
      register: async (input) => {
        const result = await api<SessionResponse>('/auth/register', {
          method: 'POST',
          body: JSON.stringify(input),
        });
        setSession(result);
        setUser(result.user);
        router.push('/home');
      },
      logout: () => signOut('/auth/logout'),
      logoutEverywhere: () => signOut('/auth/logout-all'),
    };
  }, [loading, router, user, workspaceId, workspaces]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
