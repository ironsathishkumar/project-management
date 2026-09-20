import { Router } from 'express';
import { workspaceController } from '../controllers/workspace.controller';
import { authenticate } from '../middlewares/authenticate';
import { loadWorkspaceContext, requirePermission, requireWorkspaceAdmin } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  updateMemberSchema,
  updateWorkspaceSchema,
} from '../validators/schemas';
import { PERMISSIONS } from '../config/constants';

export const workspaceRouter = Router();

workspaceRouter.use(authenticate);
workspaceRouter.get('/', workspaceController.list);
workspaceRouter.post('/', validate(createWorkspaceSchema), workspaceController.create);
workspaceRouter.get(
  '/:workspaceId',
  loadWorkspaceContext,
  requirePermission(PERMISSIONS.WORKSPACE_VIEW),
  workspaceController.get
);
workspaceRouter.patch(
  '/:workspaceId',
  loadWorkspaceContext,
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.WORKSPACE_UPDATE),
  validate(updateWorkspaceSchema),
  workspaceController.update
);
workspaceRouter.delete(
  '/:workspaceId',
  loadWorkspaceContext,
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.WORKSPACE_DELETE),
  workspaceController.remove
);
workspaceRouter.get(
  '/:workspaceId/members',
  loadWorkspaceContext,
  requirePermission(PERMISSIONS.MEMBER_VIEW),
  workspaceController.members
);
workspaceRouter.post(
  '/:workspaceId/members',
  loadWorkspaceContext,
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.MEMBER_INVITE),
  validate(inviteMemberSchema),
  workspaceController.invite
);
workspaceRouter.patch(
  '/:workspaceId/members/:memberId',
  loadWorkspaceContext,
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.MEMBER_UPDATE),
  validate(updateMemberSchema),
  workspaceController.updateMember
);
workspaceRouter.delete(
  '/:workspaceId/members/:memberId',
  loadWorkspaceContext,
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.MEMBER_REMOVE),
  workspaceController.removeMember
);
