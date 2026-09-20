import { Schema, model, InferSchemaType } from 'mongoose';
import { DEPENDENCY_TYPES } from '../config/constants';
import { withPublicId } from './plugins';

const taskDependencySchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    taskId: { type: String, required: true, index: true },
    dependsOnTaskId: { type: String, required: true },
    type: { type: String, enum: DEPENDENCY_TYPES, required: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

withPublicId(taskDependencySchema);
taskDependencySchema.index({ taskId: 1, dependsOnTaskId: 1, type: 1 }, { unique: true });


export type TaskDependencyDocument = InferSchemaType<typeof taskDependencySchema> & { id: string };
export const TaskDependency = model('TaskDependency', taskDependencySchema);
