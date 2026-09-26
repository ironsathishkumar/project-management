import { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';
import { authService } from '../services/auth.service';
import { ClientInfo, IssuedTokens, sessionService } from '../services/session.service';
import { User } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { WorkspaceMember, Role } from '../models';

export const REFRESH_COOKIE = 'pt_refresh';

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.cookieSecure || env.refreshCookieSameSite === 'none',
    sameSite: env.refreshCookieSameSite,
    path: '/api/v1/auth',
  };
}

function clientInfo(req: Request): ClientInfo {
  return { userAgent: req.get('user-agent') ?? '', ip: req.ip ?? '' };
}

/** The refresh token only ever travels in the httpOnly cookie, never in a response body readable by scripts. */
function sendSession(res: Response, tokens: IssuedTokens, extra: Record<string, unknown> = {}, status = 200) {
  const { refreshToken, ...rest } = tokens;
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions(),
    expires: tokens.refreshTokenExpiresAt,
  });
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, { ...extra, ...rest }, status);
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
}

function readRefreshCookie(req: Request): string | undefined {
  const value = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value ? value : undefined;
}

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const { user, ...tokens } = await authService.register(req.body, clientInfo(req));
    sendSession(res, tokens, { user }, 201);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const { user, ...tokens } = await authService.login(req.body, clientInfo(req));
    sendSession(res, tokens, { user });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = readRefreshCookie(req);
    if (!refreshToken) {
      throw new ApiError(401, 'NO_SESSION', 'Not signed in');
    }
    try {
      sendSession(res, await authService.refresh(refreshToken, clientInfo(req)));
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'REFRESH_TOKEN_ROTATED') {
        clearRefreshCookie(res);
      }
      throw error;
    }
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = readRefreshCookie(req);
    if (refreshToken) await sessionService.revokeByToken(refreshToken);
    clearRefreshCookie(res);
    sendSuccess(res, { signedOut: true });
  }),

  logoutAll: asyncHandler(async (req: Request, res: Response) => {
    const count = await sessionService.revokeAllForUser(req.authUser!.id, 'LOGOUT_ALL');
    clearRefreshCookie(res);
    sendSuccess(res, { signedOut: count });
  }),

  sessions: asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await sessionService.listActive(req.authUser!.id, req.authUser!.sessionId));
  }),

  revokeSession: asyncHandler(async (req: Request, res: Response) => {
    const revoked = await sessionService.revoke(req.params.sessionId, 'REVOKED_BY_USER', req.authUser!.id);
    if (!revoked) throw ApiError.notFound('SESSION_NOT_FOUND', 'Session not found');
    sendSuccess(res, { revoked: true });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findOne({ id: req.authUser!.id });
    if (!user) throw ApiError.notFound('USER_NOT_FOUND', 'User not found');
    const memberships = await WorkspaceMember.find({ userId: user.id, status: 'ACTIVE' });
    const roles = await Role.find({ id: { $in: memberships.map((item) => item.roleId) } });
    const roleMap = new Map(roles.map((role) => [role.id, role]));
    sendSuccess(res, {
      ...user.toJSON(),
      memberships: memberships.map((membership) => ({
        ...membership.toJSON(),
        role: roleMap.get(membership.roleId) ?? null,
      })),
    });
  }),

  updateMe: asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findOneAndUpdate({ id: req.authUser!.id }, req.body, { new: true });
    sendSuccess(res, user);
  }),
};
