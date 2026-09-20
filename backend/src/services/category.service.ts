import { Category } from '../models';
import { keyify } from '../utils/ids';
import { ApiError } from '../utils/ApiError';

export const categoryService = {
  async list(workspaceId: string) {
    return Category.find({ workspaceId, isActive: true }).sort({ order: 1, name: 1 });
  },

  async create(workspaceId: string, input: { name: string; description?: string; color?: string; icon?: string }) {
    const count = await Category.countDocuments({ workspaceId });
    return Category.create({
      workspaceId,
      name: input.name,
      key: keyify(input.name),
      description: input.description ?? '',
      color: input.color ?? '#6366F1',
      icon: input.icon ?? 'label',
      order: count,
    });
  },

  async update(workspaceId: string, categoryId: string, input: Record<string, unknown>) {
    const category = await Category.findOneAndUpdate({ id: categoryId, workspaceId }, input, { new: true });
    if (!category) {
      throw ApiError.notFound('CATEGORY_NOT_FOUND', 'Category not found');
    }
    return category;
  },

  async remove(workspaceId: string, categoryId: string) {
    const category = await Category.findOneAndUpdate(
      { id: categoryId, workspaceId },
      { isActive: false },
      { new: true }
    );
    if (!category) {
      throw ApiError.notFound('CATEGORY_NOT_FOUND', 'Category not found');
    }
    return category;
  },
};
