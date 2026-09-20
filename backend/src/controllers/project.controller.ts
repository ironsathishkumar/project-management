import { Request, Response } from 'express';
import { projectService } from '../services/project.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

export const projectController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const projects = await projectService.list(req.workspaceContext!.workspaceId, req.authUser!.id);
    sendSuccess(res, projects);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const project = await projectService.create(req.workspaceContext!.workspaceId, req.authUser!.id, req.body);
    sendSuccess(res, project, 201);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const project = await projectService.get(req.workspaceContext!.workspaceId, req.params.projectId);
    sendSuccess(res, project);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const project = await projectService.update(
      req.workspaceContext!.workspaceId,
      req.params.projectId,
      req.authUser!.id,
      req.body
    );
    sendSuccess(res, project);
  }),

  archive: asyncHandler(async (req: Request, res: Response) => {
    const project = await projectService.archive(
      req.workspaceContext!.workspaceId,
      req.params.projectId,
      req.authUser!.id
    );
    sendSuccess(res, project);
  }),

  members: asyncHandler(async (req: Request, res: Response) => {
    const members = await projectService.listMembers(req.params.projectId);
    sendSuccess(res, members);
  }),

  addMember: asyncHandler(async (req: Request, res: Response) => {
    const member = await projectService.addMember(
      req.workspaceContext!.workspaceId,
      req.params.projectId,
      req.authUser!.id,
      req.body.userId,
      req.body.projectRole
    );
    sendSuccess(res, member, 201);
  }),

  removeMember: asyncHandler(async (req: Request, res: Response) => {
    const result = await projectService.removeMember(req.params.projectId, req.params.memberId);
    sendSuccess(res, result);
  }),

  updateMember: asyncHandler(async (req: Request, res: Response) => {
    const member = await projectService.updateMemberRole(
      req.params.projectId,
      req.params.memberId,
      req.body.projectRole
    );
    sendSuccess(res, member);
  }),

  listRoles: asyncHandler(async (req: Request, res: Response) => {
    const { projectRoleService } = await import('../services/projectRole.service');
    await projectRoleService.seedDefaults(req.workspaceContext!.workspaceId, req.params.projectId);
    const roles = await projectRoleService.list(req.params.projectId);
    sendSuccess(res, roles);
  }),

  createRole: asyncHandler(async (req: Request, res: Response) => {
    const { projectRoleService } = await import('../services/projectRole.service');
    const role = await projectRoleService.create(
      req.workspaceContext!.workspaceId,
      req.params.projectId,
      req.body
    );
    sendSuccess(res, role, 201);
  }),

  updateRole: asyncHandler(async (req: Request, res: Response) => {
    const { projectRoleService } = await import('../services/projectRole.service');
    const role = await projectRoleService.update(req.params.projectId, req.params.roleId, req.body);
    sendSuccess(res, role);
  }),

  removeRole: asyncHandler(async (req: Request, res: Response) => {
    const { projectRoleService } = await import('../services/projectRole.service');
    const result = await projectRoleService.remove(req.params.projectId, req.params.roleId);
    sendSuccess(res, result);
  }),
};
