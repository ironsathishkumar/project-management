import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

const projectMemberSchema = new Schema(
  {
    projectId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    /** Project role key (dynamic per project), e.g. FULL_STACK, BACKEND */
    projectRole: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

withPublicId(projectMemberSchema);
projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export type ProjectMemberDocument = InferSchemaType<typeof projectMemberSchema> & { id: string };
export const ProjectMember = model('ProjectMember', projectMemberSchema);
