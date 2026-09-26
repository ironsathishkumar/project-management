import { FilterQuery } from 'mongoose';
import { STATUS_CATEGORIES } from '../config/constants';
import {
  Category,
  Comment,
  Milestone,
  Project,
  Status,
  Tag,
  Task,
  TaskDependency,
  TaskTag,
  User,
  WorkflowTransition,
} from '../models';
import { ApiError } from '../utils/ApiError';
import { activityService } from './activity.service';
import { compileFilters, FilterGroup } from './filter.service';
import { emailService } from './email.service';
import { notificationService } from './notification.service';

const PRIORITY_WEIGHT: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

interface ListTasksInput {
  workspaceId: string;
  userId?: string;
  roleKey?: string;
  assignedProjectIds?: string[];
  projectId?: string;
  assigneeId?: string;
  statusId?: string;
  categoryId?: string;
  priority?: string;
  search?: string;
  sprintId?: string;
  backlog?: boolean;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  filters?: FilterGroup;
}

async function hydrateTasks(
  tasks: Array<{ id?: string; toJSON: () => Record<string, unknown> }>,
  options: { includeSubtaskList?: boolean } = { includeSubtaskList: true }
) {
  const taskIds = tasks.map((task) => task.id).filter((id): id is string => Boolean(id));
  const jsonTasks = tasks.map((task) => task.toJSON());
  const statusIds = [...new Set(jsonTasks.map((task) => task.statusId as string))];
  const categoryIds = [...new Set(jsonTasks.map((task) => task.categoryId as string))];
  const userIds = [
    ...new Set(
      jsonTasks.flatMap((task) => [task.assigneeId as string, task.creatorId as string].filter(Boolean))
    ),
  ];
  const [statuses, categories, users, taskTags, tags, comments, subtaskStats] = await Promise.all([
    Status.find({ id: { $in: statusIds } }),
    Category.find({ id: { $in: categoryIds } }),
    User.find({ id: { $in: userIds } }),
    TaskTag.find({ taskId: { $in: taskIds } }),
    Tag.find({}),
    Comment.aggregate([{ $match: { taskId: { $in: taskIds }, deletedAt: null } }, { $group: { _id: '$taskId', count: { $sum: 1 } } }]),
    Task.aggregate([
      { $match: { parentTaskId: { $in: taskIds } } },
      {
        $lookup: {
          from: 'statuses',
          localField: 'statusId',
          foreignField: 'id',
          as: 'statusDoc',
        },
      },
      {
        $group: {
          _id: '$parentTaskId',
          total: { $sum: 1 },
          done: {
            $sum: {
              $cond: [{ $eq: [{ $arrayElemAt: ['$statusDoc.category', 0] }, 'COMPLETED'] }, 1, 0],
            },
          },
        },
      },
    ]),
  ]);

  const statusMap = new Map(statuses.map((item) => [item.id, item]));
  const categoryMap = new Map(categories.map((item) => [item.id, item]));
  const userMap = new Map(users.map((item) => [item.id, item.toJSON()]));
  const tagMap = new Map(tags.map((item) => [item.id, item]));
  const commentMap = new Map(comments.map((item) => [item._id as string, item.count]));
  const subtaskMap = new Map(
    subtaskStats.map((item) => [item._id as string, { total: item.total as number, done: item.done as number }])
  );
  const tagsByTask = new Map<string, unknown[]>();
  for (const link of taskTags) {
    const list = tagsByTask.get(link.taskId) ?? [];
    const tag = tagMap.get(link.tagId);
    if (tag) list.push(tag);
    tagsByTask.set(link.taskId, list);
  }

  const subtasksByParent = new Map<string, Record<string, unknown>[]>();
  if (options.includeSubtaskList !== false && taskIds.length > 0) {
    const children = await Task.find({ parentTaskId: { $in: taskIds } }).sort({ order: 1, createdAt: 1 });
    if (children.length > 0) {
      const hydratedChildren = await hydrateTasks(children, { includeSubtaskList: false });
      for (const child of hydratedChildren) {
        const parentId = (child as { parentTaskId?: string }).parentTaskId;
        if (!parentId) continue;
        const list = subtasksByParent.get(parentId) ?? [];
        list.push(child as Record<string, unknown>);
        subtasksByParent.set(parentId, list);
      }
    }
  }

  return jsonTasks.map((task) => {
    const stats = subtaskMap.get(task.id as string);
    return {
      ...task,
      status: statusMap.get(task.statusId as string) ?? null,
      category: categoryMap.get(task.categoryId as string) ?? null,
      assignee: task.assigneeId ? userMap.get(task.assigneeId as string) ?? null : null,
      creator: userMap.get(task.creatorId as string) ?? null,
      tags: tagsByTask.get(task.id as string) ?? [],
      commentCount: commentMap.get(task.id as string) ?? 0,
      subtaskCount: stats?.total ?? 0,
      subtaskDoneCount: stats?.done ?? 0,
      subtasks: subtasksByParent.get(task.id as string) ?? [],
    };
  });
}

