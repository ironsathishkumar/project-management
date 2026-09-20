import { Category, Project, Status, Task } from '../models';
import { startOfDay } from './date.helpers';

export const reportService = {
  async workspaceSummary(workspaceId: string) {
    const [projects, tasks, statuses, categories] = await Promise.all([
      Project.find({ workspaceId, status: { $ne: 'ARCHIVED' } }),
      Task.find({ workspaceId, parentTaskId: { $exists: false } }),
      Status.find({}),
      Category.find({ workspaceId, isActive: true }),
    ]);

    const statusMap = new Map(statuses.map((item) => [item.id, item]));
    const now = startOfDay(new Date());
    const completed = tasks.filter((task) => statusMap.get(task.statusId)?.category === 'COMPLETED');
    const overdue = tasks.filter(
      (task) => task.dueDate && task.dueDate < now && statusMap.get(task.statusId)?.category !== 'COMPLETED'
    );

    const statusDistribution = Array.from(
      tasks.reduce((acc, task) => {
        const status = statusMap.get(task.statusId);
        const key = status?.name ?? 'Unknown';
        acc.set(key, (acc.get(key) ?? 0) + 1);
        return acc;
      }, new Map<string, number>())
    ).map(([name, value]) => ({ name, value }));

    const categoryDistribution = categories.map((category) => ({
      name: category.name,
      value: tasks.filter((task) => task.categoryId === category.id).length,
      color: category.color,
    }));

    const workload = Array.from(
      tasks.reduce((acc, task) => {
        const key = task.assigneeId ?? 'unassigned';
        acc.set(key, (acc.get(key) ?? 0) + 1);
        return acc;
      }, new Map<string, number>())
    ).map(([assigneeId, count]) => ({ assigneeId, count }));

    const projectProgress = projects.map((project) => {
      const projectTasks = tasks.filter((task) => task.projectId === project.id);
      const done = projectTasks.filter((task) => statusMap.get(task.statusId)?.category === 'COMPLETED').length;
      return {
        projectId: project.id,
        name: project.name,
        total: projectTasks.length,
        completed: done,
        progress: projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0,
      };
    });

    return {
      totals: {
        projects: projects.length,
        tasks: tasks.length,
        completed: completed.length,
        overdue: overdue.length,
      },
      statusDistribution,
      categoryDistribution,
      workload,
      projectProgress,
      overdueTasks: overdue.slice(0, 20),
    };
  },
};
