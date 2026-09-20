import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

const milestoneSchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED'], default: 'PLANNED' },
    startDate: { type: Date },
    dueDate: { type: Date },
    completedAt: { type: Date },
    ownerId: { type: String },
  },
  { timestamps: true }
);

withPublicId(milestoneSchema);


export type MilestoneDocument = InferSchemaType<typeof milestoneSchema> & { id: string };
export const Milestone = model('Milestone', milestoneSchema);
