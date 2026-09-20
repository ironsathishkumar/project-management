import { TimeEntry, Task, User } from '../models';
import { ApiError } from '../utils/ApiError';

export const timeEntryService = {
  async listForTask(workspaceId: string, taskId: string) {
    const task = await Task.findOne({ id: taskId, workspaceId });
    if (!task) throw ApiError.notFound('TASK_NOT_FOUND', 'Task not found');

    const entries = await TimeEntry.find({ workspaceId, taskId }).sort({ workDate: -1, createdAt: -1 });
    const users = await User.find({ id: { $in: entries.map((item) => item.userId) } });
    const userMap = new Map(users.map((user) => [user.id, user.toJSON()]));
    const totalMinutes = entries.reduce((sum, item) => sum + item.minutes, 0);

    return {
      totalMinutes,
      entries: entries.map((entry) => ({
        ...entry.toJSON(),
        user: userMap.get(entry.userId) ?? null,
      })),
    };
  },

  async create(
    workspaceId: string,
    userId: string,
    input: { taskId: string; minutes: number; workDate?: Date; description?: string }
  ) {
    const task = await Task.findOne({ id: input.taskId, workspaceId });
    if (!task) throw ApiError.notFound('TASK_NOT_FOUND', 'Task not found');
    if (input.minutes < 1) {
      throw ApiError.badRequest('INVALID_MINUTES', 'Minutes must be at least 1');
    }

    const entry = await TimeEntry.create({
      workspaceId,
      projectId: task.projectId,
      taskId: task.id,
      userId,
      minutes: Math.round(input.minutes),
      workDate: input.workDate ?? new Date(),
      description: input.description ?? '',
    });

    const user = await User.findOne({ id: userId });
    return { ...entry.toJSON(), user: user?.toJSON() ?? null };
  },

  async remove(workspaceId: string, entryId: string, userId: string, isAdmin: boolean) {
    const entry = await TimeEntry.findOne({ id: entryId, workspaceId });
    if (!entry) throw ApiError.notFound('TIME_ENTRY_NOT_FOUND', 'Time entry not found');
    if (!isAdmin && entry.userId !== userId) {
      throw ApiError.forbidden('You can only delete your own time entries');
    }
    await entry.deleteOne();
    return { deleted: true };
  },
};
