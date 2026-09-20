import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

const customFieldSchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    projectId: { type: String, index: true },
    name: { type: String, required: true },
    key: { type: String, required: true },
    fieldType: {
      type: String,
      enum: ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'USER'],
      required: true,
    },
    options: { type: [String], default: [] },
    isRequired: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

withPublicId(customFieldSchema);


export type CustomFieldDocument = InferSchemaType<typeof customFieldSchema> & { id: string };
export const CustomField = model('CustomField', customFieldSchema);
