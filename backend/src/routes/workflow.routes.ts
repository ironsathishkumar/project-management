import { Router } from 'express';
import { categoryController, workflowController } from '../controllers/workflow.controller';
import { authenticate } from '../middlewares/authenticate';
import { loadWorkspaceContext, requirePermission, requireWorkspaceAdmin } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import {
  createCategorySchema,
  createStatusSchema,
  createWorkflowSchema,
  reorderStatusesSchema,
  updateCategorySchema,
  updateStatusSchema,
} from '../validators/schemas';
import { PERMISSIONS } from '../config/constants';

export const workflowRouter = Router();
workflowRouter.use(authenticate, loadWorkspaceContext);
workflowRouter.get('/', requirePermission(PERMISSIONS.WORKFLOW_VIEW), workflowController.list);
workflowRouter.post(
  '/',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.WORKFLOW_CREATE),
  validate(createWorkflowSchema),
  workflowController.create
);
workflowRouter.get('/:workflowId', requirePermission(PERMISSIONS.WORKFLOW_VIEW), workflowController.get);
workflowRouter.patch(
  '/:workflowId',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.WORKFLOW_UPDATE),
  workflowController.update
);
workflowRouter.delete(
  '/:workflowId',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.WORKFLOW_DELETE),
  workflowController.remove
);
workflowRouter.post(
  '/:workflowId/statuses',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.WORKFLOW_UPDATE),
  validate(createStatusSchema),
  workflowController.addStatus
);
workflowRouter.post(
  '/:workflowId/statuses/reorder',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.WORKFLOW_UPDATE),
  validate(reorderStatusesSchema),
  workflowController.reorder
);

export const statusRouter = Router();
statusRouter.use(authenticate, loadWorkspaceContext);
statusRouter.patch(
  '/:statusId',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.WORKFLOW_UPDATE),
  validate(updateStatusSchema),
  workflowController.updateStatus
);
statusRouter.delete(
  '/:statusId',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.WORKFLOW_DELETE),
  workflowController.removeStatus
);

export const categoryRouter = Router();
categoryRouter.use(authenticate, loadWorkspaceContext);
categoryRouter.get('/', requirePermission(PERMISSIONS.CATEGORY_VIEW), categoryController.list);
categoryRouter.post(
  '/',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.CATEGORY_CREATE),
  validate(createCategorySchema),
  categoryController.create
);
categoryRouter.patch(
  '/:categoryId',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.CATEGORY_UPDATE),
  validate(updateCategorySchema),
  categoryController.update
);
categoryRouter.delete(
  '/:categoryId',
  requireWorkspaceAdmin,
  requirePermission(PERMISSIONS.CATEGORY_DELETE),
  categoryController.remove
);
