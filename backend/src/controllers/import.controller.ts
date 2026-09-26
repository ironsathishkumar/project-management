import { Request, Response } from 'express';
import { documentImportService, ImportTarget } from '../services/documentImport.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';

function readUpload(req: Request) {
  if (!req.file) {
    throw ApiError.badRequest('FILE_REQUIRED', 'Attach a document to import');
  }
  return { buffer: req.file.buffer, originalname: req.file.originalname };
}

function readTarget(req: Request): ImportTarget {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const text = (value: unknown, max: number) =>
    typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
  return {
    projectId: text(body.projectId, 64),
    projectName: text(body.projectName, 120),
    projectKey: text(body.projectKey, 10),
  };
}

export const importController = {
  previewDocument: asyncHandler(async (req: Request, res: Response) => {
    const result = await documentImportService.preview(req.workspaceContext!.workspaceId, readUpload(req), readTarget(req));
    sendSuccess(res, result);
  }),

  applyDocument: asyncHandler(async (req: Request, res: Response) => {
    const result = await documentImportService.apply(
      req.workspaceContext!.workspaceId,
      req.authUser!.id,
      readUpload(req),
      readTarget(req)
    );
    sendSuccess(res, result, 201);
  }),
};
