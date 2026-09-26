import { Schema, model } from 'mongoose';
import { withPublicId } from './plugins';

const sessionSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true },
    previousTokenHashes: { type: [String], default: [] },
    rotatedAt: { type: Date },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date },
    revokedAt: { type: Date },
    revokedReason: { type: String },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: true }
);

withPublicId(sessionSchema);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = model('Session', sessionSchema);
