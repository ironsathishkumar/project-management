import dotenv from 'dotenv';
import path from 'path';

const envFile =
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';

dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function positiveNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
}

function sameSite(value: string | undefined): 'strict' | 'lax' | 'none' {
  const normalized = (value ?? 'strict').toLowerCase();
  if (normalized !== 'strict' && normalized !== 'lax' && normalized !== 'none') {
    throw new Error('REFRESH_COOKIE_SAMESITE must be strict, lax or none');
  }
  return normalized;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGO_URI'),
  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  accessTokenTtlMinutes: positiveNumber('ACCESS_TOKEN_TTL_MINUTES', 120),
  refreshTokenTtlDays: positiveNumber('REFRESH_TOKEN_TTL_DAYS', 60),
  refreshCookieSameSite: sameSite(process.env.REFRESH_COOKIE_SAMESITE),
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : (process.env.NODE_ENV ?? 'development') === 'production',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  appUrl: process.env.APP_URL ?? process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  apiPublicUrl: process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,
  encryptionKey: process.env.ENCRYPTION_KEY ?? required('JWT_ACCESS_SECRET'),
  githubPollMinutes: Number(process.env.GITHUB_POLL_MINUTES ?? 5),
  storageProvider: process.env.STORAGE_PROVIDER ?? 'local',
  storageLocalDir: process.env.STORAGE_LOCAL_DIR ?? 'uploads',
  isDev: (process.env.NODE_ENV ?? 'development') !== 'production',
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? 'Project Tracker <noreply@project-tracker.local>',
};
