import argon2 from 'argon2';
import { MEMBER_STATUS, ROLE_KEYS, STATUS_CATEGORIES } from '../config/constants';
import {
  Category,
  Project,
  ProjectMember,
  Role,
  Status,
  Tag,
  User,
  Workflow,
  Workspace,
  WorkspaceMember,
} from '../models';
import { keyify, slugify } from '../utils/ids';
import { ApiError } from '../utils/ApiError';
import { activityService } from './activity.service';
import { emailService } from './email.service';
import { getSystemRole } from './role.service';

const DEFAULT_CATEGORIES = [
  { name: 'Feature', color: '#4F46E5', icon: 'sparkles' },
  { name: 'Bug', color: '#DC2626', icon: 'bug' },
  { name: 'Improvement', color: '#0891B2', icon: 'trending-up' },
  { name: 'Research', color: '#7C3AED', icon: 'search' },
  { name: 'Documentation', color: '#0F766E', icon: 'book' },
  { name: 'Request', color: '#D97706', icon: 'inbox' },
];

const DEFAULT_TAGS = [
  { name: 'frontend', color: '#2563EB' },
  { name: 'backend', color: '#16A34A' },
  { name: 'authentication', color: '#9333EA' },
  { name: 'payment', color: '#CA8A04' },
  { name: 'v2', color: '#64748B' },
];

export async function createDefaultWorkflow(workspaceId: string) {
  const workflow = await Workflow.create({
    workspaceId,
    name: 'Software Delivery',
    description: 'Default delivery workflow',
    isDefault: true,
  });

  const statuses = [
    { name: 'To Do', key: 'TO_DO', category: STATUS_CATEGORIES.NOT_STARTED, color: '#64748B', isDefault: true },
    { name: 'In Progress', key: 'IN_PROGRESS', category: STATUS_CATEGORIES.IN_PROGRESS, color: '#2563EB' },
    { name: 'Review', key: 'REVIEW', category: STATUS_CATEGORIES.IN_PROGRESS, color: '#7C3AED' },
    { name: 'Testing', key: 'TESTING', category: STATUS_CATEGORIES.IN_PROGRESS, color: '#D97706' },
    { name: 'Done', key: 'DONE', category: STATUS_CATEGORIES.COMPLETED, color: '#16A34A', isFinal: true },
    { name: 'Cancelled', key: 'CANCELLED', category: STATUS_CATEGORIES.CANCELLED, color: '#94A3B8', isFinal: true },
  ];

  await Status.insertMany(
    statuses.map((status, order) => ({
      workflowId: workflow.id,
      order,
      icon: 'circle',
      isActive: true,
      isDefault: Boolean(status.isDefault),
      isFinal: Boolean(status.isFinal),
      ...status,
    }))
  );

  const implementation = await Workflow.create({
    workspaceId,
    name: 'Implementation Tracking',
    description: 'Requirement through deployment',
    isDefault: false,
  });

  const implementationStatuses = [
    { name: 'Requirement', key: 'REQUIREMENT', category: STATUS_CATEGORIES.NOT_STARTED, color: '#64748B', isDefault: true },
    { name: 'Design', key: 'DESIGN', category: STATUS_CATEGORIES.IN_PROGRESS, color: '#0EA5E9' },
    { name: 'Development', key: 'DEVELOPMENT', category: STATUS_CATEGORIES.IN_PROGRESS, color: '#2563EB' },
    { name: 'Code Review', key: 'CODE_REVIEW', category: STATUS_CATEGORIES.IN_PROGRESS, color: '#7C3AED' },
    { name: 'Testing', key: 'TESTING', category: STATUS_CATEGORIES.IN_PROGRESS, color: '#D97706' },
    { name: 'UAT', key: 'UAT', category: STATUS_CATEGORIES.IN_PROGRESS, color: '#DB2777' },
    { name: 'Deployment', key: 'DEPLOYMENT', category: STATUS_CATEGORIES.IN_PROGRESS, color: '#0F766E' },
    { name: 'Completed', key: 'COMPLETED', category: STATUS_CATEGORIES.COMPLETED, color: '#16A34A', isFinal: true },
  ];

  await Status.insertMany(
    implementationStatuses.map((status, order) => ({
      workflowId: implementation.id,
      order,
      icon: 'circle',
      isActive: true,
      isDefault: Boolean(status.isDefault),
      isFinal: Boolean(status.isFinal),
      ...status,
    }))
  );

  return workflow;
}

