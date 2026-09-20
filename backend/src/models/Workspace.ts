import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    logo: { type: String },
    ownerId: { type: String, required: true, index: true },
    settings: {
      type: Schema.Types.Mixed,
      default: {
        allowMemberProjectCreate: true,
        defaultView: 'BOARD',
      },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

withPublicId(workspaceSchema);

export type WorkspaceDocument = InferSchemaType<typeof workspaceSchema> & { id: string };
export const Workspace = model('Workspace', workspaceSchema);
