import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { Session } from '../models';
import { ApiError } from '../utils/ApiError';
import { signAccessToken } from '../utils/tokens';

/** A second request carrying the just-rotated token inside this window is treated as a race, not theft. */
const ROTATION_GRACE_MS = 30 * 1000;
const KEPT_PREVIOUS_HASHES = 10;
const MAX_ACTIVE_SESSIONS = 20;

export interface ClientInfo {
  userAgent?: string;
  ip?: string;
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function newRefreshToken(sessionId: string) {
  const token = `${sessionId}.${crypto.randomBytes(32).toString('base64url')}`;
  return { token, hash: hashToken(token) };
}

function parseRefreshToken(token: string) {
  const separator = token.indexOf('.');
  if (separator <= 0 || token.length > 200) return null;
  return { sessionId: token.slice(0, separator) };
}

function sessionError(code: string, message: string) {
  return new ApiError(401, code, message);
}

function issue(userId: string, sessionId: string, refreshToken: string, refreshTokenExpiresAt: Date) {
  const access = signAccessToken(userId, sessionId);
  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken,
    refreshTokenExpiresAt,
  };
}

export type IssuedTokens = ReturnType<typeof issue>;

export const sessionService = {
  async create(userId: string, client: ClientInfo): Promise<IssuedTokens> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
    const session = new Session({
      userId,
      tokenHash: 'pending',
      expiresAt,
      lastUsedAt: now,
      userAgent: (client.userAgent ?? '').slice(0, 300),
      ip: client.ip ?? '',
    });
    const refresh = newRefreshToken(session.get('id') as string);
    session.set('tokenHash', refresh.hash);
    await session.save();
    await this.pruneOldest(userId);
    return issue(userId, session.get('id') as string, refresh.token, expiresAt);
  },

  /**
   * Exchanges a refresh token for a new access token and a new refresh token.
   * The session keeps its original expiry, so a login never lasts longer than REFRESH_TOKEN_TTL_DAYS.
   */
  async rotate(refreshToken: string, client: ClientInfo): Promise<IssuedTokens & { userId: string }> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) throw sessionError('INVALID_REFRESH_TOKEN', 'Invalid refresh token');

    const presentedHash = hashToken(refreshToken);
    const now = new Date();
    const next = newRefreshToken(parsed.sessionId);
    const updated = await Session.findOneAndUpdate(
      { id: parsed.sessionId, tokenHash: presentedHash, revokedAt: null, expiresAt: { $gt: now } },
      {
        $set: {
          tokenHash: next.hash,
          rotatedAt: now,
          lastUsedAt: now,
          ...(client.userAgent ? { userAgent: client.userAgent.slice(0, 300) } : {}),
          ...(client.ip ? { ip: client.ip } : {}),
        },
        $push: { previousTokenHashes: { $each: [presentedHash], $slice: -KEPT_PREVIOUS_HASHES } },
      },
      { new: true }
    );
    if (updated) {
      return { userId: updated.userId, ...issue(updated.userId, updated.get('id') as string, next.token, updated.expiresAt) };
    }

    const session = await Session.findOne({ id: parsed.sessionId });
    if (!session) throw sessionError('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
    if (session.revokedAt) throw sessionError('SESSION_REVOKED', 'This session was signed out');
    if (session.expiresAt <= now) throw sessionError('SESSION_EXPIRED', 'Session expired, please sign in again');

    const previous = session.previousTokenHashes ?? [];
    if (previous.includes(presentedHash)) {
      const justRotated =
        previous[previous.length - 1] === presentedHash &&
        session.rotatedAt &&
        now.getTime() - session.rotatedAt.getTime() < ROTATION_GRACE_MS;
      if (justRotated) {
        throw sessionError('REFRESH_TOKEN_ROTATED', 'Refresh token was just rotated by another request');
      }
      await this.revoke(session.get('id') as string, 'REFRESH_TOKEN_REUSED');
      logger.warn('Refresh token reuse detected, session revoked', { sessionId: session.get('id'), userId: session.userId });
      throw sessionError('SESSION_REVOKED', 'This session was signed out for your security. Please sign in again');
    }
    throw sessionError('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  },

  /** Used on every authenticated request so that sign-out takes effect before the access token expires. */
  async assertActive(sessionId: string, userId: string) {
    const active = await Session.exists({
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (!active) throw sessionError('SESSION_REVOKED', 'Session is no longer active, please sign in again');
  },

  /** Signs out the session a refresh token belongs to, if the token is genuine (current or recently rotated). */
  async revokeByToken(refreshToken: string) {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) return;
    const hash = hashToken(refreshToken);
    await Session.updateOne(
      { id: parsed.sessionId, revokedAt: null, $or: [{ tokenHash: hash }, { previousTokenHashes: hash }] },
      { $set: { revokedAt: new Date(), revokedReason: 'LOGOUT' } }
    );
  },

  async revoke(sessionId: string, reason: string, userId?: string) {
    const result = await Session.updateOne(
      { id: sessionId, revokedAt: null, ...(userId ? { userId } : {}) },
      { $set: { revokedAt: new Date(), revokedReason: reason } }
    );
    return result.modifiedCount > 0;
  },

  async revokeAllForUser(userId: string, reason: string, exceptSessionId?: string) {
    const result = await Session.updateMany(
      { userId, revokedAt: null, ...(exceptSessionId ? { id: { $ne: exceptSessionId } } : {}) },
      { $set: { revokedAt: new Date(), revokedReason: reason } }
    );
    return result.modifiedCount;
  },

  async listActive(userId: string, currentSessionId?: string) {
    const sessions = await Session.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } }).sort({
      lastUsedAt: -1,
    });
    return sessions.map((session) => ({
      id: session.get('id') as string,
      userAgent: session.userAgent,
      ip: session.ip,
      createdAt: (session as unknown as { createdAt: Date }).createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      current: session.get('id') === currentSessionId,
    }));
  },

  async pruneOldest(userId: string) {
    const active = await Session.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
      .sort({ lastUsedAt: -1 })
      .select('id');
    const excess = active.slice(MAX_ACTIVE_SESSIONS).map((session) => session.get('id') as string);
    if (excess.length) {
      await Session.updateMany({ id: { $in: excess } }, { $set: { revokedAt: new Date(), revokedReason: 'SESSION_LIMIT' } });
    }
  },
};
