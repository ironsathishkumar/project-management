import { Router } from 'express';
import { authRouter } from './auth.routes';
import { workspaceRouter } from './workspace.routes';
import { projectRouter } from './project.routes';
import { categoryRouter, statusRouter, workflowRouter } from './workflow.routes';
import { taskRouter } from './task.routes';
import { miscRouter } from './misc.routes';
import { importRouter } from './import.routes';
import { appRouter, integrationRouter } from './integration.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/workspaces', workspaceRouter);
apiRouter.use('/projects', projectRouter);
apiRouter.use('/workflows', workflowRouter);
apiRouter.use('/statuses', statusRouter);
apiRouter.use('/categories', categoryRouter);
apiRouter.use('/tasks', taskRouter);
apiRouter.use('/imports', importRouter);
apiRouter.use('/integrations', integrationRouter);
apiRouter.use('/app', appRouter);
apiRouter.use('/', miscRouter);
