'use client';

import { api } from '@/lib/api';
import type {
  AuthUser,
  Category,
  FilterGroup,
  GithubSyncResult,
  GithubTestResult,
  ImportPreview,
  ImportResult,
  Integration,
  IntegrationActivity,
  IntegrationWithKey,
  NavigationMenus,
  NotificationItem,
  Project,
  ReportSummary,
  SavedView,
  Sprint,
  Task,
  Workflow,
  Workspace,
  WorkspaceMember,
  ProjectRole,
  ProjectMember,
  TimeEntrySummary,
  TimeEntry,
} from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<AuthUser>('/auth/me'),
  });
}

export function useNavigation(projectId?: string | null) {
  return useQuery({
    queryKey: ['navigation', projectId ?? null],
    queryFn: () =>
      api<NavigationMenus>(`/navigation${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`),
  });
}

export interface DocumentImportInput {
  file: File;
  projectId?: string;
  projectName?: string;
  projectKey?: string;
}

function toImportForm(input: DocumentImportInput) {
  const form = new FormData();
  form.append('file', input.file);
  if (input.projectId) form.append('projectId', input.projectId);
  if (input.projectName) form.append('projectName', input.projectName);
  if (input.projectKey) form.append('projectKey', input.projectKey);
  return form;
}

export function usePreviewDocumentImport() {
  return useMutation({
    mutationFn: (input: DocumentImportInput) =>
      api<ImportPreview>('/imports/document/preview', { method: 'POST', body: toImportForm(input) }),
  });
}

export function useApplyDocumentImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DocumentImportInput) =>
      api<ImportResult>('/imports/document/apply', { method: 'POST', body: toImportForm(input) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['navigation'] });
    },
  });
}

export function useIntegrations(projectId?: string) {
  return useQuery({
    queryKey: ['integrations', projectId ?? null],
    queryFn: () =>
      api<Integration[]>(`/integrations${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`),
  });
}

export function useIntegrationActivity(integrationId?: string | null) {
  return useQuery({
    queryKey: ['integration-activity', integrationId],
    queryFn: () => api<IntegrationActivity[]>(`/integrations/${integrationId}/activity`),
    enabled: Boolean(integrationId),
  });
}

function useIntegrationMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useCreateIntegration() {
  return useIntegrationMutation((input: { name: string; projectId: string; description?: string }) =>
    api<IntegrationWithKey>('/integrations', { method: 'POST', body: JSON.stringify(input) })
  );
}