export const workspaceService = {
  async create(userId: string, input: { name: string; description?: string }) {
    const existingMemberships = await WorkspaceMember.find({ userId, status: 'ACTIVE' });
    if (existingMemberships.length > 0) {
      const { Role } = await import('../models');
      const roles = await Role.find({ id: { $in: existingMemberships.map((item) => item.roleId) } });
      const canCreate = roles.some(
        (role) => role.key === ROLE_KEYS.OWNER || role.key === ROLE_KEYS.ADMIN
      );
      if (!canCreate) {
        throw ApiError.forbidden('Only workspace owners and admins can create workspaces');
      }
    }

    const base = slugify(input.name) || 'workspace';
    let slug = base;
    let suffix = 1;
    while (await Workspace.findOne({ slug })) {
      slug = `${base}-${suffix++}`;
    }

    const workspace = await Workspace.create({
      name: input.name,
      slug,
      description: input.description ?? '',
      ownerId: userId,
    });

    const ownerRole = await getSystemRole(ROLE_KEYS.OWNER);
    await WorkspaceMember.create({
      workspaceId: workspace.id,
      userId,
      roleId: ownerRole.id,
      status: 'ACTIVE',
      joinedAt: new Date(),
    });

    await createDefaultWorkflow(workspace.id);
    await Category.insertMany(
      DEFAULT_CATEGORIES.map((category, order) => ({
        workspaceId: workspace.id,
        name: category.name,
        key: keyify(category.name),
        color: category.color,
        icon: category.icon,
        order,
      }))
    );
    await Tag.insertMany(
      DEFAULT_TAGS.map((tag) => ({
        workspaceId: workspace.id,
        name: tag.name,
        key: keyify(tag.name),
        color: tag.color,
      }))
    );

    await activityService.record({
      workspaceId: workspace.id,
      userId,
      action: 'WORKSPACE_CREATED',
      entityType: 'workspace',
      entityId: workspace.id,
      metadata: { name: workspace.name },
    });

    return workspace;
  },

  async listForUser(userId: string) {
    const memberships = await WorkspaceMember.find({ userId, status: 'ACTIVE' });
    const workspaceIds = memberships.map((item) => item.workspaceId);
    return Workspace.find({ id: { $in: workspaceIds }, isActive: true }).sort({ name: 1 });
  },

  async getById(workspaceId: string) {
    const workspace = await Workspace.findOne({ id: workspaceId, isActive: true });
    if (!workspace) {
      throw ApiError.notFound('WORKSPACE_NOT_FOUND', 'Workspace not found');
    }
    return workspace;
  },

  async update(workspaceId: string, userId: string, input: Record<string, unknown>) {
    const workspace = await Workspace.findOneAndUpdate({ id: workspaceId }, input, { new: true });
    if (!workspace) {
      throw ApiError.notFound('WORKSPACE_NOT_FOUND', 'Workspace not found');
    }
    await activityService.record({
      workspaceId,
      userId,
      action: 'WORKSPACE_UPDATED',
      entityType: 'workspace',
      entityId: workspaceId,
    });
    return workspace;
  },

  async remove(workspaceId: string) {
    const workspace = await Workspace.findOneAndUpdate(
      { id: workspaceId },
      { isActive: false },
      { new: true }
    );
    if (!workspace) {
      throw ApiError.notFound('WORKSPACE_NOT_FOUND', 'Workspace not found');
    }
    return workspace;
  },

  async listMembers(workspaceId: string) {
    const members = await WorkspaceMember.find({ workspaceId });
    const users = await User.find({ id: { $in: members.map((item) => item.userId) } });
    const { Role } = await import('../models');
    const roles = await Role.find({ id: { $in: members.map((item) => item.roleId) } });
    const userMap = new Map(users.map((user) => [user.id, user]));
    const roleMap = new Map(roles.map((role) => [role.id, role]));
    return members.map((member) => ({
      ...member.toJSON(),
      user: userMap.get(member.userId)?.toJSON() ?? null,
      role: roleMap.get(member.roleId)?.toJSON() ?? null,
    }));
  },

  async inviteMember(
    workspaceId: string,
    actorId: string,
    input: {
      email: string;
      roleKey: string;
      firstName?: string;
      lastName?: string;
      password?: string;
    }
  ) {
    const roleKey = input.roleKey;
    if (roleKey === ROLE_KEYS.OWNER) {
      throw ApiError.badRequest('INVALID_ROLE', 'Owner role cannot be assigned');
    }

    const email = input.email.toLowerCase().trim();
    let user = await User.findOne({ email });
    let createdUser = false;

    if (!user) {
      if (!input.firstName?.trim() || !input.lastName?.trim()) {
        throw ApiError.badRequest(
          'USER_DETAILS_REQUIRED',
          'No account exists for that email. Provide first and last name to create the user.'
        );
      }
      const passwordHash = await argon2.hash(input.password?.trim() || 'ChangeMe123!');
      user = await User.create({
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        passwordHash,
        isActive: true,
      });
      createdUser = true;
    } else if (!user.isActive) {
      throw ApiError.badRequest('USER_DISABLED', 'This user account is disabled');
    }

    const existing = await WorkspaceMember.findOne({ workspaceId, userId: user.id });
    if (existing) {
      if (existing.status === MEMBER_STATUS.DISABLED) {
        const role = await getSystemRole(roleKey);
        existing.roleId = role.id;
        existing.status = MEMBER_STATUS.ACTIVE;
        existing.joinedAt = new Date();
        await existing.save();
        return this.getMember(workspaceId, existing.id);
      }
      throw ApiError.conflict('ALREADY_MEMBER', 'User is already a workspace member');
    }

    const role = await getSystemRole(roleKey);
    const member = await WorkspaceMember.create({
      workspaceId,
      userId: user.id,
      roleId: role.id,
      status: MEMBER_STATUS.ACTIVE,
      invitedAt: new Date(),
      joinedAt: new Date(),
    });

    await activityService.record({
      workspaceId,
      userId: actorId,
      action: 'MEMBER_ADDED',
      entityType: 'member',
      entityId: member.id,
      metadata: { invitedUserId: user.id, roleKey, createdUser },
    });

    const actor = await User.findOne({ id: actorId });
    const workspace = await Workspace.findOne({ id: workspaceId });
    void emailService.sendWorkspaceInvite({
      to: user.email,
      inviteeName: user.firstName,
      workspaceName: workspace?.name ?? 'Workspace',
      roleName: role.name,
      invitedBy: actor ? `${actor.firstName} ${actor.lastName}` : 'An admin',
    });

    return this.getMember(workspaceId, member.id);
  },

  async getMember(workspaceId: string, memberId: string) {
    const member = await WorkspaceMember.findOne({ id: memberId, workspaceId });
    if (!member) {
      throw ApiError.notFound('MEMBER_NOT_FOUND', 'Member not found');
    }
    const [user, role] = await Promise.all([
      User.findOne({ id: member.userId }),
      Role.findOne({ id: member.roleId }),
    ]);
    return {
      ...member.toJSON(),
      user: user?.toJSON() ?? null,
      role: role?.toJSON() ?? null,
    };
  },

  async updateMember(
    workspaceId: string,
    memberId: string,
    input: { roleKey?: string; status?: string },
    actorId?: string
  ) {
    const member = await WorkspaceMember.findOne({ id: memberId, workspaceId });
    if (!member) {
      throw ApiError.notFound('MEMBER_NOT_FOUND', 'Member not found');
    }

    const ownerRole = await getSystemRole(ROLE_KEYS.OWNER);
    if (member.roleId === ownerRole.id) {
      throw ApiError.badRequest('OWNER_PROTECTED', 'Workspace owner cannot be modified');
    }

    if (actorId && member.userId === actorId && input.status === MEMBER_STATUS.DISABLED) {
      throw ApiError.badRequest('SELF_DISABLE', 'You cannot disable your own membership');
    }

    if (input.roleKey) {
      if (input.roleKey === ROLE_KEYS.OWNER) {
        throw ApiError.badRequest('INVALID_ROLE', 'Owner role cannot be assigned');
      }
      const role = await getSystemRole(input.roleKey);
      member.roleId = role.id;
    }

    if (input.status) {
      member.status = input.status as (typeof MEMBER_STATUS)[keyof typeof MEMBER_STATUS];
    }

    await member.save();
    return this.getMember(workspaceId, member.id);
  },

  async removeMember(workspaceId: string, memberId: string, actorId?: string) {
    const member = await WorkspaceMember.findOne({ id: memberId, workspaceId });
    if (!member) {
      throw ApiError.notFound('MEMBER_NOT_FOUND', 'Member not found');
    }
    const ownerRole = await getSystemRole(ROLE_KEYS.OWNER);
    if (member.roleId === ownerRole.id) {
      throw ApiError.badRequest('OWNER_REQUIRED', 'Workspace owner cannot be removed');
    }
    if (actorId && member.userId === actorId) {
      throw ApiError.badRequest('SELF_REMOVE', 'You cannot remove yourself from the workspace');
    }
    await ProjectMember.deleteMany({
      userId: member.userId,
      projectId: { $in: (await Project.find({ workspaceId }).select('id')).map((item) => item.id) },
    });
    await member.deleteOne();
    return { deleted: true };
  },
};
