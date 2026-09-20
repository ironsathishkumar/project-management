import argon2 from 'argon2';
import { User } from '../models';
import { ApiError } from '../utils/ApiError';
import { entityId } from '../utils/ids';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens';

function publicUser(user: { id: string; firstName: string; lastName: string; email: string; profileImage?: string | null }) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    profileImage: user.profileImage ?? undefined,
  };
}

function withTokens(user: { id?: string; firstName: string; lastName: string; email: string; profileImage?: string | null; toJSON?: () => Record<string, unknown> }) {
  const json = user.toJSON ? user.toJSON() : user;
  const id = entityId({ id: (json.id as string | undefined) ?? user.id });
  return {
    user: publicUser({
      id,
      firstName: String(json.firstName ?? user.firstName),
      lastName: String(json.lastName ?? user.lastName),
      email: String(json.email ?? user.email),
      profileImage: (json.profileImage as string | null | undefined) ?? user.profileImage,
    }),
    accessToken: signAccessToken(id),
    refreshToken: signRefreshToken(id),
  };
}

export const authService = {
  async register(input: { firstName: string; lastName: string; email: string; password: string }) {
    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) {
      throw ApiError.conflict('EMAIL_IN_USE', 'An account with this email already exists');
    }

    const passwordHash = await argon2.hash(input.password);
    const user = await User.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      passwordHash,
    });

    return withTokens(user);
  },

  async login(input: { email: string; password: string }) {
    const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    return withTokens(user);
  },

  async refresh(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      if (payload.type !== 'refresh') {
        throw ApiError.unauthorized('Invalid token type');
      }
      const user = await User.findOne({ id: payload.sub, isActive: true });
      if (!user) {
        throw ApiError.unauthorized('User not found');
      }
      return {
        accessToken: signAccessToken(user.id),
        refreshToken: signRefreshToken(user.id),
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }
  },
};
