'use client';

import { AuthUser, Workspace } from '@/types';
import { clearSession, getAccessToken, getWorkspaceId, setSession } from '@/lib/api';
import { api } from '@/lib/api';
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
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function bootstrap() {
    if (!getAccessToken()) {
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
    } catch {
      clearSession();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void bootstrap();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
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
        const result = await api<{ user: AuthUser; accessToken: string; refreshToken: string }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setSession({ accessToken: result.accessToken, refreshToken: result.refreshToken });
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
        const result = await api<{ user: AuthUser; accessToken: string; refreshToken: string }>('/auth/register', {
          method: 'POST',
          body: JSON.stringify(input),
        });
        setSession({ accessToken: result.accessToken, refreshToken: result.refreshToken });
        setUser(result.user);
        router.push('/home');
      },
      logout: () => {
        clearSession();
        setUser(null);
        setWorkspaces([]);
        router.push('/login');
      },
    }),
    [loading, router, user, workspaceId, workspaces]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
