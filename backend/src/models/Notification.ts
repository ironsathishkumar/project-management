import { Schema, model, InferSchemaType } from 'mongoose';
import { withPublicId } from './plugins';

const notificationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    workspaceId: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    entityType: { type: String },
    entityId: { type: String },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

withPublicId(notificationSchema);
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });


export type NotificationDocument = InferSchemaType<typeof notificationSchema> & { id: string };
export const Notification = model('Notification', notificationSchema);
