import { Schema, model, InferSchemaType } from 'mongoose';
import { VIEW_TYPES } from '../config/constants';
import { withPublicId } from './plugins';

const savedViewSchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    projectId: { type: String, index: true },
    ownerId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    viewType: { type: String, enum: VIEW_TYPES, required: true },
    filters: { type: Schema.Types.Mixed, default: { combinator: 'AND', rules: [] } },
    sorting: { type: Schema.Types.Mixed, default: { field: 'updatedAt', direction: 'desc' } },
    grouping: { type: String, default: 'status' },
    columns: { type: [String], default: [] },
    isShared: { type: Boolean, default: false },
  },
  { timestamps: true }
);

withPublicId(savedViewSchema);


export type SavedViewDocument = InferSchemaType<typeof savedViewSchema> & { id: string };
export const SavedView = model('SavedView', savedViewSchema);
