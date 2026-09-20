import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

const tagSchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true },
    color: { type: String, default: '#0EA5E9' },
  },
  { timestamps: true }
);

withPublicId(tagSchema);
tagSchema.index({ workspaceId: 1, key: 1 }, { unique: true });


export type TagDocument = InferSchemaType<typeof tagSchema> & { id: string };
export const Tag = model('Tag', tagSchema);
