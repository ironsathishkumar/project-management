import { NextFunction, Request, Response } from 'express';
import { integrationService } from '../services/integration.service';
import { ApiError } from '../utils/ApiError';

export function readApiKey(req: Request): string | undefined {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header) return header.trim();
  const auth = req.headers.authorization;
  return auth?.startsWith('Bearer ') ? auth.slice(7).trim() : undefined;
}

export async function authenticateApiKey(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const apiKey = readApiKey(req);
    if (!apiKey) {
      throw ApiError.unauthorized('API key required. Send it as "x-api-key" or "Authorization: Bearer <key>"');
    }
    req.appContext = await integrationService.authenticate(apiKey);
    next();
  } catch (error) {
    next(error);
  }
}
