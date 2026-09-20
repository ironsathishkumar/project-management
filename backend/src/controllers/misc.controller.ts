import { Request, Response } from 'express';
import { reportService } from '../services/report.service';
import { searchService } from '../services/search.service';
import { customFieldService, tagService, viewService } from '../services/view.service';
import { notificationService } from '../services/notification.service';
import { activityService } from '../services/activity.service';
import { navigationService } from '../services/navigation.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { Role } from '../models';

export const reportController = {
  summary: asyncHandler(async (req: Request, res: Response) => {
    const summary = await reportService.workspaceSummary(req.workspaceContext!.workspaceId);
    sendSuccess(res, summary);
  }),
};

export const navigationController = {
  menus: asyncHandler(async (req: Request, res: Response) => {
    const ctx = req.workspaceContext!;
    const projectId =
      typeof req.query.projectId === 'string' && req.query.projectId.trim()
        ? req.query.projectId.trim()
        : undefined;
    sendSuccess(
      res,
      navigationService.forContext({
        roleKey: ctx.roleKey,
        projectId,
      })
    );
  }),
};

export const searchController = {
  search: asyncHandler(async (req: Request, res: Response) => {
    const q = String(req.query.q ?? '');
    if (q.trim().length < 2) {
      sendSuccess(res, { projects: [], tasks: [], users: [], comments: [], milestones: [] });
      return;
    }
    const ctx = req.workspaceContext!;
    const results = await searchService.search(ctx.workspaceId, q.trim(), {
      userId: req.authUser!.id,
      roleKey: ctx.roleKey,
      assignedProjectIds: ctx.assignedProjectIds,
    });
    sendSuccess(res, results);
  }),
};

export const viewController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const views = await viewService.list(req.workspaceContext!.workspaceId, req.query.projectId as string | undefined);
    sendSuccess(res, views);
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    const view = await viewService.create(req.workspaceContext!.workspaceId, req.authUser!.id, req.body);
    sendSuccess(res, view, 201);
  }),
  remove: asyncHandler(async (req: Request, res: Response) => {
    const result = await viewService.remove(req.workspaceContext!.workspaceId, req.params.viewId);
    sendSuccess(res, result);
  }),
};

export const tagController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await tagService.list(req.workspaceContext!.workspaceId));
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await tagService.create(req.workspaceContext!.workspaceId, req.body), 201);
  }),
};

export const customFieldController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(
      res,
      await customFieldService.list(req.workspaceContext!.workspaceId, req.query.projectId as string | undefined)
    );
  }),
  create: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await customFieldService.create(req.workspaceContext!.workspaceId, req.body), 201);
  }),
};

export const notificationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await notificationService.list(req.authUser!.id));
  }),
  markRead: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await notificationService.markRead(req.authUser!.id, req.params.notificationId));
  }),
  markAllRead: asyncHandler(async (req: Request, res: Response) => {
    await notificationService.markAllRead(req.authUser!.id);
    sendSuccess(res, { ok: true });
  }),
};

export const activityController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(
      res,
      await activityService.list({
        workspaceId: req.workspaceContext!.workspaceId,
        projectId: req.query.projectId as string | undefined,
        taskId: req.query.taskId as string | undefined,
      })
    );
  }),
};

export const roleController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    sendSuccess(res, await Role.find({ isSystemRole: true }).sort({ name: 1 }));
  }),
};
