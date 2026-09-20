import { Schema, model, InferSchemaType } from 'mongoose';
import { STATUS_CATEGORIES } from '../config/constants';
import { withPublicId } from './plugins';

const statusSchema = new Schema(
  {
    workflowId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true },
    category: { type: String, enum: Object.values(STATUS_CATEGORIES), required: true },
    order: { type: Number, required: true },
    color: { type: String, default: '#64748B' },
    icon: { type: String, default: 'circle' },
    isDefault: { type: Boolean, default: false },
    isFinal: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

withPublicId(statusSchema);
statusSchema.index({ workflowId: 1, order: 1 });
statusSchema.index({ workflowId: 1, key: 1 }, { unique: true });


export type StatusDocument = InferSchemaType<typeof statusSchema> & { id: string };
export const Status = model('Status', statusSchema);
