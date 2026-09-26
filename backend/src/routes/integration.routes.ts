import crypto from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { appController, integrationController, webhookController } from '../controllers/integration.controller';
import { authenticate } from '../middlewares/authenticate';
import { authenticateApiKey, readApiKey } from '../middlewares/authenticateApiKey';
import { loadWorkspaceContext, requireWorkspaceAdmin } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import {
  appBulkUpsertSchema,
  appCommentSchema,
  appCommitsSchema,
  configureGithubSchema,
  githubSyncSchema,
  appUpdateTaskSchema,
  appUpsertTaskSchema,
  createIntegrationSchema,
  updateIntegrationSchema,
} from '../validators/schemas';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

export const integrationRouter = Router();
integrationRouter.use(authenticate, loadWorkspaceContext, requireWorkspaceAdmin);
integrationRouter.get('/', integrationController.list);
integrationRouter.post('/', validate(createIntegrationSchema), integrationController.create);
integrationRouter.patch('/:integrationId', validate(updateIntegrationSchema), integrationController.update);
integrationRouter.post('/:integrationId/rotate', integrationController.rotate);
integrationRouter.delete('/:integrationId', integrationController.remove);
integrationRouter.get('/:integrationId/activity', integrationController.activity);
integrationRouter.put('/:integrationId/github', validate(configureGithubSchema), integrationController.configureGithub);
integrationRouter.delete('/:integrationId/github', integrationController.disconnectGithub);
integrationRouter.post('/:integrationId/github/secret', integrationController.githubSecret);
integrationRouter.post('/:integrationId/github/test', integrationController.testGithub);
integrationRouter.post('/:integrationId/github/sync', validate(githubSyncSchema), integrationController.syncGithub);

export const webhookRouter = Router();
webhookRouter.post('/github/:integrationId', webhookController.github);

const perKeyLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const apiKey = readApiKey(req);
    return apiKey ? crypto.createHash('sha256').update(apiKey).digest('hex') : req.ip ?? 'anonymous';
  },
});

export const appRouter = Router();
appRouter.use(perKeyLimit, authenticateApiKey);
appRouter.get('/me', appController.me);
appRouter.get('/tasks', appController.listTasks);
appRouter.post('/tasks', validate(appUpsertTaskSchema), appController.upsertTask);
appRouter.post('/tasks/bulk', validate(appBulkUpsertSchema), appController.bulkUpsert);
appRouter.get('/tasks/:ref', appController.getTask);
appRouter.patch('/tasks/:ref', validate(appUpdateTaskSchema), appController.updateTask);
appRouter.post('/tasks/:ref/comments', validate(appCommentSchema), appController.comment);
appRouter.post('/document', upload.single('file'), appController.importDocument);
appRouter.post('/commits', validate(appCommitsSchema), appController.commits);
