import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

const taskTagSchema = new Schema(
  {
    taskId: { type: String, required: true, index: true },
    tagId: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

withPublicId(taskTagSchema);
taskTagSchema.index({ taskId: 1, tagId: 1 }, { unique: true });


export type TaskTagDocument = InferSchemaType<typeof taskTagSchema> & { id: string };
export const TaskTag = model('TaskTag', taskTagSchema);
