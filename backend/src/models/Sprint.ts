import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

export const SPRINT_STATUS = {
  PLANNED: 'PLANNED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
} as const;

const sprintSchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    goal: { type: String, default: '' },
    status: {
      type: String,
      enum: Object.values(SPRINT_STATUS),
      default: SPRINT_STATUS.PLANNED,
      index: true,
    },
    startDate: { type: Date },
    endDate: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

withPublicId(sprintSchema);
sprintSchema.index({ projectId: 1, status: 1 });
sprintSchema.index({ projectId: 1, order: 1 });

export type SprintDocument = InferSchemaType<typeof sprintSchema> & { id: string };
export const Sprint = model('Sprint', sprintSchema);