export function useUpdateIntegration() {
  return useIntegrationMutation(
    ({ id, ...input }: { id: string; name?: string; description?: string; status?: 'ACTIVE' | 'REVOKED' }) =>
      api<Integration>(`/integrations/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  );
}

export function useRotateIntegration() {
  return useIntegrationMutation((id: string) =>
    api<IntegrationWithKey>(`/integrations/${id}/rotate`, { method: 'POST' })
  );
}

export function useConfigureGithub() {
  return useIntegrationMutation(
    ({
      id,
      ...input
    }: {
      id: string;
      repo: string;
      branch?: string;
      docsPath?: string;
      token?: string | null;
      autoSync?: boolean;
    }) => api<Integration>(`/integrations/${id}/github`, { method: 'PUT', body: JSON.stringify(input) })
  );
}

export function useDisconnectGithub() {
  return useIntegrationMutation((id: string) => api<Integration>(`/integrations/${id}/github`, { method: 'DELETE' }));
}

export function useGithubWebhookSecret() {
  return useIntegrationMutation((id: string) =>
    api<{ webhookUrl: string; secret: string }>(`/integrations/${id}/github/secret`, { method: 'POST' })
  );
}

export function useTestGithub() {
  return useMutation({
    mutationFn: (id: string) => api<GithubTestResult>(`/integrations/${id}/github/test`, { method: 'POST' }),
  });
}

export function useSyncGithub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, sinceDays }: { id: string; sinceDays?: number }) =>
      api<GithubSyncResult>(`/integrations/${id}/github/sync`, {
        method: 'POST',
        body: JSON.stringify(sinceDays ? { sinceDays } : {}),
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['integrations'] });
      void queryClient.invalidateQueries({ queryKey: ['integration-activity'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteIntegration() {
  return useIntegrationMutation((id: string) => api<{ deleted: boolean }>(`/integrations/${id}`, { method: 'DELETE' }));
}

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api<Workspace[]>('/workspaces'),
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api<Project[]>('/projects'),
  });
}

export function useProject(projectId?: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api<Project>(`/projects/${projectId}`),
    enabled: Boolean(projectId),
  });
}

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: () => api<Workflow[]>('/workflows'),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api<Category[]>('/categories'),
  });
}

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const workspaces = await api<Workspace[]>('/workspaces');
      const current = localStorage.getItem('workspaceId');
      const id = current ?? workspaces[0]?.id;
      if (!id) return [];
      return api<WorkspaceMember[]>(`/workspaces/${id}/members`);
    },
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      roleKey: string;
      firstName?: string;
      lastName?: string;
      password?: string;
    }) => {
      const workspaces = await api<Workspace[]>('/workspaces');
      const current = localStorage.getItem('workspaceId');
      const id = current ?? workspaces[0]?.id;
      if (!id) throw new Error('No workspace selected');
      return api<WorkspaceMember>(`/workspaces/${id}/members`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { memberId: string; roleKey?: string; status?: string }) => {
      const workspaces = await api<Workspace[]>('/workspaces');
      const current = localStorage.getItem('workspaceId');
      const id = current ?? workspaces[0]?.id;
      if (!id) throw new Error('No workspace selected');
      const { memberId, ...body } = input;
      return api<WorkspaceMember>(`/workspaces/${id}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const workspaces = await api<Workspace[]>('/workspaces');
      const current = localStorage.getItem('workspaceId');
      const id = current ?? workspaces[0]?.id;
      if (!id) throw new Error('No workspace selected');
      return api(`/workspaces/${id}/members/${memberId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members'] });
      void queryClient.invalidateQueries({ queryKey: ['project-members'] });
    },
  });
}

export function useSprints(projectId?: string) {
  return useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => api<Sprint[]>(`/projects/${projectId}/sprints`),
    enabled: Boolean(projectId),
  });
}

export function useActiveSprint(projectId?: string) {
  return useQuery({
    queryKey: ['sprints', projectId, 'active'],
    queryFn: () => api<Sprint | null>(`/projects/${projectId}/sprints/active`),
    enabled: Boolean(projectId),
  });
}

export function useTasks(params: {
  projectId?: string;
  assigneeId?: string;
  statusId?: string;
  categoryId?: string;
  priority?: string;
  search?: string;
  grouping?: string;
  sprintId?: string;
  backlog?: boolean;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  filters?: FilterGroup;
  enabled?: boolean;
}) {
  const { enabled = true, ...queryParams } = params;
  const search = new URLSearchParams();
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || key === 'filters') return;
    if (typeof value === 'boolean') {
      if (value) search.set(key, 'true');
      return;
    }
    search.set(key, String(value));
  });
  if (queryParams.filters && queryParams.filters.rules.length) {
    search.set('filters', JSON.stringify(queryParams.filters));
  }
  const query = search.toString();
  return useQuery({
    queryKey: ['tasks', queryParams],
    queryFn: () => api<Task[]>(`/tasks${query ? `?${query}` : ''}`),
    enabled,
  });
}

export function useTask(taskId?: string | null) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api<Task>(`/tasks/${taskId}`),
    enabled: Boolean(taskId),
  });
}

export function useReports(enabled = true) {
  return useQuery({
    queryKey: ['reports'],
    queryFn: () => api<ReportSummary>('/reports/summary'),
    enabled,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<NotificationItem[]>('/notifications'),
  });
}

export function useViews(projectId?: string) {
  return useQuery({
    queryKey: ['views', projectId],
    queryFn: () => api<SavedView[]>(`/views${projectId ? `?projectId=${projectId}` : ''}`),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api<Task>('/tasks', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['sprints'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      const parentTaskId = variables.parentTaskId;
      if (typeof parentTaskId === 'string' && parentTaskId) {
        void queryClient.invalidateQueries({ queryKey: ['task', parentTaskId] });
      }
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: Record<string, unknown> }) =>
      api<Task>(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['task', variables.taskId] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useMoveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      statusId,
      order,
    }: {
      taskId: string;
      statusId: string;
      order?: number;
    }) =>
      api<Task>(`/tasks/${taskId}/move`, {
        method: 'POST',
        body: JSON.stringify({ statusId, order }),
      }),
    onMutate: async ({ taskId, statusId, order }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] });

      queryClient.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (current) => {
        if (!current) return current;

        const moving = current.find((task) => task.id === taskId);
        if (!moving) return current;

        const sourceStatusId = moving.statusId;
        const targetOrder = typeof order === 'number' ? order : 0;

        // Remove from source, insert into destination at target order, then reindex both columns.
        const withoutMoving = current.filter((task) => task.id !== taskId);
        const destination = withoutMoving
          .filter((task) => task.statusId === statusId)
          .sort((a, b) => a.order - b.order);
        const source = withoutMoving
          .filter((task) => task.statusId === sourceStatusId && sourceStatusId !== statusId)
          .sort((a, b) => a.order - b.order);

        const moved: Task = {
          ...moving,
          statusId,
          order: targetOrder,
          status:
            moving.status?.id === statusId
              ? moving.status
              : current.find((task) => task.statusId === statusId)?.status ?? moving.status,
        };

        destination.splice(Math.max(0, Math.min(targetOrder, destination.length)), 0, moved);

        const reindexedDestination = destination.map((task, index) => ({ ...task, order: index }));
        const reindexedSource = source.map((task, index) => ({ ...task, order: index }));
        const touchedIds = new Set([
          ...reindexedDestination.map((task) => task.id),
          ...reindexedSource.map((task) => task.id),
        ]);

        return current.map((task) => {
          if (!touchedIds.has(task.id)) return task;
          return (
            reindexedDestination.find((item) => item.id === task.id) ??
            reindexedSource.find((item) => item.id === task.id) ??
            task
          );
        });
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

function invalidateSprintQueries(queryClient: ReturnType<typeof useQueryClient>, projectId: string) {
  void queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
  void queryClient.invalidateQueries({ queryKey: ['tasks'] });
  void queryClient.invalidateQueries({ queryKey: ['reports'] });
}

export function useCreateSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; goal?: string; startDate?: string; endDate?: string }) =>
      api<Sprint>(`/projects/${projectId}/sprints`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidateSprintQueries(queryClient, projectId),
  });
}

export function useStartSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sprintId: string) =>
      api<Sprint>(`/projects/${projectId}/sprints/${sprintId}/start`, { method: 'POST', body: '{}' }),
    onSuccess: () => invalidateSprintQueries(queryClient, projectId),
  });
}

export function useCompleteSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sprintId,
      moveIncompleteToBacklog = true,
      moveIncompleteToSprintId,
    }: {
      sprintId: string;
      moveIncompleteToBacklog?: boolean;
      moveIncompleteToSprintId?: string;
    }) =>
      api<Sprint>(`/projects/${projectId}/sprints/${sprintId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ moveIncompleteToBacklog, moveIncompleteToSprintId }),
      }),
    onSuccess: () => invalidateSprintQueries(queryClient, projectId),
  });
}

