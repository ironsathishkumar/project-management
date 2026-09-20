import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

const commentSchema = new Schema(
  {
    workspaceId: { type: String, required: true },
    projectId: { type: String, required: true },
    taskId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    parentCommentId: { type: String },
    content: { type: String, required: true },
    editedAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

withPublicId(commentSchema);
commentSchema.index({ taskId: 1, createdAt: 1 });
commentSchema.index({ content: 'text' });


export type CommentDocument = InferSchemaType<typeof commentSchema> & { id: string };
export const Comment = model('Comment', commentSchema);