function sortTasks(tasks: Array<Record<string, unknown>>, field?: string, direction: 'asc' | 'desc' = 'desc') {
  const dir = direction === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => {
    let left: unknown = a[field ?? 'updatedAt'];
    let right: unknown = b[field ?? 'updatedAt'];
    if (field === 'priority') {
      left = PRIORITY_WEIGHT[String(a.priority)] ?? 0;
      right = PRIORITY_WEIGHT[String(b.priority)] ?? 0;
    }
    if (field === 'status') {
      left = (a.status as { order?: number } | null)?.order ?? 0;
      right = (b.status as { order?: number } | null)?.order ?? 0;
    }
    if (field === 'assignee') {
      left = (a.assignee as { firstName?: string } | null)?.firstName ?? '';
      right = (b.assignee as { firstName?: string } | null)?.firstName ?? '';
    }
    if (field === 'category') {
      left = (a.category as { name?: string } | null)?.name ?? '';
      right = (b.category as { name?: string } | null)?.name ?? '';
    }
    if (left instanceof Date || right instanceof Date || field === 'dueDate' || field === 'createdAt' || field === 'updatedAt') {
      const l = left ? new Date(String(left)).getTime() : 0;
      const r = right ? new Date(String(right)).getTime() : 0;
      return (l - r) * dir;
    }
    if (typeof left === 'number' && typeof right === 'number') {
      return (left - right) * dir;
    }
    return String(left ?? '').localeCompare(String(right ?? '')) * dir;
  });
}

