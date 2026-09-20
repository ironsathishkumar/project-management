import { Request, Response } from 'express';
import { sprintService } from '../services/sprint.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

export const sprintController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const sprints = await sprintService.list(req.workspaceContext!.workspaceId, req.params.projectId);
    sendSuccess(res, sprints);
  }),

  active: asyncHandler(async (req: Request, res: Response) => {
    const sprint = await sprintService.getActive(req.workspaceContext!.workspaceId, req.params.projectId);
    sendSuccess(res, sprint);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const sprint = await sprintService.get(
      req.workspaceContext!.workspaceId,
      req.params.projectId,
      req.params.sprintId
    );
    sendSuccess(res, sprint);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const sprint = await sprintService.create(
      req.workspaceContext!.workspaceId,
      req.params.projectId,
      req.authUser!.id,
      req.body
    );
    sendSuccess(res, sprint, 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const sprint = await sprintService.update(
      req.workspaceContext!.workspaceId,
      req.params.projectId,
      req.params.sprintId,
      req.body
    );
    sendSuccess(res, sprint);
  }),

  start: asyncHandler(async (req: Request, res: Response) => {
    const sprint = await sprintService.start(
      req.workspaceContext!.workspaceId,
      req.params.projectId,
      req.params.sprintId,
      req.authUser!.id
    );
    sendSuccess(res, sprint);
  }),

  complete: asyncHandler(async (req: Request, res: Response) => {
    const sprint = await sprintService.complete(
      req.workspaceContext!.workspaceId,
      req.params.projectId,
      req.params.sprintId,
      req.authUser!.id,
      req.body
    );
    sendSuccess(res, sprint);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const result = await sprintService.remove(
      req.workspaceContext!.workspaceId,
      req.params.projectId,
      req.params.sprintId
    );
    sendSuccess(res, result);
  }),

  moveTasks: asyncHandler(async (req: Request, res: Response) => {
    const result = await sprintService.moveTasks(
      req.workspaceContext!.workspaceId,
      req.params.projectId,
      req.body
    );
    sendSuccess(res, result);
  }),
};
