import { env } from '../config/env';
import { STATUS_CATEGORIES } from '../config/constants';
import { Comment, Project, Status, Task } from '../models';
import type { TaskDocument } from '../models/Task';
import { AppContext } from '../types';
import { ApiError } from '../utils/ApiError';
import { activityService } from './activity.service';
import { documentImportService, ensureMilestones, resolveDefaults } from './documentImport.service';
import { notificationService } from './notification.service';
import { taskService } from './task.service';

export interface AppTaskInput {
  externalKey?: string;
  title?: string;
  description?: string;
  status?: string;
  section?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  comment?: string;
}

type StatusRecord = { id: string; key: string; name: string; category: string; order: number; isDefault: boolean };

const STATUS_ALIASES: Record<string, string> = {
  TODO: STATUS_CATEGORIES.NOT_STARTED,
  TO_DO: STATUS_CATEGORIES.NOT_STARTED,
  OPEN: STATUS_CATEGORIES.NOT_STARTED,
  BACKLOG: STATUS_CATEGORIES.NOT_STARTED,
  NOT_STARTED: STATUS_CATEGORIES.NOT_STARTED,
  REOPENED: STATUS_CATEGORIES.NOT_STARTED,
  DOING: STATUS_CATEGORIES.IN_PROGRESS,
  STARTED: STATUS_CATEGORIES.IN_PROGRESS,
  WIP: STATUS_CATEGORIES.IN_PROGRESS,
  IN_PROGRESS: STATUS_CATEGORIES.IN_PROGRESS,
  DONE: STATUS_CATEGORIES.COMPLETED,
  COMPLETE: STATUS_CATEGORIES.COMPLETED,
  COMPLETED: STATUS_CATEGORIES.COMPLETED,
  CLOSED: STATUS_CATEGORIES.COMPLETED,
  RESOLVED: STATUS_CATEGORIES.COMPLETED,
  FINISHED: STATUS_CATEGORIES.COMPLETED,
  CANCELLED: STATUS_CATEGORIES.CANCELLED,
  CANCELED: STATUS_CATEGORIES.CANCELLED,
  WONT_DO: STATUS_CATEGORIES.CANCELLED,
};

const MAX_BULK = 500;

function normalizeToken(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '_');
}

async function loadProject(ctx: AppContext) {
  const project = await Project.findOne({ id: ctx.projectId, workspaceId: ctx.workspaceId });
  if (!project) {
    throw ApiError.notFound('PROJECT_NOT_FOUND', 'Project not found');
  }
  const statuses = (await Status.find({ workflowId: project.workflowId, isActive: true }).sort({ order: 1 })).map(
    (status): StatusRecord => ({
      id: status.id as string,
      key: status.key,
      name: status.name,
      category: status.category,
      order: status.order,
      isDefault: status.isDefault,
    })
  );
  return { project, statuses };
}

function resolveStatus(statuses: StatusRecord[], value: string): StatusRecord {
  const token = normalizeToken(value);
  const direct =
    statuses.find((status) => status.key === token) ?? statuses.find((status) => normalizeToken(status.name) === token);
  if (direct) return direct;
  const category = STATUS_ALIASES[token];
  const byCategory = category
    ? category === STATUS_CATEGORIES.NOT_STARTED
      ? statuses.find((status) => status.isDefault) ?? statuses.find((status) => status.category === category)
      : statuses.find((status) => status.category === category)
    : undefined;
  if (!byCategory) {
    throw ApiError.badRequest(
      'INVALID_STATUS',
      `Unknown status "${value}". Use one of: ${statuses.map((status) => status.key).join(', ')} (or todo / in_progress / done)`
    );
  }
  return byCategory;
}

function presentTask(task: TaskDocument, statuses: StatusRecord[]) {
  const status = statuses.find((item) => item.id === task.statusId);
  return {
    id: task.id,
    key: task.key ?? null,
    externalKey: task.externalKey ?? null,
    title: task.title,
    description: task.description ?? '',
    priority: task.priority,
    status: status ? { key: status.key, name: status.name, category: status.category } : null,
    section: task.source?.section ?? null,
    source: task.source?.kind ?? 'MANUAL',
    completedAt: task.completedAt ?? null,
    updatedAt: (task as unknown as { updatedAt: Date }).updatedAt,
    url: `${env.appUrl}/tasks?open=${task.id}`,
  };
}

async function findTask(ctx: AppContext, ref: string) {
  const value = ref.trim();
  const byKey = /^[A-Za-z][A-Za-z0-9]*-\d+$/.test(value)
    ? await Task.findOne({ workspaceId: ctx.workspaceId, projectId: ctx.projectId, key: value.toUpperCase() })
    : null;
  const task =
    byKey ?? (await Task.findOne({ workspaceId: ctx.workspaceId, projectId: ctx.projectId, externalKey: value }));
  if (!task) {
    throw ApiError.notFound('TASK_NOT_FOUND', `No task "${value}" in this project`);
  }
  return task;
}

