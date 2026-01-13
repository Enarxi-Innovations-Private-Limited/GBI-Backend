import { Injectable, NotFoundException } from '@nestjs/common';
import { InAppNotificationsRepository } from './in-app-notifications.repository';

@Injectable()
export class InAppNotificationsService {
  constructor(private readonly repo: InAppNotificationsRepository) {}

  async getMyNotifications(
    userId: string,
    isRead?: boolean,
    page = 1,
    limit = 20,
  ) {
    const take = Math.min(limit, 50);
    const skip = (page - 1) * take;

    const [items, total] = await Promise.all([
      this.repo.findMany(userId, isRead, skip, take),
      this.repo.count(userId, isRead),
    ]);

    return { page, limit: take, total, items };
  }

  async markAsRead(userId: string, notificationId: string) {
    const result = await this.repo.markRead(userId, notificationId);
    if (result.count === 0)
      throw new NotFoundException('Notification not found');
    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(userId: string) {
    const result = await this.repo.markAllRead(userId);
    return { message: `Marked ${result.count} notification as read` };
  }
}
