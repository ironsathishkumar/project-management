import { PROJECT_STATUS, ROLE_KEYS } from '../config/constants';
import { Project, ProjectMember, User, Workflow, WorkspaceMember } from '../models';
import { keyify } from '../utils/ids';
import { ApiError } from '../utils/ApiError';
import { activityService } from './activity.service';
import { emailService } from './email.service';
import { projectRoleService } from './projectRole.service';
import { getSystemRole } from './role.service';

export const projectService = {
  async list(workspaceId: string, userId: string) {
    const membership = await WorkspaceMember.findOne({ workspaceId, userId, status: 'ACTIVE' });
    if (!membership) return [];
    const role = await getSystemRoleFromId(membership.roleId);

    if (role === ROLE_KEYS.OWNER || role === ROLE_KEYS.ADMIN) {
      return Project.find({ workspaceId, status: { $ne: PROJECT_STATUS.ARCHIVED } }).sort({ updatedAt: -1 });
    }

    const projectMemberships = await ProjectMember.find({ userId });
    const projectIds = projectMemberships.map((item) => item.projectId);
    return Project.find({
      workspaceId,
      id: { $in: projectIds },
      status: { $ne: PROJECT_STATUS.ARCHIVED },
    }).sort({ updatedAt: -1 });
  },

  async get(workspaceId: string, projectId: string) {
    const project = await Project.findOne({ id: projectId, workspaceId });
    if (!project) {
      throw ApiError.notFound('PROJECT_NOT_FOUND', 'Project not found');
    }
    return project;
  },

  async create(
    workspaceId: string,
    userId: string,
    input: {
      name: string;
      key?: string;
      description?: string;
      workflowId?: string;
      startDate?: Date;
      dueDate?: Date;
      icon?: string;
    }
  ) {
    const workflow = input.workflowId
      ? await Workflow.findOne({ id: input.workflowId, workspaceId, isActive: true })
      : await Workflow.findOne({ workspaceId, isDefault: true, isActive: true });

    if (!workflow) {
      throw ApiError.badRequest('WORKFLOW_REQUIRED', 'A workflow is required to create a project');
    }

    const key = (input.key ? keyify(input.key) : keyify(input.name)).slice(0, 8) || 'PROJ';
    const existing = await Project.findOne({ workspaceId, key });
    if (existing) {
      throw ApiError.conflict('PROJECT_KEY_IN_USE', 'Project key is already used in this workspace');
    }

    const project = await Project.create({
      workspaceId,
      name: input.name,
      key,
      description: input.description ?? '',
      ownerId: userId,
      workflowId: workflow.id,
      startDate: input.startDate,
      dueDate: input.dueDate,
      icon: input.icon ?? 'folder',
    });

    await ProjectMember.create({
      projectId: project.id,
      userId,
      projectRole: 'MANAGER',
    });

    await projectRoleService.seedDefaults(workspaceId, project.id);

    await activityService.record({
      workspaceId,
      projectId: project.id,
      userId,
      action: 'PROJECT_CREATED',
      entityType: 'project',
      entityId: project.id,
      metadata: { name: project.name },
    });

    return project;
  },

  async update(workspaceId: string, projectId: string, userId: string, input: Record<string, unknown>) {
    const project = await Project.findOneAndUpdate({ id: projectId, workspaceId }, input, { new: true });
    if (!project) {
      throw ApiError.notFound('PROJECT_NOT_FOUND', 'Project not found');
    }
    await activityService.record({
      workspaceId,
      projectId,
      userId,
      action: 'PROJECT_UPDATED',
      entityType: 'project',
      entityId: projectId,
    });
    return project;
  },

  async archive(workspaceId: string, projectId: string, userId: string) {
    const project = await Project.findOneAndUpdate(
      { id: projectId, workspaceId },
      { status: PROJECT_STATUS.ARCHIVED, archivedAt: new Date() },
      { new: true }
    );
    if (!project) {
      throw ApiError.notFound('PROJECT_NOT_FOUND', 'Project not found');
    }
    await activityService.record({
      workspaceId,
      projectId,
      userId,
      action: 'PROJECT_ARCHIVED',
      entityType: 'project',
      entityId: projectId,
    });
    return project;
  },

  async listMembers(projectId: string) {
    const members = await ProjectMember.find({ projectId });
    const users = await User.find({ id: { $in: members.map((item) => item.userId) } });
    const roles = await projectRoleService.list(projectId);
    const userMap = new Map(users.map((user) => [user.id, user]));
    const roleMap = new Map(roles.map((role) => [role.key, role]));
    return members.map((member) => ({
      ...member.toJSON(),
      user: userMap.get(member.userId)?.toJSON() ?? null,
      role: roleMap.get(member.projectRole)
        ? {
            id: roleMap.get(member.projectRole)!.id,
            name: roleMap.get(member.projectRole)!.name,
            key: roleMap.get(member.projectRole)!.key,
            permissionLevel: roleMap.get(member.projectRole)!.permissionLevel,
            color: roleMap.get(member.projectRole)!.color,
          }
        : { key: member.projectRole, name: member.projectRole },
    }));
  },

  async addMember(
    workspaceId: string,
    projectId: string,
    actorId: string,
    userId: string,
    projectRole: string
  ) {
    const workspaceMember = await WorkspaceMember.findOne({ workspaceId, userId, status: 'ACTIVE' });
    if (!workspaceMember) {
      throw ApiError.badRequest('NOT_WORKSPACE_MEMBER', 'User must belong to the workspace first');
    }
    await projectRoleService.seedDefaults(workspaceId, projectId);
    const roles = await projectRoleService.list(projectId);
    const role = roles.find((item) => item.key === projectRole || item.id === projectRole);
    if (!role) {
      throw ApiError.badRequest('INVALID_PROJECT_ROLE', 'Unknown project role');
    }
    const existing = await ProjectMember.findOne({ projectId, userId });
    if (existing) {
      existing.projectRole = role.key;
      await existing.save();
      return existing;
    }
    const member = await ProjectMember.create({ projectId, userId, projectRole: role.key });
    await activityService.record({
      workspaceId,
      projectId,
      userId: actorId,
      action: 'PROJECT_MEMBER_ADDED',
      entityType: 'projectMember',
      entityId: member.id,
      metadata: { userId, projectRole: role.key },
    });

    const [user, actor, project] = await Promise.all([
      User.findOne({ id: userId }),
      User.findOne({ id: actorId }),
      Project.findOne({ id: projectId }),
    ]);
    if (user?.email) {
      void emailService.sendProjectAssigned({
        to: user.email,
        inviteeName: user.firstName,
        projectName: project?.name ?? 'Project',
        projectKey: project?.key ?? 'PRJ',
        roleName: role.name,
        invitedBy: actor ? `${actor.firstName} ${actor.lastName}` : 'An admin',
        projectId,
      });
    }

    return member;
  },

  async updateMemberRole(projectId: string, memberId: string, projectRole: string) {
    const member = await ProjectMember.findOne({ id: memberId, projectId });
    if (!member) {
      throw ApiError.notFound('MEMBER_NOT_FOUND', 'Project member not found');
    }
    const roles = await projectRoleService.list(projectId);
    const role = roles.find((item) => item.key === projectRole || item.id === projectRole);
    if (!role) {
      throw ApiError.badRequest('INVALID_PROJECT_ROLE', 'Unknown project role');
    }
    member.projectRole = role.key;
    await member.save();
    return member;
  },

  async removeMember(projectId: string, memberId: string) {
    const member = await ProjectMember.findOneAndDelete({ id: memberId, projectId });
    if (!member) {
      throw ApiError.notFound('MEMBER_NOT_FOUND', 'Project member not found');
    }
    return { deleted: true };
  },
};

async function getSystemRoleFromId(roleId: string) {
  const { Role } = await import('../models');
  const role = await Role.findOne({ id: roleId });
  return role?.key ?? ROLE_KEYS.VIEWER;
}
