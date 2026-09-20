import { Schema, model, InferSchemaType } from 'mongoose';
import { PROJECT_STATUS } from '../config/constants';
import { withPublicId } from './plugins';

const projectSchema = new Schema(
  {
    workspaceId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'folder' },
    status: { type: String, enum: Object.values(PROJECT_STATUS), default: PROJECT_STATUS.ACTIVE },
    ownerId: { type: String, required: true, index: true },
    workflowId: { type: String, required: true },
    startDate: { type: Date },
    dueDate: { type: Date },
    archivedAt: { type: Date },
    taskCounter: { type: Number, default: 0 },
  },
  { timestamps: true }
);

withPublicId(projectSchema);
projectSchema.index({ workspaceId: 1, key: 1 }, { unique: true });


export type ProjectDocument = InferSchemaType<typeof projectSchema> & { id: string };
export const Project = model('Project', projectSchema);
