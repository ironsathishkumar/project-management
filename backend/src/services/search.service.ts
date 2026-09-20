import { ROLE_KEYS } from '../config/constants';
import { Comment, Milestone, Project, ProjectMember, Task, User } from '../models';

export const searchService = {
  async search(
    workspaceId: string,
    query: string,
    access?: { userId: string; roleKey: string; assignedProjectIds?: string[] }
  ) {
    const regex = { $regex: query, $options: 'i' };
    const isAdmin = access?.roleKey === ROLE_KEYS.OWNER || access?.roleKey === ROLE_KEYS.ADMIN;
    const allowedProjectIds = access?.assignedProjectIds ?? [];

    const projectScope = isAdmin
      ? { workspaceId }
      : { workspaceId, id: { $in: allowedProjectIds } };
    const byProject = isAdmin
      ? { workspaceId }
      : { workspaceId, projectId: { $in: allowedProjectIds } };

    const [projects, tasks, users, comments, milestones] = await Promise.all([
      Project.find({ ...projectScope, name: regex }).limit(8),
      Task.find({ ...byProject, title: regex }).limit(12),
      isAdmin
        ? User.find({ $or: [{ firstName: regex }, { lastName: regex }, { email: regex }] }).limit(8)
        : User.find({
            id: {
              $in: await ProjectMember.find({ projectId: { $in: allowedProjectIds } }).distinct('userId'),
            },
            $or: [{ firstName: regex }, { lastName: regex }, { email: regex }],
          }).limit(8),
      Comment.find({ ...byProject, content: regex, deletedAt: null }).limit(8),
      Milestone.find({ ...byProject, name: regex }).limit(8),
    ]);

    return {
      projects,
      tasks,
      users,
      comments,
      milestones,
    };
  },
};
