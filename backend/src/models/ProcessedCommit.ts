import { Schema, model } from 'mongoose';

const processedCommitSchema = new Schema(
  {
    integrationId: { type: String, required: true },
    sha: { type: String, required: true },
    refs: { type: [String], default: [] },
  },
  { timestamps: true }
);

processedCommitSchema.index({ integrationId: 1, sha: 1 }, { unique: true });

export const ProcessedCommit = model('ProcessedCommit', processedCommitSchema);
