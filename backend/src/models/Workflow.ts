import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

const workflowSchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

withPublicId(workflowSchema);


export type WorkflowDocument = InferSchemaType<typeof workflowSchema> & { id: string };
export const Workflow = model('Workflow', workflowSchema);