function activityMeta(ctx: AppContext) {
  return { via: 'app', integrationId: ctx.integrationId, integrationName: ctx.integrationName };
}

async function addComment(ctx: AppContext, task: { id?: string; projectId: string }, content: string) {
  const taskId = task.id as string;
  const comment = await Comment.create({
    workspaceId: ctx.workspaceId,
    projectId: task.projectId,
    taskId,
    userId: ctx.actorUserId,
    content: `[${ctx.integrationName}] ${content}`,
  });
  await activityService.record({
    workspaceId: ctx.workspaceId,
    projectId: task.projectId,
    taskId,
    userId: ctx.actorUserId,
    action: 'COMMENT_CREATED',
    entityType: 'comment',
    entityId: comment.id as string,
    metadata: activityMeta(ctx),
  });
}

async function applyUpdate(
  ctx: AppContext,
  task: InstanceType<typeof Task>,
  input: AppTaskInput,
  statuses: StatusRecord[]
) {
  const changes: string[] = [];
  const set: Record<string, unknown> = {};

  const lastTitle = task.source?.importedTitle ?? task.title;
  if (input.title && input.title !== lastTitle) {
    if (task.title === lastTitle) {
      set.title = input.title;
      changes.push('title');
    }
    if (task.source) set['source.importedTitle'] = input.title;
  }

  const lastDescription = task.source?.importedDescription ?? '';
  if (input.description !== undefined && input.description !== lastDescription) {
    if ((task.description ?? '') === lastDescription) {
      set.description = input.description;
      changes.push('description');
    }
    if (task.source) set['source.importedDescription'] = input.description;
  }

  if (input.priority && input.priority !== task.priority) {
    set.priority = input.priority;
    changes.push('priority');
  }

  let statusChange: { from: string; to: StatusRecord } | null = null;
  if (input.status) {
    const target = resolveStatus(statuses, input.status);
    if (target.id !== task.statusId) {
      statusChange = { from: task.statusId, to: target };
      set.statusId = target.id;
      set.completedAt = target.category === STATUS_CATEGORIES.COMPLETED ? new Date() : null;
      set.order = await Task.countDocuments({ projectId: task.projectId, statusId: target.id });
      changes.push('status');
    }
  }

  if (Object.keys(set).length) {
    if (task.source) set['source.syncedAt'] = new Date();
    await Task.updateOne({ id: task.id }, { $set: set });
  }

  if (statusChange) {
    await activityService.record({
      workspaceId: ctx.workspaceId,
      projectId: task.projectId,
      taskId: task.id,
      userId: ctx.actorUserId,
      action: 'TASK_STATUS_CHANGED',
      entityType: 'task',
      entityId: task.id,
      metadata: { fromStatusId: statusChange.from, toStatusId: statusChange.to.id, ...activityMeta(ctx) },
    });
    if (task.assigneeId) {
      await notificationService.create({
        userId: task.assigneeId,
        workspaceId: ctx.workspaceId,
        type: 'status_changed',
        title: 'Status updated',
        message: `${ctx.integrationName} moved “${task.title}” to ${statusChange.to.name}`,
        entityType: 'task',
        entityId: task.id,
      });
    }
  } else if (changes.length) {
    await activityService.record({
      workspaceId: ctx.workspaceId,
      projectId: task.projectId,
      taskId: task.id,
      userId: ctx.actorUserId,
      action: 'TASK_UPDATED',
      entityType: 'task',
      entityId: task.id,
      metadata: { fields: changes, ...activityMeta(ctx) },
    });
  }

  if (input.comment) {
    await addComment(ctx, task, input.comment);
    changes.push('comment');
  }

  return changes;
}

async function reload(taskId: string, statuses: StatusRecord[]) {
  const task = await Task.findOne({ id: taskId });
  return presentTask(task as unknown as TaskDocument, statuses);
}

async function upsertOne(
  ctx: AppContext,
  input: AppTaskInput,
  loaded: Awaited<ReturnType<typeof loadProject>>,
  defaults: Awaited<ReturnType<typeof resolveDefaults>>
) {
  const externalKey = input.externalKey?.trim();
  if (!externalKey) {
    throw ApiError.badRequest('EXTERNAL_KEY_REQUIRED', 'externalKey is required');
  }
  const { project, statuses } = loaded;
  const existing = await Task.findOne({ workspaceId: ctx.workspaceId, projectId: project.id, externalKey });

  if (existing) {
    const changes = await applyUpdate(ctx, existing, input, statuses);
    return {
      action: changes.length ? ('updated' as const) : ('unchanged' as const),
      changes,
      task: await reload(existing.id as string, statuses),
    };
  }

  if (!input.title) {
    throw ApiError.badRequest('TITLE_REQUIRED', `title is required to create task "${externalKey}"`);
  }
  const status = input.status ? resolveStatus(statuses, input.status) : null;
  const section = input.section?.trim() || '';
  const milestones = section ? await ensureMilestones(ctx.workspaceId, project.id, [section]) : new Map();
  const created = (await taskService.create(ctx.workspaceId, ctx.actorUserId, {
    projectId: project.id,
    title: input.title,
    description: input.description ?? '',
    categoryId: defaults.category.id as string,
    statusId: status?.id ?? (defaults.defaultStatus.id as string),
    priority: input.priority,
    milestoneId: milestones.get(section),
    externalKey,
    source: {
      kind: 'APP',
      name: ctx.integrationName,
      section,
      importedTitle: input.title,
      importedDescription: input.description ?? '',
      integrationId: ctx.integrationId,
    },
    activityMeta: activityMeta(ctx),
  })) as unknown as { id: string; projectId: string };
  if (input.comment) {
    await addComment(ctx, created, input.comment);
  }
  return { action: 'created' as const, changes: [] as string[], task: await reload(created.id, statuses) };
}

