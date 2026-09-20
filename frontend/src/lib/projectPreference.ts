export function lastProjectStorageKey(workspaceId: string) {
  return `lastProjectId:${workspaceId}`;
}

export function getLastProjectId(workspaceId?: string | null) {
  if (!workspaceId || typeof window === 'undefined') return null;
  return localStorage.getItem(lastProjectStorageKey(workspaceId));
}

export function setLastProjectId(workspaceId: string, projectId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(lastProjectStorageKey(workspaceId), projectId);
}

export function clearLastProjectId(workspaceId: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(lastProjectStorageKey(workspaceId));
}
