import { Schema, model, InferSchemaType } from 'mongoose';
import { TASK_PRIORITIES } from '../config/constants';
import { withPublicId } from './plugins';

const taskSchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    parentTaskId: { type: String, index: true },
    milestoneId: { type: String, index: true },
    sprintId: { type: String, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    statusId: { type: String, required: true, index: true },
    categoryId: { type: String, required: true, index: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'MEDIUM' },
    assigneeId: { type: String, index: true },
    creatorId: { type: String, required: true },
    startDate: { type: Date },
    dueDate: { type: Date },
    completedAt: { type: Date },
    number: { type: Number, index: true },
    key: { type: String, index: true },
    storyPoints: { type: Number, default: null },
    order: { type: Number, default: 0 },
    customFields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

withPublicId(taskSchema);
taskSchema.index({ projectId: 1, statusId: 1 });
taskSchema.index({ projectId: 1, categoryId: 1 });
taskSchema.index({ projectId: 1, assigneeId: 1 });
taskSchema.index({ projectId: 1, dueDate: 1 });
taskSchema.index({ projectId: 1, sprintId: 1 });
taskSchema.index({ projectId: 1, number: 1 }, { unique: true, sparse: true });
taskSchema.index({ workspaceId: 1, key: 1 }, { unique: true, sparse: true });
taskSchema.index({ workspaceId: 1, updatedAt: -1 });
taskSchema.index({ title: 'text', description: 'text' });


export type TaskDocument = InferSchemaType<typeof taskSchema> & { id: string };
export const Task = model('Task', taskSchema);
