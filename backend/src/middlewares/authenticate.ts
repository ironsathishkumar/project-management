import { NextFunction, Request, Response } from 'express';
import { User } from '../models';
import { sessionService } from '../services/session.service';
import { ApiError } from '../utils/ApiError';
import { TokenExpiredError, verifyAccessToken } from '../utils/tokens';

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
      throw ApiError.unauthorized();
    }

    let payload: ReturnType<typeof verifyAccessToken>;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new ApiError(401, 'TOKEN_EXPIRED', 'Access token expired');
      }
      throw ApiError.unauthorized('Invalid access token');
    }

    const [user] = await Promise.all([
      User.findOne({ id: payload.sub, isActive: true }),
      sessionService.assertActive(payload.sid, payload.sub),
    ]);
    if (!user) {
      throw ApiError.unauthorized('User not found or inactive');
    }

    req.authUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      sessionId: payload.sid,
    };
    next();
  } catch (error) {
    next(error instanceof ApiError ? error : ApiError.unauthorized('Invalid or expired token'));
  }
}
