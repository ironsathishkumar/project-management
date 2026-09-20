import { PROJECT_ROLE_LEVELS, ProjectRole } from '../models/ProjectRole';
import { keyify } from '../utils/ids';
import { ApiError } from '../utils/ApiError';

export const DEFAULT_PROJECT_ROLES = [
  {
    name: 'Project Manager',
    key: 'MANAGER',
    permissionLevel: PROJECT_ROLE_LEVELS.MANAGER,
    color: '#0F766E',
    description: 'Owns delivery and project settings',
    isDefault: true,
  },
  {
    name: 'Full Stack Developer',
    key: 'FULL_STACK',
    permissionLevel: PROJECT_ROLE_LEVELS.MEMBER,
    color: '#4F46E5',
    description: 'Works across frontend and backend',
  },
  {
    name: 'Backend Developer',
    key: 'BACKEND',
    permissionLevel: PROJECT_ROLE_LEVELS.MEMBER,
    color: '#2563EB',
    description: 'Owns APIs and server-side work',
  },
  {
    name: 'Frontend Developer',
    key: 'FRONTEND',
    permissionLevel: PROJECT_ROLE_LEVELS.MEMBER,
    color: '#DB2777',
    description: 'Owns UI and client experience',
  },
  {
    name: 'Viewer',
    key: 'VIEWER',
    permissionLevel: PROJECT_ROLE_LEVELS.VIEWER,
    color: '#64748B',
    description: 'Read-only project access',
  },
];

export const projectRoleService = {
  async seedDefaults(workspaceId: string, projectId: string) {
    const existing = await ProjectRole.countDocuments({ projectId });
    if (existing > 0) return ProjectRole.find({ projectId }).sort({ order: 1 });

    await ProjectRole.insertMany(
      DEFAULT_PROJECT_ROLES.map((role, order) => ({
        workspaceId,
        projectId,
        ...role,
        order,
      }))
    );
    return ProjectRole.find({ projectId }).sort({ order: 1 });
  },

  async list(projectId: string) {
    return ProjectRole.find({ projectId }).sort({ order: 1 });
  },

  async create(
    workspaceId: string,
    projectId: string,
    input: {
      name: string;
      key?: string;
      permissionLevel?: string;
      color?: string;
      description?: string;
    }
  ) {
    const key = (input.key ? keyify(input.key) : keyify(input.name)).toUpperCase().slice(0, 32);
    const existing = await ProjectRole.findOne({ projectId, key });
    if (existing) {
      throw ApiError.conflict('ROLE_KEY_IN_USE', 'A role with this key already exists on the project');
    }
    const count = await ProjectRole.countDocuments({ projectId });
    return ProjectRole.create({
      workspaceId,
      projectId,
      name: input.name.trim(),
      key,
      permissionLevel: input.permissionLevel ?? PROJECT_ROLE_LEVELS.MEMBER,
      color: input.color ?? '#2563EB',
      description: input.description ?? '',
      order: count,
    });
  },

  async update(projectId: string, roleId: string, input: Record<string, unknown>) {
    const role = await ProjectRole.findOneAndUpdate({ id: roleId, projectId }, input, { new: true });
    if (!role) {
      throw ApiError.notFound('PROJECT_ROLE_NOT_FOUND', 'Project role not found');
    }
    return role;
  },

  async remove(projectId: string, roleId: string) {
    const role = await ProjectRole.findOne({ id: roleId, projectId });
    if (!role) {
      throw ApiError.notFound('PROJECT_ROLE_NOT_FOUND', 'Project role not found');
    }
    if (role.isDefault) {
      throw ApiError.badRequest('DEFAULT_ROLE', 'Default project roles cannot be deleted');
    }
    const { ProjectMember } = await import('../models');
    const inUse = await ProjectMember.countDocuments({ projectId, projectRole: role.key });
    if (inUse > 0) {
      throw ApiError.badRequest('ROLE_IN_USE', 'Reassign members before deleting this role');
    }
    await role.deleteOne();
    return { deleted: true };
  },

  async resolveLevel(projectId: string, roleKey: string) {
    const role = await ProjectRole.findOne({ projectId, key: roleKey });
    if (role) return role.permissionLevel;
    if (roleKey === 'MANAGER') return PROJECT_ROLE_LEVELS.MANAGER;
    if (roleKey === 'VIEWER') return PROJECT_ROLE_LEVELS.VIEWER;
    return PROJECT_ROLE_LEVELS.MEMBER;
  },
};
