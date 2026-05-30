import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class InAppNotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(userId: string, isRead?: boolean, skip = 0, take = 20) {
    if (!userId) return [];
    const items = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(typeof isRead === 'boolean' ? { isRead } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    if (items.length === 0) return [];

    const minDate = new Date(Math.min(...items.map((n) => n.createdAt.getTime())) - 5000);
    const maxDate = new Date(Math.max(...items.map((n) => n.createdAt.getTime())) + 5000);

    const [eventLogs, userDevices] = await Promise.all([
      this.prisma.eventLog.findMany({
        where: {
          userId,
          createdAt: { gte: minDate, lte: maxDate },
          eventType: { in: ['ALERT_TRIGGERED', 'ALERT_RESOLVED'] },
        },
      }),
      this.prisma.userDevice.findMany({
        where: {
          userId,
          deviceId: { in: [...new Set(items.map((n) => n.deviceId).filter(Boolean))] as string[] },
        },
      }),
    ]);

    const deviceMap = new Map(userDevices.map((d) => [d.deviceId, d.name]));

    return items.map((n) => {
      const messageLower = n.message.toLowerCase();
      const firstWord = n.message.split(' ')[0].toLowerCase().replace('.', '');
      let paramName = firstWord;
      if (paramName === 'temp') paramName = 'temperature';

      const isTrigger = messageLower.includes('exceed');
      const targetType = isTrigger ? 'ALERT_TRIGGERED' : 'ALERT_RESOLVED';

      const matches = eventLogs.filter(
        (e) =>
          e.deviceId === n.deviceId &&
          e.parameter?.toLowerCase() === paramName &&
          e.eventType === targetType &&
          Math.abs(e.createdAt.getTime() - n.createdAt.getTime()) <= 5000,
      );

      matches.sort(
        (a, b) =>
          Math.abs(a.createdAt.getTime() - n.createdAt.getTime()) -
          Math.abs(b.createdAt.getTime() - n.createdAt.getTime()),
      );
      const matchedEvent = matches[0];

      return {
        ...n,
        deviceName: n.deviceId ? deviceMap.get(n.deviceId) || n.deviceId : null,
        eventLogId: matchedEvent ? matchedEvent.id.toString() : null,
      };
    });
  }

  count(userId: string, isRead?: boolean) {
    if (!userId) return 0;
    return this.prisma.notification.count({
      where: {
        userId,
        ...(typeof isRead === 'boolean' ? { isRead } : {}),
      },
    });
  }

  markRead(userId: string, notificationId: string) {
    if (!userId || !notificationId) return { count: 0 };
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  markAllRead(userId: string) {
    if (!userId) return { count: 0 };
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
