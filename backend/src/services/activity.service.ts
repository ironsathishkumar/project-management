import { Activity } from '../models';

export const activityService = {
  async record(input: {
    workspaceId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    projectId?: string;
    taskId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return Activity.create(input);
  },

  async list(input: { workspaceId: string; projectId?: string; taskId?: string; limit?: number }) {
    const query: Record<string, unknown> = { workspaceId: input.workspaceId };
    if (input.projectId) query.projectId = input.projectId;
    if (input.taskId) query.taskId = input.taskId;
    return Activity.find(query).sort({ createdAt: -1 }).limit(input.limit ?? 50);
  },
};
