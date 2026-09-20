import { Request, Response } from 'express';
import { taskService } from '../services/task.service';
import { parseFilters } from '../services/filter.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { Attachment, Task } from '../models';
import { getStorageProvider } from '../services/storage.service';
import { ApiError } from '../utils/ApiError';

export const taskController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as Record<string, string>;
    const ctx = req.workspaceContext!;
    const tasks = await taskService.list({
      workspaceId: ctx.workspaceId,
      roleKey: ctx.roleKey,
      assignedProjectIds: ctx.assignedProjectIds,
      projectId: query.projectId,
      assigneeId: query.assigneeId,
      statusId: query.statusId,
      categoryId: query.categoryId,
      priority: query.priority,
      search: query.search,
      sprintId: query.sprintId,
      backlog: query.backlog === 'true',
      sortField: query.sortField,
      sortDirection: (query.sortDirection as 'asc' | 'desc') ?? 'desc',
      filters: parseFilters(query.filters),
    });
    sendSuccess(res, tasks);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const ctx = req.workspaceContext!;
    const task = await taskService.get(ctx.workspaceId, req.params.taskId, {
      roleKey: ctx.roleKey,
      assignedProjectIds: ctx.assignedProjectIds,
    });
    sendSuccess(res, task);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const task = await taskService.create(req.workspaceContext!.workspaceId, req.authUser!.id, req.body);
    sendSuccess(res, task, 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const task = await taskService.update(
      req.workspaceContext!.workspaceId,
      req.params.taskId,
      req.authUser!.id,
      req.body
    );
    sendSuccess(res, task);
  }),

  move: asyncHandler(async (req: Request, res: Response) => {
    const task = await taskService.move(
      req.workspaceContext!.workspaceId,
      req.params.taskId,
      req.authUser!.id,
      req.body.statusId,
      req.body.order
    );
    sendSuccess(res, task);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const result = await taskService.remove(req.workspaceContext!.workspaceId, req.params.taskId);
    sendSuccess(res, result);
  }),

  comment: asyncHandler(async (req: Request, res: Response) => {
    const comment = await taskService.addComment(
      req.workspaceContext!.workspaceId,
      req.params.taskId,
      req.authUser!.id,
      req.body.content,
      req.body.parentCommentId
    );
    sendSuccess(res, comment, 201);
  }),

  addDependency: asyncHandler(async (req: Request, res: Response) => {
    const dependency = await taskService.addDependency(
      req.workspaceContext!.workspaceId,
      req.params.taskId,
      req.authUser!.id,
      req.body.dependsOnTaskId,
      req.body.type
    );
    sendSuccess(res, dependency, 201);
  }),

  milestones: asyncHandler(async (req: Request, res: Response) => {
    const milestones = await taskService.listMilestones(
      req.workspaceContext!.workspaceId,
      req.params.projectId
    );
    sendSuccess(res, milestones);
  }),

  createMilestone: asyncHandler(async (req: Request, res: Response) => {
    const milestone = await taskService.createMilestone(
      req.workspaceContext!.workspaceId,
      req.params.projectId,
      req.body
    );
    sendSuccess(res, milestone, 201);
  }),

  upload: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      throw ApiError.badRequest('FILE_REQUIRED', 'An attachment file is required');
    }
    const stored = await getStorageProvider().upload({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
    const task = await Task.findOne({ id: req.params.taskId, workspaceId: req.workspaceContext!.workspaceId });
    if (!task) {
      throw ApiError.notFound('TASK_NOT_FOUND', 'Task not found');
    }
    const attachment = await Attachment.create({
      workspaceId: req.workspaceContext!.workspaceId,
      projectId: task.projectId,
      taskId: req.params.taskId,
      uploadedBy: req.authUser!.id,
      ...stored,
    });
    sendSuccess(res, attachment, 201);
  }),

  listTimeEntries: asyncHandler(async (req: Request, res: Response) => {
    const { timeEntryService } = await import('../services/timeEntry.service');
    const result = await timeEntryService.listForTask(
      req.workspaceContext!.workspaceId,
      req.params.taskId
    );
    sendSuccess(res, result);
  }),

  createTimeEntry: asyncHandler(async (req: Request, res: Response) => {
    const { timeEntryService } = await import('../services/timeEntry.service');
    const entry = await timeEntryService.create(req.workspaceContext!.workspaceId, req.authUser!.id, {
      taskId: req.params.taskId,
      ...req.body,
    });
    sendSuccess(res, entry, 201);
  }),

  removeTimeEntry: asyncHandler(async (req: Request, res: Response) => {
    const { timeEntryService } = await import('../services/timeEntry.service');
    const isAdmin =
      req.workspaceContext!.roleKey === 'OWNER' || req.workspaceContext!.roleKey === 'ADMIN';
    const result = await timeEntryService.remove(
      req.workspaceContext!.workspaceId,
      req.params.entryId,
      req.authUser!.id,
      isAdmin
    );
    sendSuccess(res, result);
  }),
};
