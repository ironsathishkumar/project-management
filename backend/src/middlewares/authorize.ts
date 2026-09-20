import { NextFunction, Request, Response } from 'express';
import {
  MEMBER_PERMISSIONS,
  Permission,
  PROJECT_MANAGER_PERMISSIONS,
  ROLE_KEYS,
  VIEWER_PERMISSIONS,
} from '../config/constants';
import { Project, ProjectMember, Role, Task, WorkspaceMember } from '../models';
import { PROJECT_ROLE_LEVELS } from '../models/ProjectRole';
import { projectRoleService } from '../services/projectRole.service';
import { ApiError } from '../utils/ApiError';

function uniquePermissions(permissions: Permission[]): Permission[] {
  return [...new Set(permissions)];
}

function isWorkspaceAdminKey(roleKey: string) {
  return roleKey === ROLE_KEYS.OWNER || roleKey === ROLE_KEYS.ADMIN;
}

export function requirePermission(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const context = req.workspaceContext;
    if (!context) {
      next(ApiError.forbidden('Workspace context is required'));
      return;
    }

    const missing = required.filter((permission) => !context.permissions.includes(permission));
    if (missing.length > 0) {
      next(ApiError.forbidden());
      return;
    }

    next();
  };
}

/** OWNER / ADMIN only — workspace & project administration. */
export function requireWorkspaceAdmin(req: Request, _res: Response, next: NextFunction): void {
  const context = req.workspaceContext;
  if (!context) {
    next(ApiError.forbidden('Workspace context is required'));
    return;
  }
  if (!isWorkspaceAdminKey(context.roleKey)) {
    next(ApiError.forbidden('Admin access required'));
    return;
  }
  next();
}

export async function loadWorkspaceContext(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.authUser) {
      throw ApiError.unauthorized();
    }

    const workspaceId =
      (req.params.workspaceId as string | undefined) ??
      (req.query.workspaceId as string | undefined) ??
      (req.headers['x-workspace-id'] as string | undefined);

    if (!workspaceId) {
      throw ApiError.badRequest('WORKSPACE_REQUIRED', 'Workspace ID is required');
    }

    const membership = await WorkspaceMember.findOne({
      workspaceId,
      userId: req.authUser.id,
      status: 'ACTIVE',
    });

    if (!membership) {
      throw ApiError.forbidden('You are not a member of this workspace');
    }

    const role = await Role.findOne({ id: membership.roleId, isActive: true });
    if (!role) {
      throw ApiError.forbidden('Role is not available');
    }

    let permissions = (role.permissions ?? []) as Permission[];
    let projectId =
      (req.params.projectId as string | undefined) ??
      (req.body?.projectId as string | undefined) ??
      (typeof req.query.projectId === 'string' ? req.query.projectId : undefined);

    // Resolve project from task routes so membership is enforced for /tasks/:taskId
    if (!projectId && typeof req.params.taskId === 'string') {
      const task = await Task.findOne({ id: req.params.taskId, workspaceId }).select('projectId');
      if (task?.projectId) {
        projectId = task.projectId;
      }
    }

    const assignedProjectIds = isWorkspaceAdminKey(role.key)
      ? undefined
      : (
          await Project.find({
            workspaceId,
            id: {
              $in: (await ProjectMember.find({ userId: req.authUser.id }).select('projectId')).map(
                (item) => item.projectId
              ),
            },
          }).select('id')
        ).map((item) => item.id);

    if (projectId && !isWorkspaceAdminKey(role.key)) {
      const project = await Project.findOne({ id: projectId, workspaceId });
      if (!project) {
        throw ApiError.notFound('PROJECT_NOT_FOUND', 'Project not found');
      }

      const projectMember = await ProjectMember.findOne({
        projectId,
        userId: req.authUser.id,
      });

      if (!projectMember) {
        throw ApiError.forbidden('You are not a member of this project');
      }

      const level = await projectRoleService.resolveLevel(projectId, projectMember.projectRole);
      if (level === PROJECT_ROLE_LEVELS.MANAGER) {
        permissions = uniquePermissions([...permissions, ...PROJECT_MANAGER_PERMISSIONS]);
      } else if (level === PROJECT_ROLE_LEVELS.VIEWER) {
        permissions = uniquePermissions([
          ...VIEWER_PERMISSIONS.filter((item) => permissions.includes(item)),
        ]);
      } else {
        permissions = uniquePermissions([...permissions, ...MEMBER_PERMISSIONS]);
      }

      req.workspaceContext = {
        workspaceId,
        membershipId: membership.id,
        roleId: role.id,
        roleKey: role.key,
        permissions,
        projectId,
        projectRole: projectMember.projectRole,
        assignedProjectIds,
      };
      next();
      return;
    }

    req.workspaceContext = {
      workspaceId,
      membershipId: membership.id,
      roleId: role.id,
      roleKey: role.key,
      permissions,
      projectId,
      assignedProjectIds,
    };
    next();
  } catch (error) {
    next(error);
  }
}
