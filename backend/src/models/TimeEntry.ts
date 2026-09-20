import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

const timeEntrySchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    taskId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    minutes: { type: Number, required: true, min: 1 },
    workDate: { type: Date, required: true, index: true },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

withPublicId(timeEntrySchema);
timeEntrySchema.index({ taskId: 1, workDate: -1 });
timeEntrySchema.index({ projectId: 1, userId: 1, workDate: -1 });

export type TimeEntryDocument = InferSchemaType<typeof timeEntrySchema> & { id: string };
export const TimeEntry = model('TimeEntry', timeEntrySchema);
