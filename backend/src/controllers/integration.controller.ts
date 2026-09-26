import { Request, Response } from 'express';
import { appSyncService } from '../services/appSync.service';
import { githubService, processCommits } from '../services/github.service';
import { integrationService } from '../services/integration.service';
import { Integration } from '../models';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';

export const integrationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    sendSuccess(res, await integrationService.list(req.workspaceContext!.workspaceId, projectId));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const result = await integrationService.create(req.workspaceContext!.workspaceId, req.authUser!.id, req.body);
    sendSuccess(res, result, 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await integrationService.update(req.workspaceContext!.workspaceId, req.params.integrationId, req.body));
  }),

  rotate: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await integrationService.rotate(req.workspaceContext!.workspaceId, req.params.integrationId));
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await integrationService.remove(req.workspaceContext!.workspaceId, req.params.integrationId));
  }),

  activity: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await integrationService.activity(req.workspaceContext!.workspaceId, req.params.integrationId));
  }),

  configureGithub: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(
      res,
      await githubService.configure(req.workspaceContext!.workspaceId, req.params.integrationId, req.body)
    );
  }),

  disconnectGithub: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await githubService.disconnect(req.workspaceContext!.workspaceId, req.params.integrationId));
  }),

  githubSecret: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(
      res,
      await githubService.regenerateWebhookSecret(req.workspaceContext!.workspaceId, req.params.integrationId)
    );
  }),

  testGithub: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await githubService.test(req.workspaceContext!.workspaceId, req.params.integrationId));
  }),

  syncGithub: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(
      res,
      await githubService.syncNow(req.workspaceContext!.workspaceId, req.params.integrationId, req.body?.sinceDays)
    );
  }),
};

export const webhookController = {
  github: asyncHandler(async (req: Request, res: Response) => {
    const result = await githubService.handleWebhook(req.params.integrationId, {
      event: req.header('x-github-event') ?? undefined,
      signature: req.header('x-hub-signature-256') ?? undefined,
      rawBody: req.rawBody,
      payload: req.body ?? {},
    });
    sendSuccess(res, result);
  }),
};

export const appController = {
  me: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await appSyncService.me(req.appContext!));
  }),

  listTasks: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as Record<string, string | undefined>;
    sendSuccess(
      res,
      await appSyncService.listTasks(req.appContext!, {
        status: query.status,
        updatedSince: query.updatedSince,
        source: query.source,
      })
    );
  }),

  getTask: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await appSyncService.getTask(req.appContext!, req.params.ref));
  }),

  upsertTask: asyncHandler(async (req: Request, res: Response) => {
    const result = await appSyncService.upsert(req.appContext!, req.body);
    sendSuccess(res, result, result.action === 'created' ? 201 : 200);
  }),

  bulkUpsert: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await appSyncService.bulkUpsert(req.appContext!, req.body.tasks));
  }),

  updateTask: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await appSyncService.update(req.appContext!, req.params.ref, req.body));
  }),

  comment: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await appSyncService.comment(req.appContext!, req.params.ref, req.body.content), 201);
  }),

  commits: asyncHandler(async (req: Request, res: Response) => {
    const ctx = req.appContext!;
    const integration = await Integration.findOne({ id: ctx.integrationId }).select('github.branch');
    const branch = integration?.github?.branch || undefined;
    const commits = (req.body.commits as Array<Record<string, string>>).map((commit) => ({
      sha: commit.sha,
      message: commit.message,
      url: commit.url,
      author: commit.author,
      branch: commit.branch ?? req.body.branch,
    }));
    sendSuccess(res, await processCommits(ctx, commits, { branch }));
  }),

  importDocument: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw ApiError.badRequest('FILE_REQUIRED', 'Attach the document as multipart field "file"');
    }
    const dryRun = req.query.dryRun === 'true' || req.body?.dryRun === 'true';
    sendSuccess(
      res,
      await appSyncService.importDocument(
        req.appContext!,
        { buffer: req.file.buffer, originalname: req.file.originalname },
        dryRun
      )
    );
  }),
};
