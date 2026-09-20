import { Router } from 'express';
import multer from 'multer';
import { taskController } from '../controllers/task.controller';
import { authenticate } from '../middlewares/authenticate';
import { loadWorkspaceContext, requirePermission } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import {
  createCommentSchema,
  createDependencySchema,
  createTaskSchema,
  createTimeEntrySchema,
  moveTaskSchema,
  updateTaskSchema,
} from '../validators/schemas';
import { PERMISSIONS } from '../config/constants';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const taskRouter = Router();
taskRouter.use(authenticate, loadWorkspaceContext);
taskRouter.get('/', requirePermission(PERMISSIONS.TASK_VIEW), taskController.list);
taskRouter.post('/', requirePermission(PERMISSIONS.TASK_CREATE), validate(createTaskSchema), taskController.create);
taskRouter.get('/:taskId', requirePermission(PERMISSIONS.TASK_VIEW), taskController.get);
taskRouter.patch(
  '/:taskId',
  requirePermission(PERMISSIONS.TASK_UPDATE),
  validate(updateTaskSchema),
  taskController.update
);
taskRouter.post(
  '/:taskId/move',
  requirePermission(PERMISSIONS.TASK_MOVE),
  validate(moveTaskSchema),
  taskController.move
);
taskRouter.delete('/:taskId', requirePermission(PERMISSIONS.TASK_DELETE), taskController.remove);
taskRouter.post(
  '/:taskId/comments',
  requirePermission(PERMISSIONS.TASK_COMMENT),
  validate(createCommentSchema),
  taskController.comment
);
taskRouter.post(
  '/:taskId/dependencies',
  requirePermission(PERMISSIONS.TASK_UPDATE),
  validate(createDependencySchema),
  taskController.addDependency
);
taskRouter.post(
  '/:taskId/attachments',
  requirePermission(PERMISSIONS.TASK_UPDATE),
  upload.single('file'),
  taskController.upload
);
taskRouter.get('/:taskId/time-entries', requirePermission(PERMISSIONS.TASK_VIEW), taskController.listTimeEntries);
taskRouter.post(
  '/:taskId/time-entries',
  requirePermission(PERMISSIONS.TASK_UPDATE),
  validate(createTimeEntrySchema),
  taskController.createTimeEntry
);
taskRouter.delete(
  '/:taskId/time-entries/:entryId',
  requirePermission(PERMISSIONS.TASK_UPDATE),
  taskController.removeTimeEntry
);
