import { Router } from 'express';
import {
  activityController,
  customFieldController,
  navigationController,
  notificationController,
  reportController,
  roleController,
  searchController,
  tagController,
  viewController,
} from '../controllers/misc.controller';
import { authenticate } from '../middlewares/authenticate';
import { loadWorkspaceContext, requirePermission, requireWorkspaceAdmin } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import { createCustomFieldSchema, createTagSchema, createViewSchema } from '../validators/schemas';
import { PERMISSIONS } from '../config/constants';

export const miscRouter = Router();

miscRouter.get(
  '/navigation',
  authenticate,
  loadWorkspaceContext,
  requirePermission(PERMISSIONS.WORKSPACE_VIEW),
  navigationController.menus
);
miscRouter.get(
  '/roles',
  authenticate,
  loadWorkspaceContext,
  requireWorkspaceAdmin,
  roleController.list
);
miscRouter.get('/notifications', authenticate, notificationController.list);
miscRouter.post('/notifications/read-all', authenticate, notificationController.markAllRead);
miscRouter.post('/notifications/:notificationId/read', authenticate, notificationController.markRead);

miscRouter.get(
  '/search',
  authenticate,
  loadWorkspaceContext,
  requirePermission(PERMISSIONS.PROJECT_VIEW),
  searchController.search
);
miscRouter.get(
  '/reports/summary',
  authenticate,
  loadWorkspaceContext,
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.REPORT_VIEW),
  reportController.summary
);
miscRouter.get(
  '/activities',
  authenticate,
  loadWorkspaceContext,
  requirePermission(PERMISSIONS.PROJECT_VIEW),
  activityController.list
);

miscRouter.get(
  '/views',
  authenticate,
  loadWorkspaceContext,
  requirePermission(PERMISSIONS.PROJECT_VIEW),
  viewController.list
);
miscRouter.post(
  '/views',
  authenticate,
  loadWorkspaceContext,
  requirePermission(PERMISSIONS.TASK_UPDATE),
  validate(createViewSchema),
  viewController.create
);
miscRouter.delete(
  '/views/:viewId',
  authenticate,
  loadWorkspaceContext,
  requirePermission(PERMISSIONS.TASK_UPDATE),
  viewController.remove
);

miscRouter.get(
  '/tags',
  authenticate,
  loadWorkspaceContext,
  requirePermission(PERMISSIONS.PROJECT_VIEW),
  tagController.list
);
miscRouter.post(
  '/tags',
  authenticate,
  loadWorkspaceContext,
  requireWorkspaceAdmin,
  validate(createTagSchema),
  tagController.create
);

miscRouter.get(
  '/custom-fields',
  authenticate,
  loadWorkspaceContext,
  requirePermission(PERMISSIONS.PROJECT_VIEW),
  customFieldController.list
);
miscRouter.post(
  '/custom-fields',
  authenticate,
  loadWorkspaceContext,
  requireWorkspaceAdmin,
  validate(createCustomFieldSchema),
  customFieldController.create
);
