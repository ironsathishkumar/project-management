import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

const categorySchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true },
    description: { type: String, default: '' },
    color: { type: String, default: '#6366F1' },
    icon: { type: String, default: 'label' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

withPublicId(categorySchema);
categorySchema.index({ workspaceId: 1, key: 1 }, { unique: true });


export type CategoryDocument = InferSchemaType<typeof categorySchema> & { id: string };
export const Category = model('Category', categorySchema);
