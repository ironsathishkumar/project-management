import { AuthUser, Membership } from '@/types';

export function getWorkspaceMembership(user: AuthUser | null | undefined, workspaceId?: string | null) {
  if (!user?.memberships?.length || !workspaceId) return null;
  return user.memberships.find((item) => item.workspaceId === workspaceId) ?? null;
}

export function workspaceRoleKey(user: AuthUser | null | undefined, workspaceId?: string | null) {
  return getWorkspaceMembership(user, workspaceId)?.role?.key ?? null;
}

/** Workspace OWNER or ADMIN — manage projects, users, settings. */
export function isWorkspaceAdmin(user: AuthUser | null | undefined, workspaceId?: string | null) {
  const key = workspaceRoleKey(user, workspaceId);
  return key === 'OWNER' || key === 'ADMIN';
}

/** Regular end-user (MEMBER / VIEWER) — assigned projects + delivery views only. */
export function isWorkspaceUser(user: AuthUser | null | undefined, workspaceId?: string | null) {
  return Boolean(workspaceId && user && !isWorkspaceAdmin(user, workspaceId));
}

export function canManageUsers(membership: Membership | null | undefined) {
  const key = membership?.role?.key;
  return key === 'OWNER' || key === 'ADMIN';
}

export function canManageWorkspace(user: AuthUser | null | undefined, workspaceId?: string | null) {
  return isWorkspaceAdmin(user, workspaceId);
}

export function canManageProjects(user: AuthUser | null | undefined, workspaceId?: string | null) {
  return isWorkspaceAdmin(user, workspaceId);
}

export function hasPermission(
  user: AuthUser | null | undefined,
  workspaceId: string | null | undefined,
  permission: string
) {
  const membership = getWorkspaceMembership(user, workspaceId);
  return Boolean(membership?.role?.permissions?.includes(permission));
}
