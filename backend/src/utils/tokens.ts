import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  type: 'access';
}

const ISSUER = 'project-tracker';
const AUDIENCE = 'project-tracker-api';

export function signAccessToken(userId: string, sessionId: string) {
  const expiresAt = new Date(Date.now() + env.accessTokenTtlMinutes * 60 * 1000);
  const token = jwt.sign({ sub: userId, sid: sessionId, type: 'access' } satisfies AccessTokenPayload, env.jwtAccessSecret, {
    algorithm: 'HS256',
    expiresIn: Math.floor(env.accessTokenTtlMinutes * 60),
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  return { token, expiresAt };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.jwtAccessSecret, {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as Partial<AccessTokenPayload>;
  if (payload.type !== 'access' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
    throw new jwt.JsonWebTokenError('Invalid token payload');
  }
  return payload as AccessTokenPayload;
}

export { TokenExpiredError } from 'jsonwebtoken';
