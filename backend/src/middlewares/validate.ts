import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(
        ApiError.badRequest('VALIDATION_ERROR', 'Request validation failed', result.error.flatten())
      );
      return;
    }
    req[part] = result.data as typeof req[typeof part];
    next();
  };
}