export function useDeleteSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sprintId: string) =>
      api(`/projects/${projectId}/sprints/${sprintId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateSprintQueries(queryClient, projectId),
  });
}

export function useMoveTasksToSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { taskIds: string[]; sprintId: string | null; order?: number }) =>
      api(`/projects/${projectId}/sprints/move-tasks`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueriesData<Task[]>({ queryKey: ['tasks'] });
      queryClient.setQueriesData<Task[]>({ queryKey: ['tasks'] }, (current) => {
        if (!current) return current;

        const movingSet = new Set(input.taskIds);
        const targetKey = input.sprintId ?? null;

        const withoutMoving = current.filter((task) => !movingSet.has(task.id));
        const moving = input.taskIds
          .map((id) => current.find((task) => task.id === id))
          .filter((task): task is Task => Boolean(task))
          .map((task) => ({
            ...task,
            sprintId: input.sprintId ?? undefined,
          }));

        const sameContainer = (task: Task) =>
          targetKey ? task.sprintId === targetKey : !task.sprintId;

        const destination = withoutMoving
          .filter(sameContainer)
          .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));

        const insertAt =
          typeof input.order === 'number'
            ? Math.max(0, Math.min(input.order, destination.length))
            : destination.length;

        const nextDestination = [
          ...destination.slice(0, insertAt),
          ...moving,
          ...destination.slice(insertAt),
        ].map((task, index) => ({ ...task, order: index }));

        const sourceKeys = new Set(
          current
            .filter((task) => movingSet.has(task.id))
            .map((task) => task.sprintId ?? null)
        );

        const reindexedSources: Task[] = [];
        for (const sourceKey of sourceKeys) {
          if (sourceKey === targetKey) continue;
          const sourceTasks = withoutMoving
            .filter((task) => (sourceKey ? task.sprintId === sourceKey : !task.sprintId))
            .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
            .map((task, index) => ({ ...task, order: index }));
          reindexedSources.push(...sourceTasks);
        }

        const touched = new Map<string, Task>();
        for (const task of nextDestination) touched.set(task.id, task);
        for (const task of reindexedSources) touched.set(task.id, task);

        return current.map((task) => touched.get(task.id) ?? task);
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => invalidateSprintQueries(queryClient, projectId),
  });
}

export function useProjectRoles(projectId?: string) {
  return useQuery({
    queryKey: ['project-roles', projectId],
    queryFn: () => api<ProjectRole[]>(`/projects/${projectId}/roles`),
    enabled: Boolean(projectId),
  });
}

export function useProjectMembers(projectId?: string) {
  return useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api<ProjectMember[]>(`/projects/${projectId}/members`),
    enabled: Boolean(projectId),
  });
}

export function useTimeEntries(taskId?: string | null) {
  return useQuery({
    queryKey: ['time-entries', taskId],
    queryFn: () => api<TimeEntrySummary>(`/tasks/${taskId}/time-entries`),
    enabled: Boolean(taskId),
  });
}

export function useCreateTimeEntry(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { minutes: number; workDate?: string; description?: string }) =>
      api<TimeEntry>(`/tasks/${taskId}/time-entries`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['time-entries', taskId] });
    },
  });
}

export function useDeleteTimeEntry(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      api(`/tasks/${taskId}/time-entries/${entryId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['time-entries', taskId] });
    },
  });
}
