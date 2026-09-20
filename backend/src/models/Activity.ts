import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

const activitySchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    projectId: { type: String, index: true },
    taskId: { type: String, index: true },
    userId: { type: String, required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

withPublicId(activitySchema);
activitySchema.index({ workspaceId: 1, createdAt: -1 });
activitySchema.index({ projectId: 1, createdAt: -1 });
activitySchema.index({ taskId: 1, createdAt: -1 });


export type ActivityDocument = InferSchemaType<typeof activitySchema> & { id: string };
export const Activity = model('Activity', activitySchema);
