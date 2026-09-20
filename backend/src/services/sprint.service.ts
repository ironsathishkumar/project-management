import { Project, Sprint, Task } from '../models';
import { SPRINT_STATUS } from '../models/Sprint';
import { ApiError } from '../utils/ApiError';
import { activityService } from './activity.service';

export const sprintService = {
  async list(workspaceId: string, projectId: string) {
    const sprints = await Sprint.find({ workspaceId, projectId }).sort({ order: 1, createdAt: 1 });
    const counts = await Task.aggregate([
      {
        $match: {
          workspaceId,
          projectId,
          parentTaskId: { $exists: false },
          sprintId: { $in: sprints.map((sprint) => sprint.id) },
        },
      },
      { $group: { _id: '$sprintId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((item) => [item._id as string, item.count as number]));

    return sprints.map((sprint) => ({
      ...sprint.toJSON(),
      taskCount: countMap.get(sprint.id) ?? 0,
    }));
  },

  async get(workspaceId: string, projectId: string, sprintId: string) {
    const sprint = await Sprint.findOne({ id: sprintId, workspaceId, projectId });
    if (!sprint) {
      throw ApiError.notFound('SPRINT_NOT_FOUND', 'Sprint not found');
    }
    const taskCount = await Task.countDocuments({
      workspaceId,
      projectId,
      sprintId,
      parentTaskId: { $exists: false },
    });
    return { ...sprint.toJSON(), taskCount };
  },

  async getActive(workspaceId: string, projectId: string) {
    const sprint = await Sprint.findOne({
      workspaceId,
      projectId,
      status: SPRINT_STATUS.ACTIVE,
    });
    return sprint ? sprint.toJSON() : null;
  },

  async create(
    workspaceId: string,
    projectId: string,
    userId: string,
    input: { name: string; goal?: string; startDate?: Date; endDate?: Date }
  ) {
    const project = await Project.findOne({ id: projectId, workspaceId });
    if (!project) {
      throw ApiError.notFound('PROJECT_NOT_FOUND', 'Project not found');
    }

    const order = await Sprint.countDocuments({ workspaceId, projectId });
    const sprint = await Sprint.create({
      workspaceId,
      projectId,
      name: input.name,
      goal: input.goal ?? '',
      startDate: input.startDate,
      endDate: input.endDate,
      status: SPRINT_STATUS.PLANNED,
      order,
    });

    await activityService.record({
      workspaceId,
      projectId,
      userId,
      action: 'SPRINT_CREATED',
      entityType: 'sprint',
      entityId: sprint.id,
      metadata: { name: sprint.name },
    });

    return { ...sprint.toJSON(), taskCount: 0 };
  },

  async update(
    workspaceId: string,
    projectId: string,
    sprintId: string,
    input: { name?: string; goal?: string; startDate?: Date | null; endDate?: Date | null }
  ) {
    const sprint = await Sprint.findOne({ id: sprintId, workspaceId, projectId });
    if (!sprint) {
      throw ApiError.notFound('SPRINT_NOT_FOUND', 'Sprint not found');
    }
    if (typeof input.name === 'string') sprint.name = input.name;
    if (typeof input.goal === 'string') sprint.goal = input.goal;
    if ('startDate' in input) sprint.startDate = input.startDate ?? undefined;
    if ('endDate' in input) sprint.endDate = input.endDate ?? undefined;
    await sprint.save();
    return sprint;
  },

  async start(workspaceId: string, projectId: string, sprintId: string, userId: string) {
    const sprint = await Sprint.findOne({ id: sprintId, workspaceId, projectId });
    if (!sprint) {
      throw ApiError.notFound('SPRINT_NOT_FOUND', 'Sprint not found');
    }
    if (sprint.status === SPRINT_STATUS.COMPLETED) {
      throw ApiError.badRequest('SPRINT_COMPLETED', 'Completed sprints cannot be started');
    }
    if (sprint.status === SPRINT_STATUS.ACTIVE) {
      return sprint;
    }

    const active = await Sprint.findOne({
      workspaceId,
      projectId,
      status: SPRINT_STATUS.ACTIVE,
    });
    if (active) {
      throw ApiError.conflict(
        'ACTIVE_SPRINT_EXISTS',
        `Finish “${active.name}” before starting another sprint`
      );
    }

    sprint.status = SPRINT_STATUS.ACTIVE;
    sprint.startedAt = new Date();
    if (!sprint.startDate) sprint.startDate = new Date();
    await sprint.save();

    await activityService.record({
      workspaceId,
      projectId,
      userId,
      action: 'SPRINT_STARTED',
      entityType: 'sprint',
      entityId: sprint.id,
      metadata: { name: sprint.name },
    });

    return sprint;
  },

  async complete(
    workspaceId: string,
    projectId: string,
    sprintId: string,
    userId: string,
    options?: { moveIncompleteToBacklog?: boolean; moveIncompleteToSprintId?: string }
  ) {
    const sprint = await Sprint.findOne({ id: sprintId, workspaceId, projectId });
    if (!sprint) {
      throw ApiError.notFound('SPRINT_NOT_FOUND', 'Sprint not found');
    }
    if (sprint.status !== SPRINT_STATUS.ACTIVE && sprint.status !== SPRINT_STATUS.PLANNED) {
      throw ApiError.badRequest('SPRINT_NOT_ACTIVE', 'Only planned/active sprints can be completed');
    }

    if (options?.moveIncompleteToSprintId) {
      const target = await Sprint.findOne({
        id: options.moveIncompleteToSprintId,
        workspaceId,
        projectId,
        status: { $ne: SPRINT_STATUS.COMPLETED },
      });
      if (!target) {
        throw ApiError.notFound('SPRINT_NOT_FOUND', 'Target sprint not found');
      }
      await Task.updateMany(
        {
          workspaceId,
          projectId,
          sprintId,
          completedAt: null,
        },
        { sprintId: target.id }
      );
    } else if (options?.moveIncompleteToBacklog !== false) {
      await Task.updateMany(
        {
          workspaceId,
          projectId,
          sprintId,
          completedAt: null,
        },
        { $unset: { sprintId: 1 } }
      );
    }

    sprint.status = SPRINT_STATUS.COMPLETED;
    sprint.completedAt = new Date();
    if (!sprint.endDate) sprint.endDate = new Date();
    await sprint.save();

    await activityService.record({
      workspaceId,
      projectId,
      userId,
      action: 'SPRINT_COMPLETED',
      entityType: 'sprint',
      entityId: sprint.id,
      metadata: { name: sprint.name },
    });

    return sprint;
  },

  async remove(workspaceId: string, projectId: string, sprintId: string) {
    const sprint = await Sprint.findOne({ id: sprintId, workspaceId, projectId });
    if (!sprint) {
      throw ApiError.notFound('SPRINT_NOT_FOUND', 'Sprint not found');
    }
    if (sprint.status === SPRINT_STATUS.ACTIVE) {
      throw ApiError.badRequest('SPRINT_ACTIVE', 'Complete the active sprint before deleting it');
    }
    await Task.updateMany({ workspaceId, projectId, sprintId }, { $unset: { sprintId: 1 } });
    await sprint.deleteOne();
    return { deleted: true };
  },

  async moveTasks(
    workspaceId: string,
    projectId: string,
    input: { taskIds: string[]; sprintId: string | null; order?: number }
  ) {
    const tasks = await Task.find({
      workspaceId,
      projectId,
      id: { $in: input.taskIds },
    });
    if (tasks.length === 0) {
      return { updated: 0 };
    }

    const previousSprintKeys = new Set(
      tasks.map((task) => (task.sprintId ? String(task.sprintId) : ''))
    );
    const targetKey = input.sprintId ? String(input.sprintId) : '';

    if (input.sprintId) {
      const sprint = await Sprint.findOne({ id: input.sprintId, workspaceId, projectId });
      if (!sprint) {
        throw ApiError.notFound('SPRINT_NOT_FOUND', 'Sprint not found');
      }
      if (sprint.status === SPRINT_STATUS.COMPLETED) {
        throw ApiError.badRequest('SPRINT_COMPLETED', 'Cannot add tasks to a completed sprint');
      }
      await Task.updateMany(
        { workspaceId, projectId, id: { $in: input.taskIds } },
        { sprintId: input.sprintId }
      );
    } else {
      await Task.updateMany(
        { workspaceId, projectId, id: { $in: input.taskIds } },
        { $unset: { sprintId: 1 } }
      );
    }

    await reindexSprintContainer(workspaceId, projectId, targetKey, input.taskIds, input.order);

    for (const sourceKey of previousSprintKeys) {
      if (sourceKey === targetKey) continue;
      await reindexSprintContainer(workspaceId, projectId, sourceKey);
    }

    return { updated: input.taskIds.length };
  },
};

async function reindexSprintContainer(
  workspaceId: string,
  projectId: string,
  sprintKey: string,
  movingIds: string[] = [],
  insertOrder?: number
) {
  const filter =
    sprintKey === ''
      ? {
          workspaceId,
          projectId,
          parentTaskId: { $exists: false },
          $or: [{ sprintId: { $exists: false } }, { sprintId: null }, { sprintId: '' }],
        }
      : {
          workspaceId,
          projectId,
          parentTaskId: { $exists: false },
          sprintId: sprintKey,
        };

  const siblings = await Task.find(filter).sort({ order: 1, createdAt: 1 });
  const movingSet = new Set(movingIds);
  const others = siblings.filter((task) => !movingSet.has(task.id));
  const moved = movingIds
    .map((id) => siblings.find((task) => task.id === id))
    .filter((task): task is (typeof siblings)[number] => Boolean(task));

  const insertAt =
    typeof insertOrder === 'number'
      ? Math.max(0, Math.min(insertOrder, others.length))
      : others.length;

  const ordered =
    moved.length > 0
      ? [...others.slice(0, insertAt), ...moved, ...others.slice(insertAt)]
      : others;

  await Promise.all(
    ordered.map((task, index) => {
      if (task.order === index) return Promise.resolve();
      task.order = index;
      return task.save();
    })
  );
}
