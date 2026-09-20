import { Request, Response } from 'express';
import { workflowService } from '../services/workflow.service';
import { categoryService } from '../services/category.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

export const workflowController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const workflows = await workflowService.list(req.workspaceContext!.workspaceId);
    sendSuccess(res, workflows);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const workflow = await workflowService.create(req.workspaceContext!.workspaceId, req.body);
    sendSuccess(res, workflow, 201);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const workflow = await workflowService.get(req.workspaceContext!.workspaceId, req.params.workflowId);
    sendSuccess(res, workflow);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const workflow = await workflowService.update(
      req.workspaceContext!.workspaceId,
      req.params.workflowId,
      req.body
    );
    sendSuccess(res, workflow);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const workflow = await workflowService.remove(req.workspaceContext!.workspaceId, req.params.workflowId);
    sendSuccess(res, workflow);
  }),

  addStatus: asyncHandler(async (req: Request, res: Response) => {
    const status = await workflowService.addStatus(req.params.workflowId, req.body);
    sendSuccess(res, status, 201);
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const status = await workflowService.updateStatus(req.params.statusId, req.body);
    sendSuccess(res, status);
  }),

  reorder: asyncHandler(async (req: Request, res: Response) => {
    const statuses = await workflowService.reorder(req.params.workflowId, req.body.statusIds);
    sendSuccess(res, statuses);
  }),

  removeStatus: asyncHandler(async (req: Request, res: Response) => {
    const status = await workflowService.removeStatus(req.params.statusId);
    sendSuccess(res, status);
  }),
};

export const categoryController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const categories = await categoryService.list(req.workspaceContext!.workspaceId);
    sendSuccess(res, categories);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const category = await categoryService.create(req.workspaceContext!.workspaceId, req.body);
    sendSuccess(res, category, 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const category = await categoryService.update(
      req.workspaceContext!.workspaceId,
      req.params.categoryId,
      req.body
    );
    sendSuccess(res, category);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const category = await categoryService.remove(req.workspaceContext!.workspaceId, req.params.categoryId);
    sendSuccess(res, category);
  }),
};
