import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

const integrationSchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    keyPrefix: { type: String, required: true },
    keyHash: { type: String, required: true, unique: true },
    status: { type: String, enum: ['ACTIVE', 'REVOKED'], default: 'ACTIVE' },
    createdBy: { type: String, required: true },
    lastUsedAt: { type: Date },
    requestCount: { type: Number, default: 0 },
    github: {
      type: new Schema(
        {
          repo: { type: String, required: true, trim: true },
          branch: { type: String, default: '' },
          docsPath: { type: String, default: '' },
          tokenEnc: { type: String },
          webhookSecretEnc: { type: String },
          autoSync: { type: Boolean, default: true },
          lastSyncedAt: { type: Date },
          lastDocSha: { type: String },
          lastEventAt: { type: Date },
          lastEventStatus: { type: String, enum: ['OK', 'ERROR'] },
          lastEventMessage: { type: String, default: '' },
        },
        { _id: false }
      ),
      default: undefined,
    },
  },
  { timestamps: true }
);

withPublicId(integrationSchema);
integrationSchema.index({ workspaceId: 1, projectId: 1 });

export type IntegrationDocument = InferSchemaType<typeof integrationSchema> & { id: string };
export const Integration = model('Integration', integrationSchema);
