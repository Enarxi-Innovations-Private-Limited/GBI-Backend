import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class InAppNotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(userId: string, isRead?: boolean, skip = 0, take = 20) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(typeof isRead === 'boolean' ? { isRead } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  count(userId: string, isRead?: boolean) {
    return this.prisma.notification.count({
      where: {
        userId,
        ...(typeof isRead === 'boolean' ? { isRead } : {}),
      },
    });
  }

  markRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
