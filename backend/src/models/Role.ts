import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

const roleSchema = new Schema(
  {
    workspaceId: { type: String, index: true },
    name: { type: String, required: true },
    key: { type: String, required: true },
    description: { type: String, default: '' },
    isSystemRole: { type: Boolean, default: false },
    permissions: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

withPublicId(roleSchema);
roleSchema.index({ key: 1, workspaceId: 1 }, { unique: true });


export type RoleDocument = InferSchemaType<typeof roleSchema> & { id: string };
export const Role = model('Role', roleSchema);
