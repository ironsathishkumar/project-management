import { NextFunction, Request, Response } from 'express';
import { User } from '../models';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken } from '../utils/tokens';

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.accessToken;

    if (!token) {
      throw ApiError.unauthorized();
    }

    const payload = verifyAccessToken(token);
    if (payload.type !== 'access') {
      throw ApiError.unauthorized('Invalid token type');
    }

    const user = await User.findOne({ id: payload.sub, isActive: true });
    if (!user) {
      throw ApiError.unauthorized('User not found or inactive');
    }

    req.authUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
      return;
    }
    next(ApiError.unauthorized('Invalid or expired token'));
  }
}
