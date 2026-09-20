import argon2 from 'argon2';
import { ROLE_KEYS } from '../config/constants';
import { Category, Status, User, Workspace } from '../models';
import { logger } from '../config/logger';
import { connectDatabase, disconnectDatabase } from '../config/db';
import { ensureSystemRoles } from '../services/role.service';
import { workspaceService } from '../services/workspace.service';
import { projectService } from '../services/project.service';

export async function seedDemoData(): Promise<void> {
  await ensureSystemRoles();
  const existing = await User.findOne({ email: 'owner@tracker.local' });
  if (existing) {
    logger.info('Demo data already present');
    return;
  }

  const passwordHash = await argon2.hash('ChangeMe123!');
  const owner = await User.create({
    firstName: 'Sathish',
    lastName: 'Kumar',
    email: 'owner@tracker.local',
    passwordHash,
  });
  const member = await User.create({
    firstName: 'Asha',
    lastName: 'Rao',
    email: 'member@tracker.local',
    passwordHash,
  });
  const viewer = await User.create({
    firstName: 'Dev',
    lastName: 'Patel',
    email: 'viewer@tracker.local',
    passwordHash,
  });

  const workspace = await workspaceService.create(owner.id, {
    name: 'Northstar Labs',
    description: 'Product delivery workspace',
  });

  await workspaceService.inviteMember(workspace.id, owner.id, {
    email: member.email,
    roleKey: ROLE_KEYS.MEMBER,
  });
  await workspaceService.inviteMember(workspace.id, owner.id, {
    email: viewer.email,
    roleKey: ROLE_KEYS.VIEWER,
  });

  const project = await projectService.create(workspace.id, owner.id, {
    name: 'Project Tracker',
    key: 'PTR',
    description: 'Internal project management and implementation tracker',
  });

  await projectService.addMember(workspace.id, project.id, owner.id, member.id, 'FULL_STACK');
  await projectService.addMember(workspace.id, project.id, owner.id, viewer.id, 'VIEWER');

  const { projectRoleService } = await import('../services/projectRole.service');
  await projectRoleService.seedDefaults(workspace.id, project.id);

  const statuses = await Status.find({ workflowId: project.workflowId }).sort({ order: 1 });
  const categories = await Category.find({ workspaceId: workspace.id }).sort({ order: 1 });
  const feature = categories.find((item) => item.key === 'FEATURE') ?? categories[0];
  const bug = categories.find((item) => item.key === 'BUG') ?? categories[1];

  const todo = statuses.find((item) => item.key === 'TO_DO') ?? statuses[0];
  const inProgress = statuses.find((item) => item.key === 'IN_PROGRESS') ?? statuses[1];
  const review = statuses.find((item) => item.key === 'REVIEW') ?? statuses[2];
  const done = statuses.find((item) => item.isFinal && item.category === 'COMPLETED') ?? statuses[statuses.length - 2];

  const samples = [
    {
      title: 'Design workspace navigation',
      statusId: done.id,
      categoryId: feature.id,
      assigneeId: owner.id,
      priority: 'HIGH' as const,
      storyPoints: 3,
      inSprint: true,
    },
    {
      title: 'Implement JWT authentication',
      statusId: review.id,
      categoryId: feature.id,
      assigneeId: member.id,
      priority: 'URGENT' as const,
      storyPoints: 5,
      inSprint: true,
    },
    {
      title: 'Build Kanban board',
      statusId: inProgress.id,
      categoryId: feature.id,
      assigneeId: owner.id,
      priority: 'HIGH' as const,
      storyPoints: 8,
      inSprint: true,
    },
    {
      title: 'Fix filter combinator grouping',
      statusId: todo.id,
      categoryId: bug.id,
      assigneeId: member.id,
      priority: 'MEDIUM' as const,
      storyPoints: 3,
      inSprint: false,
    },
    {
      title: 'Create progress reports',
      statusId: todo.id,
      categoryId: feature.id,
      assigneeId: owner.id,
      priority: 'LOW' as const,
      storyPoints: 5,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4),
      inSprint: false,
    },
    {
      title: 'Add sprint burndown chart',
      statusId: todo.id,
      categoryId: feature.id,
      assigneeId: member.id,
      priority: 'MEDIUM' as const,
      storyPoints: 8,
      inSprint: false,
    },
  ];

  const { sprintService } = await import('../services/sprint.service');
  const activeSprint = (await sprintService.create(workspace.id, project.id, owner.id, {
    name: 'Sprint 1',
    goal: 'Ship core board, auth, and task flows',
    startDate: new Date(),
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
  })) as unknown as { id: string };
  await sprintService.start(workspace.id, project.id, activeSprint.id, owner.id);

  await sprintService.create(workspace.id, project.id, owner.id, {
    name: 'Sprint 2',
    goal: 'Reports and polish',
    startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 28),
  });

  const { taskService } = await import('../services/task.service');
  const createdIds: string[] = [];
  for (const sample of samples) {
    const { inSprint, ...payload } = sample;
    const task = (await taskService.create(workspace.id, owner.id, {
      projectId: project.id,
      ...payload,
      sprintId: inSprint ? activeSprint.id : null,
    })) as unknown as { id: string };
    createdIds.push(task.id);
  }

  logger.info('Seeded demo workspace Northstar Labs with Sprint 1 active');
  logger.info('Demo login: owner@tracker.local / ChangeMe123!');
}

export async function seedIfEmpty(): Promise<void> {
  const count = await Workspace.countDocuments();
  if (count === 0) {
    await seedDemoData();
  } else {
    await ensureSystemRoles();
  }
}

if (require.main === module) {
  connectDatabase()
    .then(seedDemoData)
    .then(() => disconnectDatabase())
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Seed failed', { error });
      process.exit(1);
    });
}
