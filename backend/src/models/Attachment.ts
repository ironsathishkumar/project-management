import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

const attachmentSchema = new Schema(
  {
    workspaceId: { type: String, required: true },
    projectId: { type: String, required: true },
    taskId: { type: String, required: true, index: true },
    uploadedBy: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storageProvider: { type: String, required: true },
    storageKey: { type: String, required: true },
    url: { type: String, required: true },
  },
  { timestamps: true }
);

withPublicId(attachmentSchema);


export type AttachmentDocument = InferSchemaType<typeof attachmentSchema> & { id: string };
export const Attachment = model('Attachment', attachmentSchema);
