import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

export const PROJECT_ROLE_LEVELS = {
  MANAGER: 'MANAGER',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
} as const;

const projectRoleSchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    projectId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, uppercase: true, trim: true },
    permissionLevel: {
      type: String,
      enum: Object.values(PROJECT_ROLE_LEVELS),
      default: PROJECT_ROLE_LEVELS.MEMBER,
      required: true,
    },
    color: { type: String, default: '#2563EB' },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

withPublicId(projectRoleSchema);
projectRoleSchema.index({ projectId: 1, key: 1 }, { unique: true });
projectRoleSchema.index({ projectId: 1, order: 1 });

export type ProjectRoleDocument = InferSchemaType<typeof projectRoleSchema> & { id: string };
export const ProjectRole = model('ProjectRole', projectRoleSchema);
