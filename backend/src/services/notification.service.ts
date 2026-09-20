import { Notification } from '../models';

export const notificationService = {
  async create(input: {
    userId: string;
    workspaceId: string;
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
  }) {
    if (!input.userId) return null;
    return Notification.create(input);
  },

  async list(userId: string) {
    return Notification.find({ userId }).sort({ createdAt: -1 }).limit(50);
  },

  async markRead(userId: string, notificationId: string) {
    return Notification.findOneAndUpdate(
      { id: notificationId, userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
  },

  async markAllRead(userId: string) {
    await Notification.updateMany({ userId, isRead: false }, { isRead: true, readAt: new Date() });
  },
};
