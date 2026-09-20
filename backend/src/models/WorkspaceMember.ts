import { Schema, model, InferSchemaType } from 'mongoose';
import { MEMBER_STATUS } from '../config/constants';
import { withPublicId } from './plugins';

const workspaceMemberSchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    roleId: { type: String, required: true },
    status: { type: String, enum: Object.values(MEMBER_STATUS), default: MEMBER_STATUS.ACTIVE },
    joinedAt: { type: Date, default: Date.now },
    invitedAt: { type: Date },
  },
  { timestamps: true }
);

withPublicId(workspaceMemberSchema);
workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });


export type WorkspaceMemberDocument = InferSchemaType<typeof workspaceMemberSchema> & { id: string };
export const WorkspaceMember = model('WorkspaceMember', workspaceMemberSchema);