export const appSyncService = {
  async me(ctx: AppContext) {
    const { project, statuses } = await loadProject(ctx);
    return {
      integration: { id: ctx.integrationId, name: ctx.integrationName },
      project: { id: project.id, name: project.name, key: project.key, url: `${env.appUrl}/projects/${project.id}/backlog` },
      statuses: statuses.map(({ key, name, category }) => ({ key, name, category })),
    };
  },

  async listTasks(ctx: AppContext, query: { status?: string; updatedSince?: string; source?: string }) {
    const { statuses } = await loadProject(ctx);
    const filter: Record<string, unknown> = { workspaceId: ctx.workspaceId, projectId: ctx.projectId };
    if (query.status) filter.statusId = resolveStatus(statuses, query.status).id;
    if (query.updatedSince) {
      const since = new Date(query.updatedSince);
      if (Number.isNaN(since.getTime())) {
        throw ApiError.badRequest('INVALID_DATE', 'updatedSince must be an ISO date');
      }
      filter.updatedAt = { $gte: since };
    }
    if (query.source === 'mine') filter['source.integrationId'] = ctx.integrationId;
    const tasks = await Task.find(filter).sort({ number: 1 }).limit(1000);
    return tasks.map((task) => presentTask(task as unknown as TaskDocument, statuses));
  },

  async getTask(ctx: AppContext, ref: string) {
    const { statuses } = await loadProject(ctx);
    const task = await findTask(ctx, ref);
    return presentTask(task as unknown as TaskDocument, statuses);
  },

  async upsert(ctx: AppContext, input: AppTaskInput) {
    const loaded = await loadProject(ctx);
    const defaults = await resolveDefaults(ctx.workspaceId, loaded.project.workflowId);
    return upsertOne(ctx, input, loaded, defaults);
  },

  async bulkUpsert(ctx: AppContext, items: AppTaskInput[]) {
    if (items.length > MAX_BULK) {
      throw ApiError.badRequest('TOO_MANY_TASKS', `Send at most ${MAX_BULK} tasks per request`);
    }
    const loaded = await loadProject(ctx);
    const defaults = await resolveDefaults(ctx.workspaceId, loaded.project.workflowId);
    const results: Array<{ externalKey: string | null; action: string; key?: string | null; error?: string }> = [];
    for (const item of items) {
      try {
        const result = await upsertOne(ctx, item, loaded, defaults);
        results.push({ externalKey: item.externalKey ?? null, action: result.action, key: result.task.key });
      } catch (error) {
        results.push({
          externalKey: item.externalKey ?? null,
          action: 'error',
          error: error instanceof Error ? error.message : 'Failed',
        });
      }
    }
    const count = (action: string) => results.filter((result) => result.action === action).length;
    return {
      counts: { created: count('created'), updated: count('updated'), unchanged: count('unchanged'), errors: count('error') },
      results,
    };
  },

  async update(ctx: AppContext, ref: string, input: Omit<AppTaskInput, 'externalKey' | 'section'>) {
    const { statuses } = await loadProject(ctx);
    const task = await findTask(ctx, ref);
    const changes = await applyUpdate(ctx, task, input, statuses);
    return { action: changes.length ? 'updated' : 'unchanged', changes, task: await reload(task.id as string, statuses) };
  },

  async comment(ctx: AppContext, ref: string, content: string) {
    const task = await findTask(ctx, ref);
    await addComment(ctx, task, content);
    return { taskId: task.id, key: task.key ?? null };
  },

  async importDocument(ctx: AppContext, file: { buffer: Buffer; originalname: string }, dryRun: boolean) {
    const target = { projectId: ctx.projectId };
    if (dryRun) {
      const preview = await documentImportService.preview(ctx.workspaceId, file, target);
      return { dryRun: true, counts: preview.counts, changes: preview.changes };
    }
    const result = await documentImportService.apply(ctx.workspaceId, ctx.actorUserId, file, target, activityMeta(ctx));
    return { dryRun: false, counts: result.counts, changes: result.changes };
  },
};
