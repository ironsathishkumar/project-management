import { SavedView, Tag, CustomField } from '../models';
import { keyify } from '../utils/ids';
import { ApiError } from '../utils/ApiError';

export const viewService = {
  async list(workspaceId: string, projectId?: string) {
    const query: Record<string, unknown> = { workspaceId };
    if (projectId) query.projectId = projectId;
    return SavedView.find(query).sort({ createdAt: -1 });
  },

  async create(workspaceId: string, ownerId: string, input: Record<string, unknown>) {
    return SavedView.create({ workspaceId, ownerId, ...input });
  },

  async remove(workspaceId: string, viewId: string) {
    const view = await SavedView.findOneAndDelete({ id: viewId, workspaceId });
    if (!view) {
      throw ApiError.notFound('VIEW_NOT_FOUND', 'Saved view not found');
    }
    return { deleted: true };
  },
};

export const tagService = {
  async list(workspaceId: string) {
    return Tag.find({ workspaceId }).sort({ name: 1 });
  },

  async create(workspaceId: string, input: { name: string; color?: string }) {
    return Tag.create({
      workspaceId,
      name: input.name,
      key: keyify(input.name),
      color: input.color ?? '#0EA5E9',
    });
  },
};

export const customFieldService = {
  async list(workspaceId: string, projectId?: string) {
    const query: Record<string, unknown> = { workspaceId, isActive: true };
    if (projectId) query.$or = [{ projectId }, { projectId: { $exists: false } }];
    return CustomField.find(query).sort({ order: 1 });
  },

  async create(workspaceId: string, input: Record<string, unknown>) {
    const count = await CustomField.countDocuments({ workspaceId });
    return CustomField.create({
      workspaceId,
      ...input,
      key: keyify(String(input.name)),
      order: count,
    });
  },
};
