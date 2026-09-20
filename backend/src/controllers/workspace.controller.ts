import { Request, Response } from 'express';
import { workspaceService } from '../services/workspace.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

export const workspaceController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const workspaces = await workspaceService.listForUser(req.authUser!.id);
    sendSuccess(res, workspaces);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const workspace = await workspaceService.create(req.authUser!.id, req.body);
    sendSuccess(res, workspace, 201);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const workspace = await workspaceService.getById(req.params.workspaceId);
    sendSuccess(res, workspace);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const workspace = await workspaceService.update(req.params.workspaceId, req.authUser!.id, req.body);
    sendSuccess(res, workspace);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const workspace = await workspaceService.remove(req.params.workspaceId);
    sendSuccess(res, workspace);
  }),

  members: asyncHandler(async (req: Request, res: Response) => {
    const members = await workspaceService.listMembers(req.params.workspaceId);
    sendSuccess(res, members);
  }),

  invite: asyncHandler(async (req: Request, res: Response) => {
    const member = await workspaceService.inviteMember(req.params.workspaceId, req.authUser!.id, {
      email: req.body.email,
      roleKey: req.body.roleKey,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      password: req.body.password,
    });
    sendSuccess(res, member, 201);
  }),

  updateMember: asyncHandler(async (req: Request, res: Response) => {
    const member = await workspaceService.updateMember(
      req.params.workspaceId,
      req.params.memberId,
      {
        roleKey: req.body.roleKey,
        status: req.body.status,
      },
      req.authUser!.id
    );
    sendSuccess(res, member);
  }),

  removeMember: asyncHandler(async (req: Request, res: Response) => {
    const result = await workspaceService.removeMember(
      req.params.workspaceId,
      req.params.memberId,
      req.authUser!.id
    );
    sendSuccess(res, result);
  }),
};
