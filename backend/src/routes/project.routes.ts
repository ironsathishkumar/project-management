import { Router } from 'express';
import { projectController } from '../controllers/project.controller';
import { taskController } from '../controllers/task.controller';
import { authenticate } from '../middlewares/authenticate';
import { loadWorkspaceContext, requirePermission, requireWorkspaceAdmin } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import {
  addProjectMemberSchema,
  completeSprintSchema,
  createMilestoneSchema,
  createProjectRoleSchema,
  createProjectSchema,
  createSprintSchema,
  moveTasksToSprintSchema,
  updateProjectMemberSchema,
  updateProjectRoleSchema,
  updateProjectSchema,
  updateSprintSchema,
} from '../validators/schemas';
import { PERMISSIONS } from '../config/constants';
import { sprintController } from '../controllers/sprint.controller';

export const projectRouter = Router();

projectRouter.use(authenticate, loadWorkspaceContext);

projectRouter.get('/', requirePermission(PERMISSIONS.PROJECT_VIEW), projectController.list);
projectRouter.post('/', requireWorkspaceAdmin, requirePermission(PERMISSIONS.PROJECT_CREATE), validate(createProjectSchema), projectController.create);
projectRouter.get('/:projectId', requirePermission(PERMISSIONS.PROJECT_VIEW), projectController.get);
projectRouter.patch(
  '/:projectId',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.PROJECT_UPDATE),
  validate(updateProjectSchema),
  projectController.update
);
projectRouter.post(
  '/:projectId/archive',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.PROJECT_ARCHIVE),
  projectController.archive
);
projectRouter.get('/:projectId/members', requirePermission(PERMISSIONS.PROJECT_VIEW), projectController.members);
projectRouter.post(
  '/:projectId/members',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.PROJECT_UPDATE),
  validate(addProjectMemberSchema),
  projectController.addMember
);
projectRouter.patch(
  '/:projectId/members/:memberId',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.PROJECT_UPDATE),
  validate(updateProjectMemberSchema),
  projectController.updateMember
);
projectRouter.delete(
  '/:projectId/members/:memberId',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.PROJECT_UPDATE),
  projectController.removeMember
);

projectRouter.get('/:projectId/roles', requirePermission(PERMISSIONS.PROJECT_VIEW), projectController.listRoles);
projectRouter.post(
  '/:projectId/roles',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.PROJECT_UPDATE),
  validate(createProjectRoleSchema),
  projectController.createRole
);
projectRouter.patch(
  '/:projectId/roles/:roleId',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.PROJECT_UPDATE),
  validate(updateProjectRoleSchema),
  projectController.updateRole
);
projectRouter.delete(
  '/:projectId/roles/:roleId',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.PROJECT_UPDATE),
  projectController.removeRole
);

projectRouter.get('/:projectId/milestones', requirePermission(PERMISSIONS.PROJECT_VIEW), taskController.milestones);
projectRouter.post(
  '/:projectId/milestones',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.PROJECT_UPDATE),
  validate(createMilestoneSchema),
  taskController.createMilestone
);

projectRouter.get('/:projectId/sprints', requirePermission(PERMISSIONS.PROJECT_VIEW), sprintController.list);
projectRouter.get('/:projectId/sprints/active', requirePermission(PERMISSIONS.PROJECT_VIEW), sprintController.active);
projectRouter.post(
  '/:projectId/sprints',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.PROJECT_UPDATE),
  validate(createSprintSchema),
  sprintController.create
);
projectRouter.post(
  '/:projectId/sprints/move-tasks',
  requirePermission(PERMISSIONS.TASK_UPDATE),
  validate(moveTasksToSprintSchema),
  sprintController.moveTasks
);
projectRouter.get('/:projectId/sprints/:sprintId', requirePermission(PERMISSIONS.PROJECT_VIEW), sprintController.get);
projectRouter.patch(
  '/:projectId/sprints/:sprintId',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.PROJECT_UPDATE),
  validate(updateSprintSchema),
  sprintController.update
);
projectRouter.post(
  '/:projectId/sprints/:sprintId/start',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.PROJECT_UPDATE),
  sprintController.start
);
projectRouter.post(
  '/:projectId/sprints/:sprintId/complete',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.PROJECT_UPDATE),
  validate(completeSprintSchema),
  sprintController.complete
);
projectRouter.delete(
  '/:projectId/sprints/:sprintId',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.PROJECT_UPDATE),
  sprintController.remove
);
