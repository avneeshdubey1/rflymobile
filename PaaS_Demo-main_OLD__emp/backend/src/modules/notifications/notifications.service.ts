import { db } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import type { NotificationItem } from '@prisma/client';

export class NotificationsService {
  async listForUser(userId: string): Promise<NotificationItem[]> {
    return await db.notificationItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<NotificationItem> {
    const notif = await db.notificationItem.findUnique({ where: { id: notificationId } });
    if (!notif) throw ApiError.notFound('Notification not found');
    if (notif.userId !== userId) throw ApiError.forbidden('Not your notification');

    return await db.notificationItem.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await db.notificationItem.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return result.count;
  }
}

export const notificationsService = new NotificationsService();