export const taskService = {
  async list(input: ListTasksInput) {
    const query: FilterQuery<typeof Task> = {
      workspaceId: input.workspaceId,
      parentTaskId: { $exists: false },
    };

    const isAdmin = input.roleKey === 'OWNER' || input.roleKey === 'ADMIN';
    if (!isAdmin) {
      const allowed = input.assignedProjectIds ?? [];
      if (input.projectId) {
        if (!allowed.includes(input.projectId)) {
          return [];
        }
        query.projectId = input.projectId;
      } else {
        query.projectId = { $in: allowed };
      }
    } else if (input.projectId) {
      query.projectId = input.projectId;
    }

    if (input.assigneeId) query.assigneeId = input.assigneeId;
    if (input.statusId) query.statusId = input.statusId;
    if (input.categoryId) query.categoryId = input.categoryId;
    if (input.priority) query.priority = input.priority;
    if (input.backlog) {
      query.$and = [...(Array.isArray(query.$and) ? query.$and : []), {
        $or: [{ sprintId: { $exists: false } }, { sprintId: null }, { sprintId: '' }],
      }];
    } else if (input.sprintId) {
      query.sprintId = input.sprintId;
    }
    if (input.search) {
      query.$or = [
        { title: { $regex: input.search, $options: 'i' } },
        { description: { $regex: input.search, $options: 'i' } },
      ];
    }

    const compiled = compileFilters(input.filters);
    const finalQuery = Object.keys(compiled).length ? { $and: [query, compiled] } : query;
    const tasks = await Task.find(finalQuery).sort({ order: 1, createdAt: 1 });
    const hydrated = await hydrateTasks(tasks);
    if (!input.sortField) {
      return hydrated;
    }
    return sortTasks(hydrated, input.sortField, input.sortDirection ?? 'asc');
  },

  async get(workspaceId: string, taskId: string, access?: { roleKey?: string; assignedProjectIds?: string[] }) {
    const task = await Task.findOne({ id: taskId, workspaceId });
    if (!task) {
      throw ApiError.notFound('TASK_NOT_FOUND', 'Task not found');
    }
    const isAdmin = access?.roleKey === 'OWNER' || access?.roleKey === 'ADMIN';
    if (!isAdmin && access?.assignedProjectIds && !access.assignedProjectIds.includes(task.projectId)) {
      throw ApiError.forbidden('You are not a member of this project');
    }
    const [hydrated] = await hydrateTasks([task]);
    const subtasks = await Task.find({ parentTaskId: taskId }).sort({ order: 1 });
    const dependencies = await TaskDependency.find({ taskId });
    const comments = await Comment.find({ taskId, deletedAt: null }).sort({ createdAt: 1 });
    const commentUsers = await User.find({ id: { $in: comments.map((item) => item.userId) } });
    const userMap = new Map(commentUsers.map((user) => [user.id, user.toJSON()]));
    return {
      ...hydrated,
      subtasks: await hydrateTasks(subtasks),
      dependencies,
      comments: comments.map((comment) => ({ ...comment.toJSON(), user: userMap.get(comment.userId) ?? null })),
    };
  },

  async create(
    workspaceId: string,
    userId: string,
    input: {
      projectId: string;
      title: string;
      description?: string;
      statusId?: string;
      categoryId: string;
      priority?: string;
      assigneeId?: string | null;
      parentTaskId?: string;
      milestoneId?: string | null;
      sprintId?: string | null;
      startDate?: Date;
      dueDate?: Date;
      storyPoints?: number | null;
      tagIds?: string[];
      customFields?: Record<string, unknown>;
      externalKey?: string;
      source?: {
        kind: 'DOCUMENT' | 'APP' | 'GITHUB';
        name?: string;
        section?: string;
        importedDescription?: string;
        importedTitle?: string;
        integrationId?: string;
      };
      activityMeta?: Record<string, unknown>;
    }
  ) {
    const project = await Project.findOne({ id: input.projectId, workspaceId });
    if (!project) {
      throw ApiError.notFound('PROJECT_NOT_FOUND', 'Project not found');
    }
    const category = await Category.findOne({ id: input.categoryId, workspaceId, isActive: true });
    if (!category) {
      throw ApiError.notFound('CATEGORY_NOT_FOUND', 'Category not found');
    }

    let statusId = input.statusId;
    if (!statusId) {
      const defaultStatus = await Status.findOne({ workflowId: project.workflowId, isDefault: true, isActive: true });
      statusId = defaultStatus?.id;
    }
    if (!statusId) {
      throw ApiError.badRequest('STATUS_REQUIRED', 'A status is required');
    }

    const status = await Status.findOne({ id: statusId, workflowId: project.workflowId, isActive: true });
    if (!status) {
      throw ApiError.badRequest('INVALID_STATUS', 'Status does not belong to the project workflow');
    }

    const counted = await Project.findOneAndUpdate(
      { id: input.projectId, workspaceId },
      { $inc: { taskCounter: 1 } },
      { new: true }
    );
    if (!counted) {
      throw ApiError.notFound('PROJECT_NOT_FOUND', 'Project not found');
    }
    const number = counted.taskCounter ?? 1;
    const key = `${counted.key}-${number}`;

    const count = await Task.countDocuments({ projectId: input.projectId, statusId });
    const task = await Task.create({
      workspaceId,
      projectId: input.projectId,
      parentTaskId: input.parentTaskId,
      milestoneId: input.milestoneId ?? undefined,
      sprintId: input.sprintId ?? undefined,
      title: input.title,
      description: input.description ?? '',
      statusId,
      categoryId: input.categoryId,
      priority: input.priority ?? 'MEDIUM',
      assigneeId: input.assigneeId ?? undefined,
      creatorId: userId,
      startDate: input.startDate,
      dueDate: input.dueDate,
      number,
      key,
      storyPoints: input.storyPoints ?? undefined,
      order: count,
      customFields: input.customFields ?? {},
      completedAt: status.category === STATUS_CATEGORIES.COMPLETED ? new Date() : undefined,
      externalKey: input.externalKey,
      source: input.source ? { ...input.source, syncedAt: new Date() } : undefined,
    });

    if (input.tagIds?.length) {
      await TaskTag.insertMany(input.tagIds.map((tagId) => ({ taskId: task.id, tagId })));
    }

    await activityService.record({
      workspaceId,
      projectId: task.projectId,
      taskId: task.id,
      userId,
      action: 'TASK_CREATED',
      entityType: 'task',
      entityId: task.id,
      metadata: { title: task.title, ...input.activityMeta },
    });

    if (task.assigneeId && task.assigneeId !== userId) {
      await notificationService.create({
        userId: task.assigneeId,
        workspaceId,
        type: 'assigned',
        title: 'Task assigned',
        message: `You were assigned “${task.title}”`,
        entityType: 'task',
        entityId: task.id,
      });
      const assignee = await User.findOne({ id: task.assigneeId });
      if (assignee?.email) {
        void emailService.sendTaskAssigned({
          to: assignee.email,
          inviteeName: assignee.firstName,
          taskTitle: task.title,
          taskKey: task.key ?? undefined,
          taskId: task.id,
        });
      }
    }

    return this.get(workspaceId, task.id);
  },

  async update(workspaceId: string, taskId: string, userId: string, input: Record<string, unknown>) {
    const task = await Task.findOne({ id: taskId, workspaceId });
    if (!task) {
      throw ApiError.notFound('TASK_NOT_FOUND', 'Task not found');
    }

    const previousAssignee = task.assigneeId;
    const previousStatus = task.statusId;

    if (typeof input.title === 'string') task.title = input.title;
    if (typeof input.description === 'string') task.description = input.description;
    if (typeof input.priority === 'string') task.priority = input.priority as typeof task.priority;
    if ('assigneeId' in input) task.assigneeId = (input.assigneeId as string | null) ?? undefined;
    if ('milestoneId' in input) task.milestoneId = (input.milestoneId as string | null) ?? undefined;
    if ('sprintId' in input) {
      if (input.sprintId === null || input.sprintId === '') {
        task.set('sprintId', undefined);
        await Task.updateOne({ id: taskId, workspaceId }, { $unset: { sprintId: '' } });
      } else if (typeof input.sprintId === 'string') {
        task.sprintId = input.sprintId;
      }
    }
    if (input.startDate) task.startDate = new Date(String(input.startDate));
    if ('dueDate' in input) {
      if (input.dueDate === null || input.dueDate === '') {
        task.set('dueDate', undefined);
        await Task.updateOne({ id: taskId, workspaceId }, { $unset: { dueDate: '' } });
      } else {
        task.dueDate = new Date(String(input.dueDate));
      }
    }
    if (input.customFields) task.customFields = input.customFields;
    if (typeof input.categoryId === 'string') task.categoryId = input.categoryId;
    if (typeof input.order === 'number') task.order = input.order;
    if ('storyPoints' in input) {
      if (input.storyPoints === null || input.storyPoints === '') {
        task.set('storyPoints', undefined);
        await Task.updateOne({ id: taskId, workspaceId }, { $unset: { storyPoints: '' } });
      } else if (typeof input.storyPoints === 'number') {
        task.storyPoints = input.storyPoints;
      }
    }
    if (typeof input.statusId === 'string' && input.statusId !== task.statusId) {
      await assertTransitionAllowed(task, input.statusId);
      task.statusId = input.statusId;
      const nextStatus = await Status.findOne({ id: input.statusId });
      task.completedAt = nextStatus?.category === STATUS_CATEGORIES.COMPLETED ? new Date() : undefined;
    }

    await task.save();

    if (Array.isArray(input.tagIds)) {
      await TaskTag.deleteMany({ taskId });
      if (input.tagIds.length) {
        await TaskTag.insertMany((input.tagIds as string[]).map((tagId) => ({ taskId, tagId })));
      }
    }

    await activityService.record({
      workspaceId,
      projectId: task.projectId,
      taskId,
      userId,
      action: previousStatus !== task.statusId ? 'TASK_STATUS_CHANGED' : 'TASK_UPDATED',
      entityType: 'task',
      entityId: taskId,
      metadata: { fromStatusId: previousStatus, toStatusId: task.statusId },
    });

    if (task.assigneeId && task.assigneeId !== previousAssignee && task.assigneeId !== userId) {
      await notificationService.create({
        userId: task.assigneeId,
        workspaceId,
        type: 'assigned',
        title: 'Task assigned',
        message: `You were assigned “${task.title}”`,
        entityType: 'task',
        entityId: task.id,
      });
      const assignee = await User.findOne({ id: task.assigneeId });
      if (assignee?.email) {
        void emailService.sendTaskAssigned({
          to: assignee.email,
          inviteeName: assignee.firstName,
          taskTitle: task.title,
          taskKey: task.key ?? undefined,
          taskId: task.id,
        });
      }
    }

    if (previousStatus !== task.statusId && task.assigneeId && task.assigneeId !== userId) {
      await notificationService.create({
        userId: task.assigneeId,
        workspaceId,
        type: 'status_changed',
        title: 'Status updated',
        message: `“${task.title}” changed status`,
        entityType: 'task',
        entityId: task.id,
      });
    }

    return this.get(workspaceId, taskId);
  },

  async move(workspaceId: string, taskId: string, userId: string, statusId: string, order?: number) {
    const task = await Task.findOne({ id: taskId, workspaceId });
    if (!task) {
      throw ApiError.notFound('TASK_NOT_FOUND', 'Task not found');
    }

    const previousStatusId = task.statusId;
    const targetStatusId = statusId || task.statusId;
    if (targetStatusId !== task.statusId) {
      await assertTransitionAllowed(task, targetStatusId);
      const nextStatus = await Status.findOne({ id: targetStatusId });
      task.statusId = targetStatusId;
      task.completedAt = nextStatus?.category === STATUS_CATEGORIES.COMPLETED ? new Date() : undefined;
    }

    const siblings = await Task.find({
      workspaceId,
      projectId: task.projectId,
      statusId: targetStatusId,
      parentTaskId: { $exists: false },
      id: { $ne: taskId },
    }).sort({ order: 1, createdAt: 1 });

    const targetOrder =
      typeof order === 'number' ? Math.max(0, Math.min(order, siblings.length)) : siblings.length;
    siblings.splice(targetOrder, 0, task);
    task.order = targetOrder;
    await task.save();

    await Promise.all(
      siblings.map((sibling, index) => {
        if (sibling.id === taskId) {
          return Promise.resolve();
        }
        if (sibling.order === index) {
          return Promise.resolve();
        }
        sibling.order = index;
        return sibling.save();
      })
    );

    if (previousStatusId !== targetStatusId) {
      const previousSiblings = await Task.find({
        workspaceId,
        projectId: task.projectId,
        statusId: previousStatusId,
        parentTaskId: { $exists: false },
      }).sort({ order: 1, createdAt: 1 });
      await Promise.all(
        previousSiblings.map((sibling, index) => {
          if (sibling.order === index) return Promise.resolve();
          sibling.order = index;
          return sibling.save();
        })
      );
    }

    await activityService.record({
      workspaceId,
      projectId: task.projectId,
      taskId,
      userId,
      action: previousStatusId !== targetStatusId ? 'TASK_STATUS_CHANGED' : 'TASK_UPDATED',
      entityType: 'task',
      entityId: taskId,
      metadata: { fromStatusId: previousStatusId, toStatusId: targetStatusId, order: targetOrder },
    });

    if (previousStatusId !== targetStatusId && task.assigneeId && task.assigneeId !== userId) {
      await notificationService.create({
        userId: task.assigneeId,
        workspaceId,
        type: 'status_changed',
        title: 'Status updated',
        message: `“${task.title}” changed status`,
        entityType: 'task',
        entityId: task.id,
      });
    }

    return this.get(workspaceId, taskId);
  },

  async remove(workspaceId: string, taskId: string) {
    const task = await Task.findOne({ id: taskId, workspaceId });
    if (!task) {
      throw ApiError.notFound('TASK_NOT_FOUND', 'Task not found');
    }
    await Task.deleteMany({ $or: [{ id: taskId }, { parentTaskId: taskId }] });
    await TaskTag.deleteMany({ taskId });
    await TaskDependency.deleteMany({ $or: [{ taskId }, { dependsOnTaskId: taskId }] });
    return { deleted: true };
  },

  async addComment(workspaceId: string, taskId: string, userId: string, content: string, parentCommentId?: string) {
    const task = await Task.findOne({ id: taskId, workspaceId });
    if (!task) {
      throw ApiError.notFound('TASK_NOT_FOUND', 'Task not found');
    }
    const comment = await Comment.create({
      workspaceId,
      projectId: task.projectId,
      taskId,
      userId,
      content,
      parentCommentId,
    });
    await activityService.record({
      workspaceId,
      projectId: task.projectId,
      taskId,
      userId,
      action: 'COMMENT_CREATED',
      entityType: 'comment',
      entityId: comment.id,
    });
    if (task.assigneeId && task.assigneeId !== userId) {
      await notificationService.create({
        userId: task.assigneeId,
        workspaceId,
        type: 'comment_added',
        title: 'New comment',
        message: `A comment was added on “${task.title}”`,
        entityType: 'task',
        entityId: task.id,
      });
    }
    const user = await User.findOne({ id: userId });
    return { ...comment.toJSON(), user: user?.toJSON() ?? null };
  },

  async addDependency(workspaceId: string, taskId: string, userId: string, dependsOnTaskId: string, type: string) {
    if (taskId === dependsOnTaskId) {
      throw ApiError.badRequest('INVALID_DEPENDENCY', 'A task cannot depend on itself');
    }
    const [task, dependsOn] = await Promise.all([
      Task.findOne({ id: taskId, workspaceId }),
      Task.findOne({ id: dependsOnTaskId, workspaceId }),
    ]);
    if (!task || !dependsOn) {
      throw ApiError.notFound('TASK_NOT_FOUND', 'Task not found');
    }
    return TaskDependency.create({
      workspaceId,
      taskId,
      dependsOnTaskId,
      type,
      createdBy: userId,
    });
  },

  async listMilestones(workspaceId: string, projectId: string) {
    return Milestone.find({ workspaceId, projectId }).sort({ dueDate: 1, createdAt: 1 });
  },

  async createMilestone(
    workspaceId: string,
    projectId: string,
    input: { name: string; description?: string; startDate?: Date; dueDate?: Date; ownerId?: string }
  ) {
    return Milestone.create({
      workspaceId,
      projectId,
      name: input.name,
      description: input.description ?? '',
      startDate: input.startDate,
      dueDate: input.dueDate,
      ownerId: input.ownerId,
    });
  },
};

async function assertTransitionAllowed(task: { projectId: string; statusId: string }, toStatusId: string) {
  const project = await Project.findOne({ id: task.projectId });
  if (!project) {
    throw ApiError.notFound('PROJECT_NOT_FOUND', 'Project not found');
  }
  const target = await Status.findOne({ id: toStatusId, workflowId: project.workflowId, isActive: true });
  if (!target) {
    throw ApiError.badRequest('INVALID_STATUS', 'Status does not belong to the project workflow');
  }
  const transitions = await WorkflowTransition.find({ workflowId: project.workflowId });
  if (!transitions.length) {
    return;
  }
  const allowed = transitions.some(
    (item) => item.fromStatusId === task.statusId && item.toStatusId === toStatusId && item.isAllowed
  );
  if (!allowed) {
    throw ApiError.badRequest('TRANSITION_NOT_ALLOWED', 'This status transition is not allowed');
  }
}
