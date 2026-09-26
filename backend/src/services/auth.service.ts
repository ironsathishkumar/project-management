import argon2 from 'argon2';
import { User } from '../models';
import { ApiError } from '../utils/ApiError';
import { entityId } from '../utils/ids';
import { ClientInfo, sessionService } from './session.service';

/** Verified against when the email is unknown, so response time does not reveal which accounts exist. */
const DUMMY_PASSWORD_HASH = argon2.hash('not-a-real-password');

function publicUser(user: { id: string; firstName: string; lastName: string; email: string; profileImage?: string | null }) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    profileImage: user.profileImage ?? undefined,
  };
}

async function withSession(
  user: { id?: string; firstName: string; lastName: string; email: string; profileImage?: string | null; toJSON?: () => Record<string, unknown> },
  client: ClientInfo
) {
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
    ...(await sessionService.create(id, client)),
  };
}

export const authService = {
  async register(input: { firstName: string; lastName: string; email: string; password: string }, client: ClientInfo) {
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

    return withSession(user, client);
  },

  async login(input: { email: string; password: string }, client: ClientInfo) {
    const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
    const valid = await argon2.verify(user?.passwordHash ?? (await DUMMY_PASSWORD_HASH), input.password);
    if (!user || !valid || !user.isActive) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    return withSession(user, client);
  },

  async refresh(refreshToken: string, client: ClientInfo) {
    const tokens = await sessionService.rotate(refreshToken, client);
    const user = await User.exists({ id: tokens.userId, isActive: true });
    if (!user) {
      await sessionService.revokeAllForUser(tokens.userId, 'USER_INACTIVE');
      throw new ApiError(401, 'SESSION_REVOKED', 'Your account is no longer active');
    }
    const { userId: _userId, ...issued } = tokens;
    return issued;
  },
};
