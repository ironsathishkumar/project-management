import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

const workflowTransitionSchema = new Schema(
  {
    workflowId: { type: String, required: true, index: true },
    fromStatusId: { type: String, required: true },
    toStatusId: { type: String, required: true },
    isAllowed: { type: Boolean, default: true },
  },
  { timestamps: true }
);

withPublicId(workflowTransitionSchema);
workflowTransitionSchema.index({ workflowId: 1, fromStatusId: 1, toStatusId: 1 }, { unique: true });


export type WorkflowTransitionDocument = InferSchemaType<typeof workflowTransitionSchema> & {
  id: string;
};
export const WorkflowTransition = model('WorkflowTransition', workflowTransitionSchema);
